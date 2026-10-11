// Pengenalan subsistem dari topologi: array PV → pengendali → bus baterai → inverter → bus AC →
// beban/jaringan (docs/MODEL_FISIKA.md §12). Hasilnya dipakai engine/solver.ts; di sini tidak ada
// hitungan listrik. MCB/fuse mengikuti `closedSwitchIds`, jadi rantai yang diputus tidak dikenali.
import type { ComponentCategory } from '../types';
import { deriveBridges } from './bridges';
import { buildNetlist, findNetId } from './graph';
import { AC_SOURCE_CATEGORIES } from './subsystem-types';
import type {
  AcBus,
  AcSourceCategory,
  DcBus,
  DcConsumer,
  Port,
  SccNode,
  SourceBank,
  SystemTopology,
} from './subsystem-types';
import type { Netlist, PlacedComponent, Wire } from './types';

const UNSUPPORTED: readonly ComponentCategory[] = [
  'scc-mppt',
  'inverter-gridtie',
  'inverter-hybrid',
];
/** Port keluaran/masukan AC per kategori sumber: `[fasa, netral]`. */
const AC_PORTS: Record<AcSourceCategory, [string, string][]> = {
  'inverter-offgrid': [['ac-l', 'ac-n']],
  'inverter-gridtie': [['ac-l', 'ac-n']],
  'inverter-hybrid': [
    ['grid-l', 'grid-n'],
    ['load-l', 'load-n'],
  ],
  grid: [['l', 'n']],
};
const MAX_STRINGS = 32;

interface SourceEdge {
  id: string;
  negNet: string;
  posNet: string;
}
type NetPair = [pos: string, neg: string];

function port(componentId: string, posId: string, negId: string): Port {
  return { pos: { componentId, terminalId: posId }, neg: { componentId, terminalId: negId } };
}

function netPair(netlist: Netlist, { pos, neg }: Port): NetPair | undefined {
  const posNet = findNetId(netlist, pos);
  const negNet = findNetId(netlist, neg);
  return posNet !== undefined && negNet !== undefined && posNet !== negNet
    ? [posNet, negNet]
    : undefined;
}

function sourceEdges(
  components: readonly PlacedComponent[],
  netlist: Netlist,
  category: ComponentCategory,
): SourceEdge[] {
  return components.flatMap(({ id, item }) => {
    const pair = item.category === category ? netPair(netlist, port(id, 'pos', 'neg')) : undefined;
    return pair ? [{ id, posNet: pair[0], negNet: pair[1] }] : [];
  });
}

/** Semua jalur seri dari `negNet` ke `posNet`; tiap jalur menjadi satu string. */
function sourceBank(edges: readonly SourceEdge[], pair: NetPair | undefined): SourceBank {
  const strings: string[][] = [];
  if (!pair) return { strings, irregular: false };
  const [posNet, negNet] = pair;
  const visit = (net: string, ids: string[], seen: ReadonlySet<string>): void => {
    if (net === posNet) {
      if (strings.length < MAX_STRINGS) strings.push(ids);
      return;
    }
    for (const edge of edges) {
      if (edge.negNet !== net || seen.has(edge.posNet)) continue;
      visit(edge.posNet, [...ids, edge.id], new Set(seen).add(edge.posNet));
    }
  };
  visit(negNet, [], new Set([negNet]));
  const used = strings.flat();
  return { strings, irregular: new Set(used).size !== used.length };
}

const pairKey = (pair: NetPair) => `${pair[0]}|${pair[1]}`;

/**
 * Mengenali bus baterai, SCC beserta array PV-nya, pemakai DC, dan bus AC. Rantai yang terputus
 * tidak melempar galat: alatnya tetap terdaftar tanpa `busId`. Tidak bergantung urutan masukan.
 */
export function recognizeSubsystems(
  placed: readonly PlacedComponent[],
  wires: readonly Wire[],
  closedSwitchIds?: readonly string[],
): SystemTopology {
  const unique = new Map<string, PlacedComponent>();
  for (const component of placed)
    if (!unique.has(component.id)) unique.set(component.id, component);
  const components = [...unique.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const bridges = deriveBridges(components, closedSwitchIds);
  const netlist = buildNetlist(components, wires, bridges);
  const batteryEdges = sourceEdges(components, netlist, 'battery');
  const pvEdges = sourceEdges(components, netlist, 'pv-module');

  const dcBuses: DcBus[] = [];
  const busIdByKey = new Map<string, string | undefined>();
  /** Bus pada pasangan net ini; dibuat bila ada baterai di antaranya. */
  const busAt = (pair: NetPair | undefined): string | undefined => {
    if (!pair) return undefined;
    const key = pairKey(pair);
    if (busIdByKey.has(key)) return busIdByKey.get(key);
    const battery = sourceBank(batteryEdges, pair);
    const id = battery.strings.length > 0 ? `dc${dcBuses.length + 1}` : undefined;
    if (id) dcBuses.push({ id, posNetId: pair[0], negNetId: pair[1], battery });
    busIdByKey.set(key, id);
    return id;
  };

  const sccs: SccNode[] = [];
  const sccIdByLoadKey = new Map<string, string>();
  for (const { id, item } of components) {
    if (item.category !== 'scc-pwm' && item.category !== 'scc-mppt') continue;
    const pvPort = port(id, 'pv-pos', 'pv-neg');
    const batPort = port(id, 'bat-pos', 'bat-neg');
    const node: SccNode = {
      id,
      category: item.category,
      pv: sourceBank(pvEdges, netPair(netlist, pvPort)),
      pvPort,
      batPort,
    };
    const busId = busAt(netPair(netlist, batPort));
    if (busId) node.busId = busId;
    if (item.category === 'scc-pwm') {
      node.loadPort = port(id, 'load-pos', 'load-neg');
      const loadPair = netPair(netlist, node.loadPort);
      if (loadPair) sccIdByLoadKey.set(pairKey(loadPair), id);
    }
    sccs.push(node);
  }

  const dcConsumers: DcConsumer[] = [];
  for (const { id, item } of components) {
    if (item.category !== 'load-dc' && item.category !== 'inverter-offgrid') continue;
    const isLoad = item.category === 'load-dc';
    // Beban resistif tidak berpolaritas: kedua arah pemasangan dicoba.
    const ports = isLoad
      ? [port(id, 'a', 'b'), port(id, 'b', 'a')]
      : [port(id, 'dc-pos', 'dc-neg')];
    const consumer: DcConsumer = {
      id,
      category: item.category,
      port: ports[0] ?? port(id, '', ''),
    };
    for (const candidate of ports) {
      const pair = netPair(netlist, candidate);
      const sccId = pair && sccIdByLoadKey.get(pairKey(pair));
      const busId = sccId ? undefined : busAt(pair);
      if (!sccId && !busId) continue;
      consumer.port = candidate;
      if (sccId) consumer.sccId = sccId;
      if (busId) consumer.busId = busId;
      break;
    }
    dcConsumers.push(consumer);
  }

  const acBuses: AcBus[] = [];
  const acBusByKey = new Map<string, AcBus>();
  for (const { id, item } of components) {
    const category = AC_SOURCE_CATEGORIES.find((candidate) => candidate === item.category);
    if (!category) continue;
    for (const [lineId, neutralId] of AC_PORTS[category]) {
      const sourcePort = port(id, lineId, neutralId);
      const pair = netPair(netlist, sourcePort);
      if (!pair) continue;
      let bus = acBusByKey.get(pairKey(pair));
      if (!bus) {
        const [lineNetId, neutralNetId] = pair;
        bus = { id: `ac${acBuses.length + 1}`, lineNetId, neutralNetId, sources: [], loads: [] };
        acBusByKey.set(pairKey(pair), bus);
        acBuses.push(bus);
      }
      bus.sources.push({ id, category, port: sourcePort });
    }
  }
  const idleAcLoadIds: string[] = [];
  for (const { id, item } of components) {
    if (item.category !== 'load-ac') continue;
    const fed = [port(id, 'a', 'b'), port(id, 'b', 'a')].some((candidate) => {
      const pair = netPair(netlist, candidate);
      const bus = pair && acBusByKey.get(pairKey(pair));
      bus?.loads.push({ id, port: candidate });
      return bus !== undefined;
    });
    if (!fed) idleAcLoadIds.push(id);
  }

  const unsupportedIds = components
    .filter(({ item }) => UNSUPPORTED.includes(item.category))
    .map(({ id }) => id);
  return {
    components,
    netlist,
    bridges,
    dcBuses,
    sccs,
    dcConsumers,
    acBuses,
    idleAcLoadIds,
    unsupportedIds,
  };
}
