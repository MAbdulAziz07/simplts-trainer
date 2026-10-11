// Solver tingkat sistem (bukan simulator SPICE): menghitung titik kerja semua subsistem untuk satu
// saat (docs/MODEL_FISIKA.md §12 butir 1–2). Tegangan bus dicari per bus, lalu jatuh tegangan kabel
// dihitung ulang beberapa putaran. Fungsi murni; pembaruan keadaan (SoC, trip) ada di luar berkas ini.
import type { DcConsumer } from '../circuit/subsystem-types';
import type { TerminalRef } from '../circuit/types';
import { inverterDcInputW } from '../components/inverter';
import { loadResistanceOhm } from '../components/load';
import { readOperatingPoint } from './readings';
import { injectAcBus, solveAcBus } from './solve-ac';
import type { AcBusRound } from './solve-ac';
import { itemLookup, prepareDcBus } from './prepare-dc';
import type { ItemLookup, PreparedBus } from './prepare-dc';
import { consumerPathOhm, injectDcBus, solveDcBus } from './solve-dc';
import type { DcBusRound, OffsetFn, Sink } from './solve-dc';
import type { InverterStatus, OperatingPoint, SolverInput, SolverState } from './types';
import { buildFlowEdges, potentialDiffV, solveFlow, terminalKey } from './wire-flow';
import type { FlowEdge, FlowResult } from './wire-flow';

/** Putaran hitung ulang jatuh tegangan kabel (§12 butir 2: 3–5 putaran). */
export const VOLTAGE_DROP_ROUNDS = 5;

/** Hasil mentah solver sebelum diubah menjadi bacaan per komponen. */
export interface SolvedSystem {
  input: SolverInput;
  state: SolverState;
  itemOf: ItemLookup;
  edges: FlowEdge[];
  flow: FlowResult;
  buses: PreparedBus[];
  /** Sejajar dengan `buses`; `undefined` untuk bus yang tidak dihitung. */
  dcRounds: (DcBusRound | undefined)[];
  acRounds: AcBusRound[];
  inverterStatus: Map<string, InverterStatus>;
}

/** Daya AC yang dikeluarkan sebuah sumber pada putaran ini. */
function acOutputW(sourceId: string, acRounds: readonly AcBusRound[]): number {
  return acRounds.reduce(
    (sumW, round) =>
      sumW + (round.source?.id === sourceId ? round.voltageV * round.totalCurrentA : 0),
    0,
  );
}

export function solveSystem(input: SolverInput): SolvedSystem {
  const { topology, cables, environment } = input;
  const state = input.state ?? {};
  const itemOf = itemLookup(topology.components);
  const edges = buildFlowEdges(
    topology.netlist.wires,
    topology.bridges,
    cables,
    (wireId) => state.conductorTempCByWireId?.[wireId] ?? environment.ambientTempC,
  );
  const buses = topology.dcBuses.map((bus) =>
    prepareDcBus(bus, topology, itemOf, environment, state),
  );
  const resistanceOhm = (loadId: string): number => {
    const item = itemOf(loadId, 'load-dc') ?? itemOf(loadId, 'load-ac');
    if (!item) return Infinity;
    const settingW = state.powerSettingWByLoadId?.[loadId] ?? item.electrical.maxPowerW;
    return loadResistanceOhm(item.electrical, settingW);
  };

  const inverters = topology.dcConsumers.filter((c) => c.category === 'inverter-offgrid');
  const feedOf = (consumer: DcConsumer) =>
    buses.find(
      (bus) =>
        bus.bank &&
        (bus.consumers.includes(consumer) ||
          bus.sccs.some((scc) => scc.consumers.includes(consumer))),
    );
  const inverterStatus = new Map<string, InverterStatus>();
  for (const inverter of inverters) {
    const isOn = state.inverterOnById?.[inverter.id] !== false;
    inverterStatus.set(inverter.id, !feedOf(inverter) ? 'no-dc' : isOn ? 'on' : 'off');
  }
  const isLive = (source: { id: string; category: string }) =>
    source.category === 'grid'
      ? (state.gridAvailableById?.[source.id] ??
        itemOf(source.id, 'grid')?.electrical.availableDefault ??
        false)
      : inverterStatus.get(source.id) === 'on';

  const pathOhms = buses.map((bus) => consumerPathOhm(bus, edges));
  let flow = solveFlow(edges, new Map());
  let dcRounds: (DcBusRound | undefined)[] = [];
  let acRounds: AcBusRound[] = [];
  // Inverter yang dayanya tidak tersedia dimatikan, lalu dihitung ulang dari awal.
  for (let attempt = 0; attempt <= inverters.length; attempt += 1) {
    flow = solveFlow(edges, new Map());
    dcRounds = [];
    let collapsedNow = false;
    for (let round = 0; round < VOLTAGE_DROP_ROUNDS && !collapsedNow; round += 1) {
      const previous = flow;
      const offsetV: OffsetFn = (a, b) => potentialDiffV(previous, a, b);
      acRounds = topology.acBuses.map((bus) =>
        solveAcBus(bus, itemOf, isLive, resistanceOhm, offsetV),
      );
      const sinkById = new Map<string, Sink>();
      for (const consumer of topology.dcConsumers) {
        const inverter = itemOf(consumer.id, 'inverter-offgrid');
        if (!inverter) {
          sinkById.set(consumer.id, {
            kind: 'resistive',
            resistanceOhm: resistanceOhm(consumer.id),
          });
          continue;
        }
        const isOn = inverterStatus.get(consumer.id) === 'on';
        const powerW = isOn
          ? inverterDcInputW(inverter.electrical, acOutputW(consumer.id, acRounds))
          : 0;
        sinkById.set(consumer.id, { kind: 'power', powerW });
      }
      const previousRounds = dcRounds;
      dcRounds = buses.map((bus, i) =>
        bus.bank
          ? solveDcBus(
              { ...bus, bank: bus.bank },
              sinkById,
              offsetV,
              pathOhms[i],
              previousRounds[i],
            )
          : undefined,
      );
      buses.forEach((bus, i) => {
        if (!dcRounds[i]?.solution.collapsed) return;
        for (const inverter of inverters) {
          if (feedOf(inverter) !== bus || inverterStatus.get(inverter.id) !== 'on') continue;
          inverterStatus.set(inverter.id, 'collapsed');
          collapsedNow = true;
        }
      });
      if (collapsedNow) break;

      const injectionA = new Map<string, number>();
      const inject = (terminal: TerminalRef, currentA: number) => {
        const key = terminalKey(terminal);
        injectionA.set(key, (injectionA.get(key) ?? 0) + currentA);
      };
      for (const acRound of acRounds) injectAcBus(acRound, inject);
      buses.forEach((bus, i) => {
        const dcRound = dcRounds[i];
        if (dcRound) injectDcBus(bus, dcRound, inject);
      });
      flow = solveFlow(edges, injectionA);
    }
    if (!collapsedNow) break;
  }
  return { input, state, itemOf, edges, flow, buses, dcRounds, acRounds, inverterStatus };
}

/**
 * Titik kerja rangkaian pada satu saat: tegangan tiap bus, bacaan tiap komponen, arus tiap kabel,
 * dan neraca daya. Hasil hanya bergantung pada masukan.
 */
export function solveOperatingPoint(input: SolverInput): OperatingPoint {
  return readOperatingPoint(solveSystem(input));
}
