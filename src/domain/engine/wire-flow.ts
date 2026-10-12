// Arus tiap kabel dan beda potensial antarterminal dari arus yang disuntikkan alat ke terminalnya
// (docs/MODEL_FISIKA.md §12 butir 1–2). Jaringan kabel dianggap pohon: arus tiap ruas langsung
// mengikuti hukum arus Kirchhoff. Ruas yang menutup lingkaran (kabel ganda) dianggap tanpa arus.
import { cableLoopResistanceOhm } from '../components/cable';
import { SWITCH_CATEGORIES } from '../circuit/bridges';
import type { CableItem, ComponentCategory } from '../types';
import type { Bridge, NetlistWire, TerminalRef } from '../circuit/types';

/** Resistivitas tembaga 20 °C untuk kabel yang tidak ada di katalog (MODEL_FISIKA §8.2). */
const FALLBACK_RESISTIVITY_OHM_MM2_PER_M = 0.0175;

/** Komponen yang arus lewatnya dilaporkan per komponen. */
const PASS_THROUGH: readonly ComponentCategory[] = [...SWITCH_CATEGORIES, 'kwh-meter'];

/** Ruas penghantar antara dua terminal: kabel (bertahanan) atau sambungan dalam komponen (0 Ω). */
export interface FlowEdge {
  from: string;
  to: string;
  resistanceOhm: number;
  wireId?: string;
  /** Komponen pemilik sambungan dalam (MCB, fuse, busbar, kWh meter). */
  componentId?: string;
}

export interface FlowResult {
  /** Potensial tiap terminal terhadap akar pulaunya; hanya selisih dalam satu net yang bermakna. */
  potentialV: Map<string, number>;
  /** Arus tiap ruas, searah `from` → `to`; urutannya sama dengan `edges`. */
  currentA: number[];
  /** Indeks ruas yang menutup lingkaran. */
  loopEdges: number[];
}

export function terminalKey(ref: TerminalRef): string {
  return `${ref.componentId}.${ref.terminalId}`;
}

/** Tahanan satu penghantar sepanjang `lengthM` (bukan pergi-pulang). */
export function wireResistanceOhm(
  wire: Pick<NetlistWire, 'areaMm2' | 'lengthM'>,
  cable: CableItem | undefined,
  conductorTempC: number,
): number {
  if (wire.areaMm2 <= 0) return 0;
  if (!cable)
    return (FALLBACK_RESISTIVITY_OHM_MM2_PER_M * Math.max(wire.lengthM, 0)) / wire.areaMm2;
  // `cableLoopResistanceOhm` menghitung pergi + pulang, jadi panjangnya dibagi dua.
  const run = { areaMm2: wire.areaMm2, lengthM: wire.lengthM / 2, conductorTempC };
  return cableLoopResistanceOhm(cable.electrical, run);
}

/** Ruas dari kabel netlist dan sambungan dalam komponen. */
export function buildFlowEdges(
  wires: readonly NetlistWire[],
  bridges: readonly Bridge[],
  cables: readonly CableItem[],
  conductorTempC: (wireId: string) => number,
): FlowEdge[] {
  const cableById = new Map(cables.map((cable) => [cable.id, cable]));
  const wireEdges = wires.map((wire): FlowEdge => {
    const resistanceOhm = wireResistanceOhm(
      wire,
      cableById.get(wire.cableId),
      conductorTempC(wire.id),
    );
    return {
      from: terminalKey(wire.from),
      to: terminalKey(wire.to),
      resistanceOhm,
      wireId: wire.id,
    };
  });
  const bridgeEdges = bridges.map((bridge): FlowEdge => {
    const componentId = bridge.from.componentId;
    return {
      from: terminalKey(bridge.from),
      to: terminalKey(bridge.to),
      resistanceOhm: 0,
      componentId,
    };
  });
  return [...wireEdges, ...bridgeEdges];
}

/**
 * Arus ruas dan potensial terminal untuk suntikan arus `injectionA` (A, positif = alat mendorong
 * arus ke terminal itu). Tiap pulau ditelusuri dari terminal pertamanya menurut abjad; selisih
 * suntikan yang tidak nol diserap akar pulau.
 */
export function solveFlow(
  edges: readonly FlowEdge[],
  injectionA: ReadonlyMap<string, number>,
): FlowResult {
  const adjacency = new Map<string, { edge: number; other: string }[]>();
  const link = (node: string, edge: number, other: string) => {
    const list = adjacency.get(node);
    if (list) list.push({ edge, other });
    else adjacency.set(node, [{ edge, other }]);
  };
  edges.forEach((edge, index) => {
    link(edge.from, index, edge.to);
    link(edge.to, index, edge.from);
  });

  const potentialV = new Map<string, number>();
  const currentA = edges.map(() => 0);
  const loopEdges: number[] = [];
  const parentEdge = new Map<string, { edge: number; parent: string }>();
  const usedEdges = new Set<number>();

  for (const root of [...adjacency.keys()].sort()) {
    if (potentialV.has(root)) continue;
    potentialV.set(root, 0);
    const order = [root];
    for (let i = 0; i < order.length; i += 1) {
      const node = order[i] ?? root;
      for (const { edge, other } of adjacency.get(node) ?? []) {
        if (usedEdges.has(edge)) continue;
        usedEdges.add(edge);
        if (potentialV.has(other)) {
          loopEdges.push(edge);
          continue;
        }
        potentialV.set(other, 0);
        parentEdge.set(other, { edge, parent: node });
        order.push(other);
      }
    }

    // Dari daun ke akar: arus ruas induk = jumlah suntikan di bawahnya.
    const subtreeA = new Map<string, number>();
    for (let i = order.length - 1; i > 0; i -= 1) {
      const node = order[i] ?? root;
      const up = parentEdge.get(node);
      if (!up) continue;
      const flowA = (subtreeA.get(node) ?? 0) + (injectionA.get(node) ?? 0);
      subtreeA.set(up.parent, (subtreeA.get(up.parent) ?? 0) + flowA);
      // `0 - x` supaya ruas tanpa arus bernilai 0, bukan -0.
      currentA[up.edge] = edges[up.edge]?.from === node ? flowA : 0 - flowA;
    }
    // Dari akar ke daun: arus mengalir dari potensial tinggi ke rendah.
    for (let i = 1; i < order.length; i += 1) {
      const node = order[i] ?? root;
      const up = parentEdge.get(node);
      const edge = up && edges[up.edge];
      if (!up || !edge) continue;
      const towardParentA = edge.from === node ? currentA[up.edge] : -(currentA[up.edge] ?? 0);
      const dropV = (towardParentA ?? 0) * edge.resistanceOhm;
      potentialV.set(node, (potentialV.get(up.parent) ?? 0) + dropV);
    }
  }
  return { potentialV, currentA, loopEdges: loopEdges.sort((a, b) => a - b) };
}

/** Beda potensial `a − b` dari hasil `solveFlow`; terminal tanpa kabel dianggap 0. */
export function potentialDiffV(
  flow: FlowResult | undefined,
  a: TerminalRef,
  b: TerminalRef,
): number {
  if (!flow) return 0;
  return (flow.potentialV.get(terminalKey(a)) ?? 0) - (flow.potentialV.get(terminalKey(b)) ?? 0);
}

export interface FlowSummary {
  /** Besar arus tiap kabel. */
  currentAByWireId: Record<string, number>;
  /** Arus bertanda tiap kabel: positif = dari `wire.from` ke `wire.to`. */
  flowAByWireId: Record<string, number>;
  /** Besar arus lewat MCB, fuse, dan kWh meter (kutub terbesar). */
  currentAByComponentId: Record<string, number>;
  voltageDropVByWireId: Record<string, number>;
  /** Kabel yang menutup lingkaran, urut menurut id. */
  loopWireIds: string[];
  /** Jumlah I²R semua kabel. */
  wireLossW: number;
}

/** Ringkasan aliran per kabel dan per komponen yang dilewati arus. */
export function summarizeFlow(
  edges: readonly FlowEdge[],
  flow: FlowResult,
  categoryById: ReadonlyMap<string, ComponentCategory>,
): FlowSummary {
  const summary: FlowSummary = {
    currentAByWireId: {},
    flowAByWireId: {},
    currentAByComponentId: {},
    voltageDropVByWireId: {},
    loopWireIds: flow.loopEdges.flatMap((i) => edges[i]?.wireId ?? []).sort(),
    wireLossW: 0,
  };
  edges.forEach((edge, i) => {
    const currentA = Math.abs(flow.currentA[i] ?? 0);
    if (edge.wireId !== undefined) {
      summary.currentAByWireId[edge.wireId] = currentA;
      // `|| 0` supaya nol tidak menjadi -0.
      summary.flowAByWireId[edge.wireId] = flow.currentA[i] || 0;
      summary.voltageDropVByWireId[edge.wireId] = currentA * edge.resistanceOhm;
      summary.wireLossW += currentA ** 2 * edge.resistanceOhm;
      return;
    }
    const category =
      edge.componentId === undefined ? undefined : categoryById.get(edge.componentId);
    if (edge.componentId === undefined || !category || !PASS_THROUGH.includes(category)) return;
    const previousA = summary.currentAByComponentId[edge.componentId] ?? 0;
    summary.currentAByComponentId[edge.componentId] = Math.max(previousA, currentA);
  });
  return summary;
}
