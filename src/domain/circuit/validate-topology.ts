// Aturan topologi: apa tersambung ke apa, tanpa menghitung besaran listrik.
import type { ComponentCategory, TerminalKind } from '../types';
import { terminalPairs } from './bridges';
import type { Finding, TerminalRef } from './types';
import {
  finding,
  netOf,
  ofCategory,
  polePairs,
  terminalKey,
  terminalsInNet,
} from './validate-context';
import type { ValidationContext } from './validate-context';

const PV_DIRECT_TARGETS: readonly ComponentCategory[] = ['inverter-offgrid', 'load-dc', 'load-ac'];
const DC_KINDS: readonly TerminalKind[] = ['pv+', 'pv-', 'dc+', 'dc-'];
/** Komponen yang hanya meneruskan; terminal DC-nya tidak menandai net sebagai DC. */
const PASSIVE: readonly ComponentCategory[] = ['mcb-dc', 'mcb-ac', 'fuse', 'busbar', 'combiner'];
/** Elektrode pembumian. PE jaringan PLN tidak dihitung sebagai pembumian. [PERLU VERIFIKASI] */
const EARTH: readonly ComponentCategory[] = ['grounding'];
const NO_PE_CHECK: readonly ComponentCategory[] = ['grounding', 'busbar', 'grid'];

function hasWire(ctx: ValidationContext, componentId: string): boolean {
  const component = ctx.byId.get(componentId);
  return (component?.item.terminals ?? []).some((terminal) =>
    ctx.wired.has(terminalKey({ componentId, terminalId: terminal.id })),
  );
}

/** Modul PV satu net dengan inverter off-grid atau beban, tanpa SCC di antaranya. */
export function pvDirect(ctx: ValidationContext): Finding[] {
  const pvByTarget = new Map<string, Set<string>>();
  for (const net of ctx.design.nets) {
    const pvTerminals = terminalsInNet(ctx, ctx.design, net.id, ['pv-module']);
    if (pvTerminals.length === 0) continue;
    for (const target of terminalsInNet(ctx, ctx.design, net.id, PV_DIRECT_TARGETS)) {
      const pvIds = pvByTarget.get(target.componentId) ?? new Set<string>();
      for (const ref of pvTerminals) pvIds.add(ref.componentId);
      pvByTarget.set(target.componentId, pvIds);
    }
  }
  return [...pvByTarget].map(([targetId, pvIds]) =>
    finding('pv-direct', 'danger', [targetId, ...pvIds]),
  );
}

/** Pasangan terminal (kutub atau masuk-keluar) yang baru satu sisinya dipasangi kabel. */
export function openCircuit(ctx: ValidationContext): Finding[] {
  const findings: Finding[] = [];
  for (const { id, item } of ctx.components) {
    const pairs = [...polePairs(item), ...terminalPairs(item.terminals, 'through')];
    const open: TerminalRef[] = [];
    for (const pair of pairs) {
      const [first, second] = [pair.first, pair.second].map((terminalId) => {
        return { componentId: id, terminalId };
      });
      if (!first || !second) continue;
      const firstWired = ctx.wired.has(terminalKey(first));
      if (firstWired !== ctx.wired.has(terminalKey(second))) open.push(firstWired ? second : first);
    }
    if (open.length > 0) findings.push(finding('open-circuit', 'info', [id], { terminals: open }));
  }
  return findings;
}

/** Beban AC satu net dengan terminal DC milik sumber atau alat DC. */
export function acLoadOnDc(ctx: ValidationContext): Finding[] {
  const findings: Finding[] = [];
  for (const { id, item } of ofCategory(ctx, 'load-ac')) {
    const dcOwners = new Set<string>();
    for (const terminal of item.terminals) {
      const netId = netOf(ctx.design, id, terminal.id);
      const net = ctx.design.nets.find((candidate) => candidate.id === netId);
      for (const ref of net?.terminals ?? []) {
        const owner = ctx.byId.get(ref.componentId)?.item;
        const kind = owner?.terminals.find((t) => t.id === ref.terminalId)?.kind;
        if (!owner || !kind || PASSIVE.includes(owner.category)) continue;
        if (DC_KINDS.includes(kind)) dcOwners.add(ref.componentId);
      }
    }
    if (dcOwners.size > 0) findings.push(finding('ac-load-on-dc', 'warning', [id, ...dcOwners]));
  }
  return findings;
}

/** Inverter grid-tie yang sisi AC-nya tidak mencapai jaringan. */
export function gridtieWithoutGrid(ctx: ValidationContext): Finding[] {
  return ofCategory(ctx, 'inverter-gridtie')
    .filter(({ id }) => hasWire(ctx, id))
    .filter(({ id }) =>
      ['ac-l', 'ac-n'].some((terminalId) => {
        const netId = netOf(ctx.design, id, terminalId);
        return terminalsInNet(ctx, ctx.design, netId, ['grid']).length === 0;
      }),
    )
    .map(({ id }) => finding('gridtie-without-grid', 'warning', [id]));
}

/** Komponen terpakai yang terminal PE-nya tidak mencapai elektrode pembumian. */
export function peNotConnected(ctx: ValidationContext): Finding[] {
  const findings: Finding[] = [];
  for (const { id, item } of ctx.components) {
    if (NO_PE_CHECK.includes(item.category) || !hasWire(ctx, id)) continue;
    const unearthed = item.terminals
      .filter((terminal) => terminal.kind === 'pe')
      .filter((terminal) => {
        const netId = netOf(ctx.design, id, terminal.id);
        return terminalsInNet(ctx, ctx.design, netId, EARTH).length === 0;
      })
      .map((terminal): TerminalRef => {
        return { componentId: id, terminalId: terminal.id };
      });
    if (unearthed.length > 0) {
      findings.push(finding('pe-not-connected', 'warning', [id], { terminals: unearthed }));
    }
  }
  return findings;
}
