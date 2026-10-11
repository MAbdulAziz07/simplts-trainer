// Data bersama untuk aturan pemeriksaan rangkaian (validate-*.ts): netlist dengan sambungan dalam
// komponen, pencarian terminal per kategori, dan jumlah seri sumber di antara dua net.
import type { CatalogItem, ComponentCategory } from '../types';
import { deriveBridges, terminalPairs } from './bridges';
import type { TerminalPair } from './bridges';
import { buildNetlist, findNetId } from './graph';
import type {
  Finding,
  FindingCode,
  FindingSeverity,
  Net,
  Netlist,
  PlacedComponent,
  TerminalRef,
  ValidationInput,
  Wire,
} from './types';

/** Suhu sel terendah bawaan untuk Voc dingin (MODEL_FISIKA §3.3: Batam 20 °C). */
export const DEFAULT_MIN_CELL_TEMP_C = 20;

export interface ValidationContext {
  input: ValidationInput;
  /** Komponen tanpa id ganda, urut menurut id. */
  components: PlacedComponent[];
  byId: Map<string, PlacedComponent>;
  /** Netlist dengan semua MCB/fuse dianggap ON: salah rangkai terlihat sebelum dihidupkan. */
  design: Netlist;
  /** Netlist menurut keadaan MCB/fuse saat ini. */
  live: Netlist;
  minCellTempC: number;
  /** Kunci `componentId.terminalId` untuk terminal yang dipasangi kabel. */
  wired: Set<string>;
}

export type Rule = (ctx: ValidationContext) => Finding[];

type PlacedOf<C extends ComponentCategory> = PlacedComponent & {
  item: Extract<CatalogItem, { category: C }>;
};

export function terminalKey(ref: TerminalRef): string {
  return `${ref.componentId}.${ref.terminalId}`;
}

export function liveNetlist(
  components: readonly PlacedComponent[],
  wires: readonly Wire[],
  closedSwitchIds?: readonly string[],
): Netlist {
  return buildNetlist(components, wires, deriveBridges(components, closedSwitchIds));
}

export function buildContext(input: ValidationInput): ValidationContext {
  const byId = new Map<string, PlacedComponent>();
  for (const component of input.components) {
    if (!byId.has(component.id)) byId.set(component.id, component);
  }
  const components = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const design = liveNetlist(components, input.wires);
  const wired = new Set<string>();
  for (const wire of design.wires) wired.add(terminalKey(wire.from)).add(terminalKey(wire.to));
  return {
    input,
    components,
    byId,
    design,
    live: liveNetlist(components, input.wires, input.closedSwitchIds),
    minCellTempC: input.minCellTempC ?? DEFAULT_MIN_CELL_TEMP_C,
    wired,
  };
}

export function ofCategory<C extends ComponentCategory>(
  ctx: ValidationContext,
  ...categories: C[]
): PlacedOf<C>[] {
  const wanted: readonly ComponentCategory[] = categories;
  return ctx.components.filter((component): component is PlacedOf<C> =>
    wanted.includes(component.item.category),
  );
}

export function netOf(
  netlist: Netlist,
  componentId: string,
  terminalId: string,
): string | undefined {
  return findNetId(netlist, { componentId, terminalId });
}

const netIndex = new WeakMap<Netlist, Map<string, Net>>();

/** Terminal di dalam net yang komponennya termasuk `categories`. */
export function terminalsInNet(
  ctx: ValidationContext,
  netlist: Netlist,
  netId: string | undefined,
  categories: readonly ComponentCategory[],
): TerminalRef[] {
  let index = netIndex.get(netlist);
  if (!index) {
    index = new Map(netlist.nets.map((net) => [net.id, net]));
    netIndex.set(netlist, index);
  }
  const net = netId === undefined ? undefined : index.get(netId);
  return (net?.terminals ?? []).filter((ref) => {
    const category = ctx.byId.get(ref.componentId)?.item.category;
    return category !== undefined && categories.includes(category);
  });
}

/** Pasangan kutub sebuah komponen: `pos`/`neg`, `l`/`n`, dan `a`/`b` pada beban. */
export function polePairs(item: CatalogItem): TerminalPair[] {
  const pairs = [...terminalPairs(item.terminals, 'polar'), ...terminalPairs(item.terminals, 'ac')];
  const ids = item.terminals.map((terminal) => terminal.id);
  if (ids.includes('a') && ids.includes('b')) pairs.push({ name: '', first: 'a', second: 'b' });
  return pairs;
}

/** Sumber sebagai sisi dari net kutub negatif ke net kutub positif. */
export interface SeriesEdge {
  id: string;
  negNet: string;
  posNet: string;
  value: number;
}

export function sourceEdges<C extends ComponentCategory>(
  ctx: ValidationContext,
  netlist: Netlist,
  category: C,
  valueOf: (item: Extract<CatalogItem, { category: C }>) => number,
): SeriesEdge[] {
  const edges: SeriesEdge[] = [];
  for (const { id, item } of ofCategory(ctx, category)) {
    const posNet = netOf(netlist, id, 'pos');
    const negNet = netOf(netlist, id, 'neg');
    if (posNet && negNet) edges.push({ id, negNet, posNet, value: valueOf(item) });
  }
  return edges;
}

export interface SeriesSum {
  sum: number;
  ids: string[];
}

/** Jumlah `value` terbesar pada jalur seri dari `negNet` ke `posNet`; `undefined` bila tak ada. */
export function seriesPath(
  edges: readonly SeriesEdge[],
  negNet: string | undefined,
  posNet: string | undefined,
): SeriesSum | undefined {
  if (negNet === undefined || posNet === undefined || negNet === posNet) return undefined;
  const found: SeriesSum[] = [];
  const visit = (net: string, sum: number, ids: string[], seen: ReadonlySet<string>): void => {
    if (net === posNet) {
      found.push({ sum, ids });
      return;
    }
    for (const edge of edges) {
      if (edge.negNet !== net || seen.has(edge.posNet)) continue;
      visit(edge.posNet, sum + edge.value, [...ids, edge.id], new Set(seen).add(edge.posNet));
    }
  };
  visit(negNet, 0, [], new Set([negNet]));
  return found.reduce<SeriesSum | undefined>(
    (best, path) => (best && best.sum >= path.sum ? best : path),
    undefined,
  );
}

export function finding(
  code: FindingCode,
  severity: FindingSeverity,
  componentIds: Iterable<string>,
  extra: Omit<Finding, 'code' | 'severity' | 'componentIds'> = {},
): Finding {
  return { code, severity, componentIds: [...new Set(componentIds)].sort(), ...extra };
}
