// Pembaruan keadaan alat untuk satu sub-langkah: SoC baterai, tahap dan terminal beban SCC,
// LVD/HVD inverter, dan energi kumulatif (docs/MODEL_FISIKA.md §12 butir 3).
import { batteryStepSocPct } from '../components/battery';
import { inverterStepDcState } from '../components/inverter';
import {
  pwmDetectVoltageScale,
  pwmLoadConnected,
  pwmNextStage,
  pwmSetpoints,
} from '../components/scc';
import type {
  EnergyTotals,
  InverterSimState,
  SccSimState,
  SimEvent,
  SimFrame,
  SimState,
  StepOutcome,
} from './step-types';
import type { OperatingPoint } from './types';

const SECONDS_PER_HOUR = 3600;
const DEFAULT_SOC_PCT = 100;
export const INITIAL_SCC: SccSimState = {
  stage: 'bulk',
  absorptionElapsedS: 0,
  loadConnected: true,
};
const INITIAL_INVERTER: InverterSimState = { on: true, lowVoltageS: 0 };

/** SoC tiap baterai setelah `dtS` pada arus titik kerja; suhu baterai = suhu sekitar. */
export function advanceSoc(frame: SimFrame, state: SimState, dtS: number): Record<string, number> {
  const socPctByBatteryId = { ...state.socPctByBatteryId };
  for (const [id, reading] of Object.entries(frame.point.batteries)) {
    const item = frame.solved.itemOf(id, 'battery');
    if (!item) continue;
    socPctByBatteryId[id] = batteryStepSocPct(
      item.electrical,
      socPctByBatteryId[id] ?? DEFAULT_SOC_PCT,
      reading.currentA,
      dtS,
      frame.environment.ambientTempC,
    );
  }
  return socPctByBatteryId;
}

/** Energi kumulatif setelah `dtS` pada daya titik kerja. */
export function advanceEnergy(
  energy: EnergyTotals,
  point: OperatingPoint,
  dtS: number,
): EnergyTotals {
  const hours = dtS / SECONDS_PER_HOUR;
  const { balance } = point;
  let chargeW = 0;
  let dischargeW = 0;
  for (const battery of Object.values(point.batteries)) {
    chargeW += Math.max(battery.powerW, 0);
    dischargeW += Math.max(-battery.powerW, 0);
  }
  const lossW = balance.wireLossW + balance.sccLossW + balance.inverterLossW;
  return {
    pvWh: energy.pvWh + balance.pvW * hours,
    loadWh: energy.loadWh + balance.loadW * hours,
    batteryChargeWh: energy.batteryChargeWh + chargeW * hours,
    batteryDischargeWh: energy.batteryDischargeWh + dischargeW * hours,
    gridImportWh: energy.gridImportWh + Math.max(balance.gridImportW, 0) * hours,
    gridExportWh: energy.gridExportWh + Math.max(-balance.gridImportW, 0) * hours,
    lossWh: energy.lossWh + lossW * hours,
  };
}

function advanceSccs(frame: SimFrame, state: SimState, dtS: number) {
  const sccById = { ...state.sccById };
  let transition = false;
  for (const [id, reading] of Object.entries(frame.point.sccs)) {
    const item = frame.solved.itemOf(id, 'scc-pwm');
    if (!item || reading.status === 'no-battery') continue;
    const previous = sccById[id] ?? INITIAL_SCC;
    const { batteryVoltageV } = reading;
    const voltageScale =
      previous.voltageScale ?? pwmDetectVoltageScale(item.electrical, batteryVoltageV);
    const batteryType = frame.controls.batteryTypeBySccId?.[id] ?? 'sealed';
    const setpoints = pwmSetpoints(item.electrical, batteryType, voltageScale);
    // Saat SCC menahan tegangan di tahap bulk, tegangan baterai sudah di Vabs.
    const isHolding = previous.stage === 'bulk' && reading.status === 'regulating';
    const stageVoltageV = isHolding
      ? Math.max(batteryVoltageV, setpoints.absorptionV)
      : batteryVoltageV;
    const elapsedS = previous.absorptionElapsedS + (previous.stage === 'absorption' ? dtS : 0);
    const stage = pwmNextStage(item.electrical, setpoints, previous.stage, stageVoltageV, elapsedS);
    // Putus karena arus lebih terkunci sampai direset.
    const loadConnected =
      !previous.loadOverloaded &&
      pwmLoadConnected(setpoints, previous.loadConnected, batteryVoltageV);
    transition ||= stage !== previous.stage || loadConnected !== previous.loadConnected;
    sccById[id] = {
      stage,
      absorptionElapsedS: stage === 'absorption' ? elapsedS : 0,
      loadConnected,
      voltageScale,
      ...(previous.loadOverloaded && { loadOverloaded: true }),
    };
  }
  return { sccById, transition };
}

function advanceInverters(frame: SimFrame, state: SimState, dtS: number) {
  const inverterById = { ...state.inverterById };
  const events: SimEvent[] = [];
  let transition = false;
  for (const [id, reading] of Object.entries(frame.point.inverters)) {
    const item = frame.solved.itemOf(id, 'inverter-offgrid');
    if (!item || reading.status === 'no-dc') continue;
    const previous = inverterById[id] ?? INITIAL_INVERTER;
    // Mati karena beban lebih terkunci sampai direset.
    if (previous.offReason === 'overload') continue;
    // Daya tidak tersedia = tegangan masukan runtuh.
    const dcVoltageV = reading.status === 'collapsed' ? 0 : reading.dcVoltageV;
    const next = inverterStepDcState(item.electrical, previous, dcVoltageV, dtS);
    // Mulai atau berhentinya penghitung tunda LVD juga dihitung per langkah dasar.
    transition ||= next.on !== previous.on || next.lowVoltageS > 0 !== previous.lowVoltageS > 0;
    if (next.on) {
      inverterById[id] = next;
      continue;
    }
    if (!previous.on) {
      inverterById[id] = { ...next, ...(previous.offReason && { offReason: previous.offReason }) };
      continue;
    }
    const offReason = dcVoltageV > item.electrical.dcVoltageHvdV ? 'hvd' : 'lvd';
    inverterById[id] = { ...next, offReason };
    events.push({
      kind: offReason === 'lvd' ? 'inverter-lvd' : 'inverter-hvd',
      timeS: state.timeS + dtS,
      componentId: id,
      params: { voltageV: dcVoltageV },
    });
  }
  return { inverterById, events, transition };
}

/** SoC, SCC, inverter, dan energi setelah `dtS`; kejadian: LVD dan HVD inverter. */
export function advanceDevices(frame: SimFrame, state: SimState, dtS: number): StepOutcome {
  const sccs = advanceSccs(frame, state, dtS);
  const inverters = advanceInverters(frame, state, dtS);
  return {
    state: {
      ...state,
      socPctByBatteryId: advanceSoc(frame, state, dtS),
      sccById: sccs.sccById,
      inverterById: inverters.inverterById,
      energy: advanceEnergy(state.energy, frame.point, dtS),
    },
    events: inverters.events,
    transition: sccs.transition || inverters.transition,
    instant: false,
  };
}
