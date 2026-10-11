// Komponen dan kabel menjadi netlist: terminal yang tersambung digabung menjadi satu net
// (docs/MODEL_FISIKA.md §12 butir 1). Kabel menggabungkan net; tahanannya dihitung engine dari
// `netlist.wires`. Hasil tidak bergantung pada urutan masukan.
import { TERMINAL_KINDS } from '../types';
import type { TerminalKind } from '../types';
import type {
  Bridge,
  CircuitComponent,
  Net,
  Netlist,
  NetlistIssue,
  NetlistWire,
  TerminalRef,
  Wire,
} from './types';

interface TerminalNode {
  ref: TerminalRef;
  kind: TerminalKind;
  maxWires: number;
  wireCount: number;
}

function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function findRoot(parents: number[], index: number): number {
  let root = index;
  while (parents[root] !== root) root = parents[root] ?? root;
  let current = index;
  while (current !== root) {
    const next = parents[current] ?? root;
    parents[current] = root;
    current = next;
  }
  return root;
}

/** Akar selalu indeks terkecil, sehingga urutan net mengikuti urutan terminal. */
function union(parents: number[], a: number, b: number): void {
  const rootA = findRoot(parents, a);
  const rootB = findRoot(parents, b);
  parents[Math.max(rootA, rootB)] = Math.min(rootA, rootB);
}

/**
 * Membangun netlist. Terminal tanpa kabel menjadi net berisi satu terminal. Salah rangkai tidak
 * melempar galat tetapi dicatat di `issues`; kabel ke komponen/terminal tak dikenal dan kabel
 * ke terminal yang sama dilewati.
 */
export function buildNetlist(
  components: readonly CircuitComponent[],
  wires: readonly Wire[],
  bridges: readonly Bridge[] = [],
): Netlist {
  const issues: NetlistIssue[] = [];
  const nodes: TerminalNode[] = [];
  const indexByComponent = new Map<string, Map<string, number>>();

  for (const component of [...components].sort(byId)) {
    if (indexByComponent.has(component.id)) {
      issues.push({ code: 'duplicate-component', componentId: component.id });
      continue;
    }
    const indexByTerminal = new Map<string, number>();
    for (const terminal of component.item.terminals) {
      indexByTerminal.set(terminal.id, nodes.length);
      nodes.push({
        ref: { componentId: component.id, terminalId: terminal.id },
        kind: terminal.kind,
        maxWires: terminal.maxWires,
        wireCount: 0,
      });
    }
    indexByComponent.set(component.id, indexByTerminal);
  }

  const resolve = (ref: TerminalRef, wireId?: string): number | undefined => {
    const indexByTerminal = indexByComponent.get(ref.componentId);
    const index = indexByTerminal?.get(ref.terminalId);
    if (index === undefined) {
      const code = indexByTerminal ? 'unknown-terminal' : 'unknown-component';
      issues.push({ code, terminal: ref, ...(wireId !== undefined && { wireId }) });
    }
    return index;
  };

  const parents = nodes.map((_, index) => index);
  const seenPairs = new Set<string>();
  const joined: { wire: Wire; index: number }[] = [];

  for (const wire of [...wires].sort(byId)) {
    const from = resolve(wire.from, wire.id);
    const to = resolve(wire.to, wire.id);
    if (from === undefined || to === undefined) continue;
    if (from === to) {
      issues.push({ code: 'self-loop', wireId: wire.id, terminal: wire.from });
      continue;
    }
    const pair = `${Math.min(from, to)}-${Math.max(from, to)}`;
    if (seenPairs.has(pair)) issues.push({ code: 'duplicate-wire', wireId: wire.id });
    seenPairs.add(pair);
    for (const index of [from, to]) {
      const node = nodes[index];
      if (node) node.wireCount += 1;
    }
    union(parents, from, to);
    joined.push({ wire, index: from });
  }

  for (const bridge of bridges) {
    const from = resolve(bridge.from);
    const to = resolve(bridge.to);
    if (from !== undefined && to !== undefined) union(parents, from, to);
  }

  const netByRoot = new Map<number, Net>();
  const netIdByTerminal: Netlist['netIdByTerminal'] = {};
  nodes.forEach((node, index) => {
    if (node.wireCount > node.maxWires) issues.push({ code: 'too-many-wires', terminal: node.ref });
    const root = findRoot(parents, index);
    let net = netByRoot.get(root);
    if (!net) {
      net = { id: `n${netByRoot.size + 1}`, terminals: [], kinds: [] };
      netByRoot.set(root, net);
    }
    net.terminals.push(node.ref);
    if (!net.kinds.includes(node.kind)) net.kinds.push(node.kind);
    (netIdByTerminal[node.ref.componentId] ??= {})[node.ref.terminalId] = net.id;
  });

  const nets = [...netByRoot.values()];
  for (const net of nets) {
    net.kinds.sort((a, b) => TERMINAL_KINDS.indexOf(a) - TERMINAL_KINDS.indexOf(b));
  }
  const netlistWires = joined.map(({ wire, index }): NetlistWire => ({
    ...wire,
    netId: netByRoot.get(findRoot(parents, index))?.id ?? '',
  }));

  return { nets, netIdByTerminal, wires: netlistWires, issues };
}

/** Id net sebuah terminal; `undefined` bila terminal tidak ada di netlist. */
export function findNetId(netlist: Netlist, ref: TerminalRef): string | undefined {
  return netlist.netIdByTerminal[ref.componentId]?.[ref.terminalId];
}
