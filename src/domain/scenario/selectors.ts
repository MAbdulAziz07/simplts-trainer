// Penunjuk komponen dan terminal di skenario, dan pemeriksaan "dua terminal tersambung".
import { deriveBridges } from '../circuit/bridges';
import { buildNetlist, findNetId } from '../circuit/graph';
import type { PlacedComponent, TerminalRef, Wire } from '../circuit/types';
import type { ComponentCategory } from '../types';
import type { ComponentSelector, TerminalSelector } from './types';

/** Alias kelompok yang mudah ditulis instruktur. */
export const SELECTOR_ALIASES: Readonly<Record<string, readonly ComponentCategory[]>> = {
  scc: ['scc-pwm', 'scc-mppt'],
  inverter: ['inverter-offgrid', 'inverter-gridtie', 'inverter-hybrid'],
  mcb: ['mcb-dc', 'mcb-ac'],
  load: ['load-dc', 'load-ac'],
  pv: ['pv-module'],
};

/**
 * Id komponen yang ditunjuk, urut seperti di meja kerja. Urutan pencocokan: id meja kerja, lalu
 * kategori atau alias, lalu id katalog.
 */
export function resolveComponents(
  selector: ComponentSelector,
  components: readonly PlacedComponent[],
): string[] {
  if (components.some((component) => component.id === selector)) return [selector];
  const categories = SELECTOR_ALIASES[selector] ?? [selector];
  const byCategory = components.filter(({ item }) => categories.includes(item.category));
  if (byCategory.length > 0) return byCategory.map((component) => component.id);
  return components.filter(({ item }) => item.id === selector).map((component) => component.id);
}

/** Memecah `komponen.terminal`; titik pertama yang memisahkan. */
export function splitTerminalSelector(selector: TerminalSelector): [string, string] {
  const dot = selector.indexOf('.');
  return dot < 0 ? [selector, ''] : [selector.slice(0, dot), selector.slice(dot + 1)];
}

/** Semua terminal yang ditunjuk dan memang ada pada itemnya. */
export function resolveTerminals(
  selector: TerminalSelector,
  components: readonly PlacedComponent[],
): TerminalRef[] {
  const [componentSelector, terminalId] = splitTerminalSelector(selector);
  const byId = new Map(components.map((component) => [component.id, component]));
  return resolveComponents(componentSelector, components)
    .filter((id) => byId.get(id)?.item.terminals.some((terminal) => terminal.id === terminalId))
    .map((componentId) => ({ componentId, terminalId }));
}

/** `true` bila terminal `ref` termasuk yang ditunjuk `selector`. */
export function terminalMatches(
  selector: TerminalSelector,
  ref: TerminalRef | undefined,
  components: readonly PlacedComponent[],
): boolean {
  if (!ref) return false;
  return resolveTerminals(selector, components).some(
    (candidate) =>
      candidate.componentId === ref.componentId && candidate.terminalId === ref.terminalId,
  );
}

export interface BenchConnectionInput {
  components: readonly PlacedComponent[];
  wires: readonly Wire[];
  closedSwitchIds: readonly string[];
}

/**
 * `true` bila salah satu terminal `a` satu net dengan salah satu terminal `b`. Rel busbar selalu
 * menyambung; MCB/fuse hanya bila `throughSwitches` dan tuasnya ON.
 */
export function terminalsConnected(
  input: BenchConnectionInput,
  a: TerminalSelector,
  b: TerminalSelector,
  throughSwitches = false,
): boolean {
  const { components, wires } = input;
  const closed = throughSwitches ? input.closedSwitchIds : [];
  const netlist = buildNetlist(components, wires, deriveBridges(components, closed));
  const netsOf = (selector: TerminalSelector) =>
    resolveTerminals(selector, components)
      .map((ref) => findNetId(netlist, ref))
      .filter((netId): netId is string => netId !== undefined);
  const netsA = new Set(netsOf(a));
  return netsOf(b).some((netId) => netsA.has(netId));
}
