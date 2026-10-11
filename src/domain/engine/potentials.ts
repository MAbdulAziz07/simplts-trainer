// Potensial tiap terminal dan net dari bacaan alat dan jatuh tegangan kabel, supaya alat ukur bisa
// ditempel di dua terminal sembarang. Acuan 0 V: kutub negatif bank baterai tiap bus DC dan netral
// sumber tiap bus AC. Bila dua jalur memberi nilai berbeda, yang lebih dulu tercapai dipakai.
import type { Port } from '../circuit/subsystem-types';
import type { TerminalRef } from '../circuit/types';
import { bankPort } from './solve-dc';
import type { SolvedSystem } from './solver';
import type { CircuitPotentials } from './step-types';
import type { OperatingPoint, Reading } from './types';
import { terminalKey } from './wire-flow';

/** `potensial(a) − potensial(b) = diffV`. `weak` = hanya dipakai untuk terminal yang belum bernilai. */
interface Link {
  a: string;
  b: string;
  diffV: number;
  weak: boolean;
}

const polar = (componentId: string): Port => ({
  pos: { componentId, terminalId: 'pos' },
  neg: { componentId, terminalId: 'neg' },
});

/** Hubungan tegangan dari bacaan alat; alat tanpa tegangan (0 V) menjadi hubungan lemah. */
function deviceLinks(solved: SolvedSystem, point: OperatingPoint): Link[] {
  const { topology } = solved.input;
  const links: Link[] = [];
  const across = (port: Port, voltageV: number) =>
    links.push({
      a: terminalKey(port.pos),
      b: terminalKey(port.neg),
      diffV: voltageV,
      weak: voltageV === 0,
    });
  const tie = (a: TerminalRef, b: TerminalRef) =>
    links.push({ a: terminalKey(a), b: terminalKey(b), diffV: 0, weak: false });

  for (const [id, battery] of Object.entries(point.batteries)) across(polar(id), battery.voltageV);
  for (const [id, module] of Object.entries(point.pvModules)) across(polar(id), module.voltageV);
  for (const node of topology.sccs) {
    const scc = point.sccs[node.id];
    if (!scc || scc.status === 'no-battery') continue;
    across(node.batPort, scc.batteryVoltageV);
    across(node.pvPort, scc.pvVoltageV);
    // SCC dianggap negatif-bersama: PV−, BAT−, dan LOAD− satu potensial. [PERLU VERIFIKASI]
    tie(node.pvPort.neg, node.batPort.neg);
    if (!node.loadPort) continue;
    tie(node.loadPort.neg, node.batPort.neg);
    const isConnected = solved.state.sccById?.[node.id]?.loadConnected !== false;
    if (isConnected) tie(node.loadPort.pos, node.batPort.pos);
  }
  for (const consumer of topology.dcConsumers) {
    const voltageV =
      consumer.category === 'inverter-offgrid'
        ? point.inverters[consumer.id]?.dcVoltageV
        : point.loads[consumer.id]?.voltageV;
    across(consumer.port, voltageV ?? 0);
  }
  for (const bus of topology.acBuses) {
    const busPoint = point.acBuses.find((candidate) => candidate.id === bus.id);
    for (const source of bus.sources) {
      const isActive = source.id === busPoint?.sourceId;
      across(source.port, isActive ? (busPoint?.voltageV ?? 0) : 0);
    }
    for (const load of bus.loads) across(load.port, point.loads[load.id]?.voltageV ?? 0);
  }
  return links;
}

/** Hubungan di dalam jaringan kabel dari hasil `solveFlow`. */
function flowLinks(solved: SolvedSystem): Link[] {
  const { potentialV } = solved.flow;
  return solved.edges.map((edge) => ({
    a: edge.from,
    b: edge.to,
    diffV: (potentialV.get(edge.from) ?? 0) - (potentialV.get(edge.to) ?? 0),
    weak: false,
  }));
}

/** Titik acuan 0 V, urut prioritas. */
function referenceKeys(solved: SolvedSystem, point: OperatingPoint): string[] {
  const { topology } = solved.input;
  const keys = topology.dcBuses.map((bus) => terminalKey(bankPort(bus).neg));
  for (const bus of topology.acBuses) {
    const activeId = point.acBuses.find((candidate) => candidate.id === bus.id)?.sourceId;
    const source = bus.sources.find((candidate) => candidate.id === activeId) ?? bus.sources[0];
    if (source) keys.push(terminalKey(source.port.neg));
  }
  return keys;
}

function solvePotentials(links: readonly Link[], references: readonly string[]) {
  const potentialV = new Map<string, number>();
  const adjacency = new Map<string, { other: string; stepV: number }[]>();
  const connect = (from: string, other: string, stepV: number) => {
    const list = adjacency.get(from);
    if (list) list.push({ other, stepV });
    else adjacency.set(from, [{ other, stepV }]);
  };
  const add = (link: Link) => {
    connect(link.a, link.b, -link.diffV);
    connect(link.b, link.a, link.diffV);
  };
  const spread = (seeds: readonly string[]) => {
    const queue = [...seeds];
    for (let i = 0; i < queue.length; i += 1) {
      const node = queue[i] ?? '';
      const baseV = potentialV.get(node) ?? 0;
      for (const { other, stepV } of adjacency.get(node) ?? []) {
        if (potentialV.has(other)) continue;
        potentialV.set(other, baseV + stepV);
        queue.push(other);
      }
    }
  };
  const seed = (key: string) => {
    if (potentialV.has(key)) return;
    potentialV.set(key, 0);
    spread([key]);
  };

  const strong = links.filter((link) => !link.weak);
  strong.forEach(add);
  references.forEach(seed);
  // Sumber yang tidak terhubung ke acuan mana pun (mis. modul PV lepas): kutub negatifnya 0 V.
  for (const link of strong) {
    const isSource = link.diffV !== 0;
    if (isSource && !potentialV.has(link.a) && !potentialV.has(link.b)) seed(link.b);
  }
  links.filter((link) => link.weak).forEach(add);
  spread([...potentialV.keys()]);
  return potentialV;
}

/** Arus yang keluar dari tiap terminal ke kabel yang menempel padanya. */
function wireOutflowA(solved: SolvedSystem): Map<string, number> {
  const outflowA = new Map<string, number>();
  solved.edges.forEach((edge, i) => {
    if (edge.wireId === undefined) return;
    const currentA = solved.flow.currentA[i] ?? 0;
    outflowA.set(edge.from, (outflowA.get(edge.from) ?? 0) + currentA);
    outflowA.set(edge.to, (outflowA.get(edge.to) ?? 0) - currentA);
  });
  return outflowA;
}

/**
 * V, I, P tiap terminal dan tiap net. Terminal yang tidak tersambung ke sumber mana pun berstatus
 * `floating` dengan tegangan 0.
 */
export function readPotentials(solved: SolvedSystem, point: OperatingPoint): CircuitPotentials {
  const { topology } = solved.input;
  const links = [...flowLinks(solved), ...deviceLinks(solved, point)];
  const potentialV = solvePotentials(links, referenceKeys(solved, point));
  const outflowA = wireOutflowA(solved);

  const terminals: CircuitPotentials['terminals'] = {};
  for (const { id, item } of topology.components) {
    for (const terminal of item.terminals) {
      const key = terminalKey({ componentId: id, terminalId: terminal.id });
      const voltageV = potentialV.get(key);
      // `|| 0` supaya nol tidak menjadi -0.
      const currentA = outflowA.get(key) || 0;
      terminals[key] = {
        voltageV: voltageV ?? 0,
        currentA,
        powerW: (voltageV ?? 0) * currentA || 0,
        floating: voltageV === undefined,
      };
    }
  }

  const nets: Record<string, Reading> = {};
  for (const net of topology.netlist.nets) {
    const known = net.terminals.flatMap((ref) => potentialV.get(terminalKey(ref)) ?? []);
    const voltageV = known.length > 0 ? known.reduce((sumV, v) => sumV + v, 0) / known.length : 0;
    nets[net.id] = { voltageV, currentA: 0, powerW: 0 };
  }
  for (const wire of topology.netlist.wires) {
    const net = nets[wire.netId];
    if (!net) continue;
    net.currentA = Math.max(net.currentA, point.currentAByWireId[wire.id] ?? 0);
    net.powerW = net.voltageV * net.currentA || 0;
  }
  return { nets, terminals };
}
