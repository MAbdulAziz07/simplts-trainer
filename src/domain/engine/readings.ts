// Hasil mentah solver menjadi bacaan per komponen, arus per kabel, dan neraca daya
// (docs/MODEL_FISIKA.md §12 butir 5). Tegangan dihitung dari jatuh tegangan kabel putaran terakhir.
import type { DcConsumer } from '../circuit/subsystem-types';
import { batteryOcvV } from '../components/battery';
import { pvVoltageV } from '../components/pv';
import { pvArrayVocV, pvStringVoltageV } from '../components/pv-array';
import { pvModuleCurve } from './prepare-dc';
import { bankPort, chainOffsetV, portOffsetV } from './solve-dc';
import type { OffsetFn } from './solve-dc';
import type { SolvedSystem } from './solver';
import type { InverterReading, OperatingPoint, OperatingStatus, Reading } from './types';
import { potentialDiffV, summarizeFlow } from './wire-flow';

const DEFAULT_SOC_PCT = 100;

const reading = (voltageV: number, currentA: number): Reading => ({
  voltageV,
  currentA,
  powerW: voltageV * currentA,
});
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

/** Bacaan semua komponen pada keadaan tanpa arus: PV di Voc, baterai di OCV, sisanya nol. */
function restReadings(solved: SolvedSystem, point: OperatingPoint): void {
  const { input, state, itemOf, inverterStatus } = solved;
  const { topology, environment } = input;
  for (const { id, item } of topology.components) {
    if (item.category === 'pv-module') {
      const curve = pvModuleCurve(id, item, environment, state);
      point.pvModules[id] = reading(pvVoltageV(curve, 0), 0);
    } else if (item.category === 'battery') {
      const socPct = state.socPctByBatteryId?.[id] ?? DEFAULT_SOC_PCT;
      point.batteries[id] = reading(batteryOcvV(item.electrical, socPct), 0);
    } else if (item.category === 'load-dc' || item.category === 'load-ac') {
      point.loads[id] = reading(0, 0);
    } else if (item.category === 'grid') {
      const isAvailable = state.gridAvailableById?.[id] ?? item.electrical.availableDefault;
      point.grids[id] = reading(isAvailable ? item.electrical.nominalVoltageV : 0, 0);
    }
  }
  for (const node of topology.sccs) {
    if (!itemOf(node.id, 'scc-pwm')) continue;
    point.sccs[node.id] = {
      status: node.busId ? 'idle' : 'no-battery',
      pvVoltageV: 0,
      chargeCurrentA: 0,
      batteryVoltageV: 0,
      loadCurrentA: 0,
      pvPowerW: 0,
      lossW: 0,
    };
  }
  for (const [id, status] of inverterStatus) {
    point.inverters[id] = {
      status,
      dcVoltageV: 0,
      dcCurrentA: 0,
      dcPowerW: 0,
      acVoltageV: 0,
      acCurrentA: 0,
      acPowerW: 0,
    };
  }
}

function readDcBuses(solved: SolvedSystem, point: OperatingPoint, offsetV: OffsetFn): void {
  solved.buses.forEach((prepared, busIndex) => {
    const round = solved.dcRounds[busIndex];
    const { id } = prepared.bus;
    if (!prepared.bank || !round || round.solution.collapsed) {
      const status = round ? 'collapsed' : 'unsupported';
      point.dcBuses.push({ id, status, voltageV: 0, batteryCurrentA: 0 });
      return;
    }
    const { solution } = round;
    // Tanda dibalik: bacaan baterai positif = diisi. `0 - x` supaya nol tidak menjadi -0.
    const chargeA = 0 - solution.batteryCurrentA;
    const busV = solution.voltageV;
    const reference = bankPort(prepared.bus);
    const { strings } = prepared.bus.battery;
    point.dcBuses.push({
      id,
      status: 'ok',
      voltageV: busV,
      batteryCurrentA: chargeA,
    });
    for (const ids of strings) {
      const unitV = (busV + chainOffsetV(ids, reference, offsetV)) / ids.length;
      for (const batteryId of ids) {
        point.batteries[batteryId] = reading(unitV, chargeA / strings.length);
      }
    }
    const readConsumer = (consumer: DcConsumer, voltageV: number) => {
      const currentA = round.currentAByConsumerId.get(consumer.id) ?? 0;
      const inverter = point.inverters[consumer.id];
      if (!inverter) point.loads[consumer.id] = reading(voltageV, currentA);
      else Object.assign(inverter, dcFields(voltageV, currentA));
    };
    for (const consumer of prepared.consumers) {
      readConsumer(consumer, busV + portOffsetV(consumer.port, reference, offsetV));
    }
    prepared.sccs.forEach(({ node, item, strings: curves, vocStatus, consumers }, sccIndex) => {
      const scc = round.sccs[sccIndex];
      if (!scc) return;
      const { chargeCurrentA, loadCurrentA } = scc;
      const batteryVoltageV = busV + portOffsetV(node.batPort, reference, offsetV);
      const isCharging = chargeCurrentA > 0;
      // Sakelar PWM terbuka: terminal PV berada di Voc array.
      const pvV = isCharging ? batteryVoltageV + item.electrical.switchDropV : pvArrayVocV(curves);
      const active = !isCharging ? 'idle' : solution.regulated ? 'regulating' : 'charging';
      point.sccs[node.id] = {
        status: vocStatus === 'ok' ? active : vocStatus,
        pvVoltageV: pvV,
        chargeCurrentA,
        batteryVoltageV,
        loadCurrentA,
        pvPowerW: pvV * chargeCurrentA,
        lossW: item.electrical.switchDropV * chargeCurrentA + batteryVoltageV * scc.selfA,
      };
      const { loadPort } = node;
      for (const consumer of loadPort ? consumers : []) {
        readConsumer(
          consumer,
          batteryVoltageV + portOffsetV(consumer.port, loadPort ?? consumer.port, offsetV),
        );
      }
      node.pv.strings.forEach((ids, stringIndex) => {
        const currentA = scc.stringCurrentsA[stringIndex] ?? 0;
        if (currentA <= 0) return;
        const stringV = pvV + chainOffsetV(ids, node.pvPort, offsetV);
        // Tegangan string dibagi ke modul menurut kurva masing-masing pada arus string.
        const sharesV = (curves[stringIndex] ?? []).map((curve) =>
          pvStringVoltageV([curve], currentA),
        );
        const totalV = sum(sharesV);
        ids.forEach((pvId, i) => {
          const share = totalV > 0 ? (sharesV[i] ?? 0) / totalV : 1 / ids.length;
          point.pvModules[pvId] = reading(stringV * share, currentA);
        });
      });
    });
  });
}

function dcFields(voltageV: number, currentA: number): Partial<InverterReading> {
  return { dcVoltageV: voltageV, dcCurrentA: currentA, dcPowerW: voltageV * currentA };
}

function readAcBuses(solved: SolvedSystem, point: OperatingPoint, offsetV: OffsetFn): void {
  for (const round of solved.acRounds) {
    const { bus, status, voltageV, source } = round;
    point.acBuses.push({ id: bus.id, status, voltageV, ...(source && { sourceId: source.id }) });
    if (status !== 'ok' || !source) continue;
    for (const load of bus.loads) {
      const loadV = Math.max(voltageV + portOffsetV(load.port, source.port, offsetV), 0);
      point.loads[load.id] = reading(loadV, round.currentAByLoadId.get(load.id) ?? 0);
    }
    const output = reading(voltageV, round.totalCurrentA);
    const inverter = point.inverters[source.id];
    if (source.category === 'grid') point.grids[source.id] = output;
    else if (inverter) {
      inverter.acVoltageV = output.voltageV;
      inverter.acCurrentA = output.currentA;
      inverter.acPowerW = output.powerW;
    }
  }
}

function overallStatus(solved: SolvedSystem, point: OperatingPoint): OperatingStatus {
  const subsystems = [...point.dcBuses, ...point.acBuses];
  const hasUnsupported = solved.input.topology.unsupportedIds.length > 0;
  if (hasUnsupported || subsystems.some((s) => s.status === 'unsupported')) return 'unsupported';
  const inverters = Object.values(point.inverters);
  const hasCollapse = point.dcBuses.some((bus) => bus.status === 'collapsed');
  if (hasCollapse || inverters.some((inverter) => inverter.status === 'collapsed'))
    return 'collapsed';
  return subsystems.some((s) => s.status === 'ok') ? 'ok' : 'no-source';
}

export function readOperatingPoint(solved: SolvedSystem): OperatingPoint {
  const offsetV: OffsetFn = (a, b) => potentialDiffV(solved.flow, a, b);
  const balance = {
    pvW: 0,
    batteryDischargeW: 0,
    gridImportW: 0,
    loadW: 0,
    wireLossW: 0,
    sccLossW: 0,
    inverterLossW: 0,
    residualW: 0,
  };
  const point: OperatingPoint = {
    status: 'no-source',
    dcBuses: [],
    acBuses: [],
    pvModules: {},
    batteries: {},
    sccs: {},
    inverters: {},
    loads: {},
    grids: {},
    currentAByWireId: {},
    currentAByComponentId: {},
    voltageDropVByWireId: {},
    loopWireIds: [],
    balance,
  };
  restReadings(solved, point);
  readDcBuses(solved, point, offsetV);
  readAcBuses(solved, point, offsetV);
  const categoryById = new Map(
    solved.input.topology.components.map(({ id, item }) => [id, item.category]),
  );
  const { wireLossW, ...wires } = summarizeFlow(solved.edges, solved.flow, categoryById);
  Object.assign(point, wires);
  balance.wireLossW = wireLossW;
  point.status = overallStatus(solved, point);

  const powerW = (readings: Record<string, Reading>) =>
    sum(Object.values(readings).map((value) => value.powerW));
  balance.pvW = powerW(point.pvModules);
  balance.batteryDischargeW = -powerW(point.batteries);
  balance.gridImportW = powerW(point.grids);
  balance.loadW = powerW(point.loads);
  balance.sccLossW = sum(Object.values(point.sccs).map((scc) => scc.lossW));
  balance.inverterLossW = sum(
    Object.values(point.inverters).map((inverter) => inverter.dcPowerW - inverter.acPowerW),
  );
  const lossW = balance.wireLossW + balance.sccLossW + balance.inverterLossW;
  balance.residualW =
    balance.pvW + balance.batteryDischargeW + balance.gridImportW - balance.loadW - lossW;
  return point;
}
