// Boleh-tidaknya sebuah kabel dipasang di meja kerja (docs/PRD.md §2 "Aturan terminal", US3).
// Penolakan mekanis berlaku di semua tingkat; penolakan elektris hanya di tingkat pemula.
import type { ComponentCategory, TerminalKind } from '../types';
import type { CircuitComponent, TerminalRef, Wire } from './types';

/** `beginner` menolak sambungan mustahil; `expert` membiarkan akibatnya terlihat di simulasi. */
export const CONNECTION_LEVELS = ['beginner', 'expert'] as const;
export type ConnectionLevel = (typeof CONNECTION_LEVELS)[number];

export const CONDUCTOR_GROUPS = [
  'positive',
  'negative',
  'line',
  'neutral',
  'earth',
  'data',
] as const;
export type ConductorGroup = (typeof CONDUCTOR_GROUPS)[number];

const GROUP_BY_KIND: Record<TerminalKind, ConductorGroup> = {
  'pv+': 'positive',
  'dc+': 'positive',
  'pv-': 'negative',
  'dc-': 'negative',
  acL: 'line',
  acN: 'neutral',
  pe: 'earth',
  data: 'data',
};

/** Golongan penghantar sebuah terminal; PV dan DC berkutub sama segolongan. */
export function conductorGroup(kind: TerminalKind): ConductorGroup {
  return GROUP_BY_KIND[kind];
}

export const MECHANICAL_REJECTIONS = [
  'unknown-terminal',
  'same-terminal',
  'duplicate-wire',
  'terminal-full',
] as const;
export const ELECTRICAL_REJECTIONS = [
  'data',
  'earth',
  'dc-ac',
  'polarity',
  'line-neutral',
] as const;
export const CONNECTION_REJECTIONS = [...MECHANICAL_REJECTIONS, ...ELECTRICAL_REJECTIONS] as const;
export type ConnectionRejection = (typeof CONNECTION_REJECTIONS)[number];

/** Sumber yang boleh dideret: kutub + ke kutub − komponen sejenis yang lain. */
export const SERIES_CATEGORIES: readonly ComponentCategory[] = ['pv-module', 'battery'];

export interface ConnectionInput {
  components: readonly CircuitComponent[];
  /** Kabel yang sudah terpasang. */
  wires: readonly Pick<Wire, 'from' | 'to'>[];
  from: TerminalRef;
  to: TerminalRef;
  level: ConnectionLevel;
}

export interface ConnectionCheck {
  ok: boolean;
  /** Kosong bila `ok`. Teks tampilannya ada di src/i18n/id.ts per alasan. */
  reason?: ConnectionRejection;
  /** Terminal penyebab, mis. yang penuh. */
  terminal?: TerminalRef;
}

const sameRef = (a: TerminalRef, b: TerminalRef): boolean =>
  a.componentId === b.componentId && a.terminalId === b.terminalId;

function findTerminal(components: readonly CircuitComponent[], ref: TerminalRef) {
  const component = components.find((candidate) => candidate.id === ref.componentId);
  const terminal = component?.item.terminals.find((candidate) => candidate.id === ref.terminalId);
  return component && terminal ? { component, terminal } : undefined;
}

function electricalRejection(
  a: NonNullable<ReturnType<typeof findTerminal>>,
  b: NonNullable<ReturnType<typeof findTerminal>>,
): ConnectionRejection | undefined {
  const groups = [conductorGroup(a.terminal.kind), conductorGroup(b.terminal.kind)];
  if (groups[0] === groups[1]) return undefined;
  const has = (group: ConductorGroup): boolean => groups.includes(group);
  if (has('data')) return 'data';
  if (has('earth')) return 'earth';
  const isDc = (group: ConductorGroup | undefined): boolean =>
    group === 'positive' || group === 'negative';
  if (isDc(groups[0]) !== isDc(groups[1])) return 'dc-ac';
  if (has('line')) return 'line-neutral';
  const inSeries =
    a.component.id !== b.component.id &&
    a.component.item.category === b.component.item.category &&
    SERIES_CATEGORIES.includes(a.component.item.category);
  return inSeries ? undefined : 'polarity';
}

/** Memeriksa satu kabel baru dari `from` ke `to` terhadap rangkaian yang ada. */
export function checkConnection(input: ConnectionInput): ConnectionCheck {
  const { components, wires, from, to, level } = input;
  const a = findTerminal(components, from);
  const b = findTerminal(components, to);
  if (!a) return { ok: false, reason: 'unknown-terminal', terminal: from };
  if (!b) return { ok: false, reason: 'unknown-terminal', terminal: to };
  if (sameRef(from, to)) return { ok: false, reason: 'same-terminal', terminal: from };

  const isDuplicate = wires.some(
    (wire) =>
      (sameRef(wire.from, from) && sameRef(wire.to, to)) ||
      (sameRef(wire.from, to) && sameRef(wire.to, from)),
  );
  if (isDuplicate) return { ok: false, reason: 'duplicate-wire' };

  for (const [ref, found] of [
    [from, a],
    [to, b],
  ] as const) {
    const used = wires.filter((wire) => sameRef(wire.from, ref) || sameRef(wire.to, ref)).length;
    if (used >= found.terminal.maxWires)
      return { ok: false, reason: 'terminal-full', terminal: ref };
  }

  if (level === 'expert') return { ok: true };
  const reason = electricalRejection(a, b);
  return reason ? { ok: false, reason } : { ok: true };
}
