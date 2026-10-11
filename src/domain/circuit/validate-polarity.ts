// Aturan polaritas: kutub terbalik pada masukan alat dan hubung singkat sumber.
import type { CatalogItem } from '../types';
import type { Finding, TerminalRef } from './types';
import { finding, netOf, ofCategory, polePairs } from './validate-context';
import type { ValidationContext } from './validate-context';

interface NetSigns {
  plus: string[];
  minus: string[];
}

/** Kutub sumber yang ada di tiap net: id komponen pemilik kutub + dan kutub −. */
function sourceSigns(ctx: ValidationContext): Map<string, NetSigns> {
  const signs = new Map<string, NetSigns>();
  const mark = (componentId: string, terminalId: string, sign: keyof NetSigns): void => {
    const netId = netOf(ctx.design, componentId, terminalId);
    if (netId === undefined) return;
    const entry = signs.get(netId) ?? { plus: [], minus: [] };
    entry[sign].push(componentId);
    signs.set(netId, entry);
  };
  for (const { id } of ofCategory(ctx, 'pv-module', 'battery')) {
    mark(id, 'pos', 'plus');
    mark(id, 'neg', 'minus');
  }
  // Keluaran beban SCC PWM adalah sumber bagi beban DC.
  for (const { id } of ofCategory(ctx, 'scc-pwm')) {
    mark(id, 'load-pos', 'plus');
    mark(id, 'load-neg', 'minus');
  }
  return signs;
}

function survivesReversePolarity(item: CatalogItem): boolean {
  if (item.category === 'load-dc') return true;
  const protection = item.protection;
  if ('reversePolarityDamages' in protection) return !protection.reversePolarityDamages;
  return 'features' in protection && protection.features.includes('reverse-polarity');
}

/** Kutub + alat tersambung ke kutub − sumber, atau sebaliknya. */
export function reversePolarity(ctx: ValidationContext): Finding[] {
  const signs = sourceSigns(ctx);
  const findings: Finding[] = [];
  const sinks = ofCategory(
    ctx,
    'scc-pwm',
    'scc-mppt',
    'inverter-offgrid',
    'inverter-gridtie',
    'inverter-hybrid',
    'load-dc',
  );
  for (const { id, item } of sinks) {
    for (const pair of polePairs(item)) {
      const isSourcePort = item.category === 'scc-pwm' && pair.name === 'load';
      const isAcPort = item.terminals.some((t) => t.id === pair.first && t.kind === 'acL');
      if (isSourcePort || isAcPort) continue;
      const atPos = signs.get(netOf(ctx.design, id, pair.first) ?? '');
      const atNeg = signs.get(netOf(ctx.design, id, pair.second) ?? '');
      const wrongAtPos = atPos && atPos.plus.length === 0 ? atPos.minus : [];
      const wrongAtNeg = atNeg && atNeg.minus.length === 0 ? atNeg.plus : [];
      if (wrongAtPos.length + wrongAtNeg.length === 0) continue;
      const terminals: TerminalRef[] = [pair.first, pair.second].map((terminalId) => {
        return { componentId: id, terminalId };
      });
      const severity = survivesReversePolarity(item) ? 'warning' : 'danger';
      findings.push(
        finding('reverse-polarity', severity, [id, ...wrongAtPos, ...wrongAtNeg], { terminals }),
      );
    }
  }
  return findings;
}

interface PolarSource {
  id: string;
  negNode: string;
  posNode: string;
}

/** Sumber sejenis berbagi `family`; simpul = `family|netId` agar jenis lain tidak tercampur. */
function polarSources(ctx: ValidationContext): PolarSource[] {
  const sources: PolarSource[] = [];
  const add = (id: string, family: string, pos: string, neg: string): void => {
    const posNet = netOf(ctx.design, id, pos);
    const negNet = netOf(ctx.design, id, neg);
    if (posNet && negNet) {
      sources.push({ id, negNode: `${family}|${negNet}`, posNode: `${family}|${posNet}` });
    }
  };
  for (const { id, item } of ofCategory(ctx, 'pv-module', 'battery')) {
    add(id, item.category, 'pos', 'neg');
  }
  for (const { id } of ofCategory(ctx, 'grid')) add(id, 'grid', 'l', 'n');
  // Keluaran AC inverter: hanya hubung singkat pada dirinya sendiri yang diperiksa.
  for (const { id } of ofCategory(ctx, 'inverter-offgrid')) add(id, `ac-${id}`, 'ac-l', 'ac-n');
  for (const { id } of ofCategory(ctx, 'inverter-hybrid')) add(id, `ac-${id}`, 'load-l', 'load-n');
  return sources;
}

/**
 * Sumber sejenis yang kutubnya bertemu tanpa beban: kedua kutub pada satu net, deret seri yang
 * ujungnya disatukan, atau paralel terbalik. Tiap sumber menaikkan tingkat net satu langkah; dua
 * jalur dengan tingkat berbeda ke net yang sama berarti hubung singkat.
 */
export function shortCircuit(ctx: ValidationContext): Finding[] {
  const parent = new Map<string, string>();
  const offset = new Map<string, number>();
  const find = (node: string): { root: string; level: number } => {
    let root = node;
    let level = 0;
    for (let next = parent.get(root); next !== undefined; next = parent.get(root)) {
      level += offset.get(root) ?? 0;
      root = next;
    }
    return { root, level };
  };

  const sources = polarSources(ctx);
  const conflicts: PolarSource[] = [];
  for (const source of sources) {
    const neg = find(source.negNode);
    const pos = find(source.posNode);
    if (neg.root !== pos.root) {
      parent.set(pos.root, neg.root);
      offset.set(pos.root, neg.level + 1 - pos.level);
    } else if (pos.level - neg.level !== 1) {
      conflicts.push(source);
    }
  }
  const shortedRoots = new Set(conflicts.map((source) => find(source.negNode).root));
  return [...shortedRoots].map((root) => {
    const members = sources.filter((source) => find(source.negNode).root === root);
    // Arus hubung singkat PV terbatas di sekitar Isc (MODEL_FISIKA §9.1), jadi hanya peringatan.
    const severity = root.startsWith('pv-module|') ? 'warning' : 'danger';
    return finding(
      'short-circuit',
      severity,
      members.map((source) => source.id),
    );
  });
}
