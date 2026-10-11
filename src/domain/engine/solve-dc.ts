// Satu bus baterai dengan SCC PWM, array PV, dan pemakainya: arus tiap alat pada jatuh tegangan
// kabel putaran sebelumnya, lalu suntikan arus per terminal (MODEL_FISIKA §2.2, §12).
import type { DcBus, DcConsumer, Port, SccNode } from '../circuit/subsystem-types';
import type { TerminalRef } from '../circuit/types';
import { pvStringCurrentA } from '../components/pv-array';
import { solveBus } from './dc-bus';
import type { BatteryBank, BusSolution } from './dc-bus';
import type { PreparedBus } from './prepare-dc';
import { potentialDiffV, solveFlow, terminalKey } from './wire-flow';
import type { FlowEdge } from './wire-flow';

/** Beda potensial `a − b` akibat arus kabel putaran sebelumnya. */
export type OffsetFn = (a: TerminalRef, b: TerminalRef) => number;
/** Pemakai DC: beban resistif atau daya konstan (masukan inverter). */
export type Sink = { kind: 'resistive'; resistanceOhm: number } | { kind: 'power'; powerW: number };
export interface DcBusRound {
  solution: BusSolution;
  sccs: {
    chargeCurrentA: number;
    stringCurrentsA: number[];
    loadCurrentA: number;
    selfA: number;
  }[];
  currentAByConsumerId: Map<string, number>;
}

const pos = (componentId: string): TerminalRef => ({ componentId, terminalId: 'pos' });
const neg = (componentId: string): TerminalRef => ({ componentId, terminalId: 'neg' });

/** Tegangan port dikurangi tegangan port acuan pada net yang sama. */
export function portOffsetV(port: Port, reference: Port, offsetV: OffsetFn): number {
  return offsetV(port.pos, reference.pos) - offsetV(port.neg, reference.neg);
}

/** Jumlah tegangan sumber dalam string dikurangi tegangan port acuannya (kabel antarsumber + ujung). */
export function chainOffsetV(ids: readonly string[], reference: Port, offsetV: OffsetFn): number {
  const [first, last] = [ids[0], ids[ids.length - 1]];
  if (first === undefined || last === undefined) return 0;
  let sumV = offsetV(pos(last), reference.pos) - offsetV(neg(first), reference.neg);
  ids.slice(1).forEach((id, i) => (sumV += offsetV(pos(ids[i] ?? id), neg(id))));
  return sumV;
}

/** Port acuan bus: ujung string baterai pertama. */
export function bankPort(bus: DcBus): Port {
  const ids = bus.battery.strings[0] ?? [];
  return { pos: pos(ids[ids.length - 1] ?? ''), neg: neg(ids[0] ?? '') };
}

interface SinkTerm {
  id: string;
  sink: Sink | undefined;
  /** Tegangan sumber yang dilihat pemakai dikurangi tegangan bus, tanpa jatuh tegangan arusnya sendiri. */
  offsetV: number;
  /** Tahanan kabel di jalur pemakai ini. */
  pathOhm: number;
}

/**
 * Arus pemakai pada tegangan bus: beban resistif seri dengan kabelnya; daya konstan memakai akar
 * kecil R·I² − E·I + P = 0 (§4.2). `Infinity` = daya tidak tersedia (diskriminan negatif).
 */
function sinkCurrentA({ sink, offsetV, pathOhm }: SinkTerm, busVoltageV: number): number {
  const sourceV = busVoltageV + offsetV;
  if (!sink) return 0;
  if (sink.kind === 'resistive') {
    return sourceV > 0 && sink.resistanceOhm > 0 ? sourceV / (sink.resistanceOhm + pathOhm) : 0;
  }
  if (sink.powerW <= 0) return 0;
  if (sourceV <= 0) return Infinity;
  if (pathOhm <= 0) return sink.powerW / sourceV;
  const discriminant = sourceV ** 2 - 4 * pathOhm * sink.powerW;
  return discriminant < 0 ? Infinity : (sourceV - Math.sqrt(discriminant)) / (2 * pathOhm);
}

/**
 * Tahanan kabel di jalur tiap pemakai (bank → pemakai, atau bank → SCC → terminal beban →
 * pemakai), diukur dengan aliran uji 1 A. Dengan nilai ini arus pemakai dihitung bersama jatuh
 * tegangannya sendiri, sehingga runtuh karena kabel panjang terdeteksi.
 */
export function consumerPathOhm(
  prepared: PreparedBus,
  edges: readonly FlowEdge[],
): Map<string, number> {
  const reference = bankPort(prepared.bus);
  const pathOhmById = new Map<string, number>();
  const probe = (consumer: DcConsumer, via?: SccNode) => {
    const injectionA = new Map<string, number>();
    const through = (port: Port, currentA: number) => {
      for (const [terminal, sign] of [[port.pos, 1] as const, [port.neg, -1] as const]) {
        const key = terminalKey(terminal);
        injectionA.set(key, (injectionA.get(key) ?? 0) + sign * currentA);
      }
    };
    through(reference, 1);
    through(consumer.port, -1);
    if (via?.loadPort) through(via.batPort, -1);
    if (via?.loadPort) through(via.loadPort, 1);
    const flow = solveFlow(edges, injectionA);
    const offsetV: OffsetFn = (a, b) => potentialDiffV(flow, a, b);
    const dropV = via?.loadPort
      ? portOffsetV(via.batPort, reference, offsetV) +
        portOffsetV(consumer.port, via.loadPort, offsetV)
      : portOffsetV(consumer.port, reference, offsetV);
    pathOhmById.set(consumer.id, Math.max(-dropV, 0));
  };
  for (const consumer of prepared.consumers) probe(consumer);
  for (const scc of prepared.sccs) for (const consumer of scc.consumers) probe(consumer, scc.node);
  return pathOhmById;
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

/**
 * Titik kerja bus: tegangan bus, arus isi tiap SCC dan string PV, arus tiap pemakai. `previous` =
 * hasil putaran sebelumnya, yang arusnya menghasilkan `offsetV`.
 */
export function solveDcBus(
  prepared: PreparedBus & { bank: BatteryBank },
  sinkById: ReadonlyMap<string, Sink>,
  offsetV: OffsetFn,
  pathOhmById: ReadonlyMap<string, number> = new Map(),
  previous?: DcBusRound,
): DcBusRound {
  const reference = bankPort(prepared.bus);
  const firstString = prepared.bus.battery.strings[0] ?? [];
  const bankOffsetV = chainOffsetV(firstString, reference, offsetV);
  const term = (consumer: DcConsumer, baseOffsetV: number, port: Port): SinkTerm => {
    const pathOhm = pathOhmById.get(consumer.id) ?? 0;
    const ownDropV = pathOhm * (previous?.currentAByConsumerId.get(consumer.id) ?? 0);
    return {
      id: consumer.id,
      sink: sinkById.get(consumer.id),
      offsetV: baseOffsetV + portOffsetV(consumer.port, port, offsetV) + ownDropV,
      pathOhm,
    };
  };
  const busTerms = prepared.consumers.map((consumer) => term(consumer, 0, reference));
  const sccTerms = prepared.sccs.map(({ node, item, strings, vocStatus, limitV, consumers }) => {
    const batOffsetV = portOffsetV(node.batPort, reference, offsetV);
    const { loadPort } = node;
    const pvOffsetsV = node.pv.strings.map((ids) => chainOffsetV(ids, node.pvPort, offsetV));
    const stringCurrentsA = (busVoltageV: number) => {
      const pvVoltageV = busVoltageV + batOffsetV + item.electrical.switchDropV;
      const blocked = vocStatus !== 'ok' || busVoltageV + batOffsetV <= 0;
      return strings.map((modules, i) =>
        blocked ? 0 : pvStringCurrentA(modules, pvVoltageV + (pvOffsetsV[i] ?? 0)),
      );
    };
    return {
      batOffsetV,
      selfA: item.electrical.selfConsumptionMa / 1000,
      loadTerms: loadPort ? consumers.map((consumer) => term(consumer, batOffsetV, loadPort)) : [],
      stringCurrentsA,
      source: {
        availableA: (busVoltageV: number) =>
          Math.min(sum(stringCurrentsA(busVoltageV)), item.electrical.chargeCurrentMaxA),
        limitV: limitV - batOffsetV,
      },
    };
  });
  const allTerms = [...busTerms, ...sccTerms.flatMap((scc) => scc.loadTerms)];
  const selfA = sum(sccTerms.map((scc) => scc.selfA));
  const sinkA = (busVoltageV: number) =>
    selfA + sum(allTerms.map((t) => sinkCurrentA(t, busVoltageV)));

  const sources = sccTerms.map((scc) => scc.source);
  const solution = solveBus(prepared.bank, bankOffsetV, sources, sinkA);
  const { voltageV, collapsed } = solution;
  const currentOf = (t: SinkTerm) => (collapsed ? 0 : sinkCurrentA(t, voltageV));
  return {
    solution,
    sccs: sccTerms.map((scc, i) => {
      const chargeCurrentA = solution.sourceCurrentsA[i] ?? 0;
      const rawA = scc.stringCurrentsA(Math.min(voltageV, scc.source.limitV));
      const totalA = sum(rawA);
      const stringCurrentsA = rawA.map((valueA) =>
        totalA > 0 ? (valueA / totalA) * chargeCurrentA : 0,
      );
      const loadCurrentA = sum(scc.loadTerms.map(currentOf));
      return { chargeCurrentA, stringCurrentsA, loadCurrentA, selfA: collapsed ? 0 : scc.selfA };
    }),
    currentAByConsumerId: new Map(allTerms.map((t) => [t.id, currentOf(t)])),
  };
}

/** Suntikan arus tiap terminal dari hasil satu bus, untuk `solveFlow`. */
export function injectDcBus(
  prepared: PreparedBus,
  round: DcBusRound,
  inject: (terminal: TerminalRef, currentA: number) => void,
): void {
  const through = (port: Port, currentA: number) => {
    inject(port.pos, currentA);
    inject(port.neg, -currentA);
  };
  const chain = (ids: readonly string[], currentA: number) =>
    ids.forEach((id) => through({ pos: pos(id), neg: neg(id) }, currentA));
  const { strings } = prepared.bus.battery;
  for (const ids of strings) chain(ids, round.solution.batteryCurrentA / strings.length);
  const consumers = [...prepared.consumers, ...prepared.sccs.flatMap((scc) => scc.consumers)];
  for (const consumer of consumers) {
    through(consumer.port, -(round.currentAByConsumerId.get(consumer.id) ?? 0));
  }
  prepared.sccs.forEach(({ node }, i) => {
    const scc = round.sccs[i];
    if (!scc) return;
    through(node.batPort, scc.chargeCurrentA - scc.selfA - scc.loadCurrentA);
    through(node.pvPort, -scc.chargeCurrentA);
    if (node.loadPort) through(node.loadPort, scc.loadCurrentA);
    node.pv.strings.forEach((ids, j) => chain(ids, scc.stringCurrentsA[j] ?? 0));
  });
}
