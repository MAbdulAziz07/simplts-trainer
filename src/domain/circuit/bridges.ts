// Sambungan di dalam komponen menjadi `Bridge` untuk `buildNetlist`: kontak MCB/fuse tertutup,
// rel busbar, jalur kWh meter, combiner, BMS, dan panel beban. Nama terminal mengikuti katalog.
import type { ComponentCategory, Terminal } from '../types';
import type { Bridge, CircuitComponent } from './types';

/** Sakelar: jalur `-in` → `-out` hanya tersambung bila ON. */
export const SWITCH_CATEGORIES: readonly ComponentCategory[] = ['mcb-dc', 'mcb-ac', 'fuse'];
/** Jalur `-in` → `-out` yang selalu tersambung. */
const THROUGH_CATEGORIES: readonly ComponentCategory[] = ['kwh-meter'];

const PAIR_SUFFIXES = {
  polar: ['pos', 'neg'],
  ac: ['l', 'n'],
  through: ['in', 'out'],
} as const;
export type TerminalPairKind = keyof typeof PAIR_SUFFIXES;

export interface TerminalPair {
  /** Awalan nama terminal, mis. `bat` untuk `bat-pos`/`bat-neg`; kosong untuk `pos`/`neg`. */
  name: string;
  first: string;
  second: string;
}

/** Pasangan terminal menurut akhiran nama: `pos`/`neg`, `l`/`n`, atau `in`/`out`. */
export function terminalPairs(
  terminals: readonly Pick<Terminal, 'id'>[],
  kind: TerminalPairKind,
): TerminalPair[] {
  const [firstSuffix, secondSuffix] = PAIR_SUFFIXES[kind];
  const ids = new Set(terminals.map((terminal) => terminal.id));
  const pairs: TerminalPair[] = [];
  for (const { id } of terminals) {
    const isBare = id === firstSuffix;
    if (!isBare && !id.endsWith(`-${firstSuffix}`)) continue;
    const name = isBare ? '' : id.slice(0, -firstSuffix.length - 1);
    const second = isBare ? secondSuffix : `${name}-${secondSuffix}`;
    if (ids.has(second)) pairs.push({ name, first: id, second });
  }
  return pairs;
}

function internalLinks(component: CircuitComponent, isClosed: boolean): [string, string][] {
  const { category, terminals } = component.item;
  const through = (): [string, string][] =>
    terminalPairs(terminals, 'through').map((pair) => [pair.first, pair.second]);
  const fanOut = (hubId: string, suffix: string): [string, string][] =>
    terminals
      .filter((terminal) => terminal.id !== hubId && terminal.id.endsWith(suffix))
      .map((terminal) => [hubId, terminal.id]);

  if (SWITCH_CATEGORIES.includes(category)) return isClosed ? through() : [];
  if (THROUGH_CATEGORIES.includes(category)) return through();
  switch (category) {
    case 'busbar':
      return terminals.slice(1).map((terminal) => [terminals[0]?.id ?? '', terminal.id]);
    case 'combiner':
      return [...fanOut('out-pos', '-pos'), ...fanOut('out-neg', '-neg')];
    case 'load-panel':
      return [...fanOut('in-l', '-l'), ...fanOut('in-n', '-n')];
    case 'bms':
      return [
        ['bat-pos', 'sys-pos'],
        ['bat-neg', 'sys-neg'],
      ];
    default:
      return [];
  }
}

/**
 * Sambungan dalam semua komponen. `closedSwitchIds` berisi MCB/fuse yang ON; tanpa nilai berarti
 * semua ON. `only` membatasi kategori yang diturunkan.
 */
export function deriveBridges(
  components: readonly CircuitComponent[],
  closedSwitchIds?: readonly string[],
  only?: readonly ComponentCategory[],
): Bridge[] {
  const closed = closedSwitchIds && new Set(closedSwitchIds);
  const bridges: Bridge[] = [];
  for (const component of components) {
    if (only && !only.includes(component.item.category)) continue;
    const isClosed = closed ? closed.has(component.id) : true;
    for (const [from, to] of internalLinks(component, isClosed)) {
      bridges.push({
        from: { componentId: component.id, terminalId: from },
        to: { componentId: component.id, terminalId: to },
      });
    }
  }
  return bridges;
}
