import { describe, expect, it } from 'vitest';
import type { ComponentCategory, PackageId, TerminalKind } from '../types';
import {
  familyOf,
  familyVariants,
  pickVariant,
  retainedTerminalIds,
  variantChoice,
  variantKinds,
  variantRatingsA,
} from './variants';

const terminal = (id: string, kind: TerminalKind) => ({
  id,
  kind,
  label: id,
  xPct: 0,
  yPct: 0,
  maxWires: 1,
});

const DC_TERMINALS = [terminal('pos-in', 'dc+'), terminal('neg-in', 'dc-')];
const AC_TERMINALS = [terminal('l-in', 'acL'), terminal('n-in', 'acN')];

const mcb = (
  id: string,
  category: 'mcb-dc' | 'mcb-ac',
  ratedCurrentA: number,
  packages: PackageId[] = ['min'],
) => ({
  id,
  category,
  packages,
  terminals: category === 'mcb-dc' ? DC_TERMINALS : AC_TERMINALS,
  protection: { ratedCurrentA },
});

const busbar = (id: string, kind: TerminalKind) => ({
  id,
  category: 'busbar' as const,
  packages: ['min'] as PackageId[],
  terminals: [terminal('t1', kind), terminal('t2', kind)],
  protection: { ratedCurrentA: 100 },
});

const PANEL = {
  id: 'load-panel-3c',
  category: 'load-panel' as const,
  packages: ['best'] as PackageId[],
  terminals: [terminal('in-l', 'acL')],
  protection: { ratedCurrentA: 32 },
};

const CATALOG = [
  mcb('dc-16', 'mcb-dc', 16),
  mcb('dc-32', 'mcb-dc', 32),
  mcb('dc-100', 'mcb-dc', 100, ['rek']),
  mcb('ac-6', 'mcb-ac', 6),
  mcb('ac-10', 'mcb-ac', 10),
  busbar('bus-pos', 'dc+'),
  busbar('bus-pe', 'pe'),
  PANEL,
];

describe('familyOf', () => {
  it.each<[ComponentCategory, string | undefined]>([
    ['mcb-dc', 'mcb'],
    ['mcb-ac', 'mcb'],
    ['busbar', 'panel'],
    ['load-panel', 'panel'],
    ['fuse', undefined],
    ['pv-module', undefined],
  ])('%s → %s', (category, family) => {
    expect(familyOf(category)).toBe(family);
  });
});

describe('variantChoice', () => {
  it('MCB: jenis dc/ac dan arus pengenal', () => {
    expect(variantChoice(mcb('x', 'mcb-dc', 20))).toEqual({ kind: 'dc', ratedCurrentA: 20 });
    expect(variantChoice(mcb('x', 'mcb-ac', 6))).toEqual({ kind: 'ac', ratedCurrentA: 6 });
  });

  it('busbar: jenis terminalnya; panel beban: load-panel', () => {
    expect(variantChoice(busbar('x', 'acN'))).toEqual({ kind: 'acN' });
    expect(variantChoice(PANEL)).toEqual({ kind: 'load-panel' });
  });

  it('busbar tanpa terminal dan kategori lain: tidak ada', () => {
    expect(variantChoice({ ...busbar('x', 'pe'), terminals: [] })).toBeUndefined();
    expect(variantChoice({ ...PANEL, category: 'fuse' })).toBeUndefined();
  });
});

describe('familyVariants', () => {
  it('hanya anggota keluarga di paket itu, urut katalog', () => {
    expect(familyVariants(CATALOG, 'mcb', 'min').map((item) => item.id)).toEqual([
      'dc-16',
      'dc-32',
      'ac-6',
      'ac-10',
    ]);
    expect(familyVariants(CATALOG, 'panel', 'best').map((item) => item.id)).toEqual([
      'load-panel-3c',
    ]);
  });
});

describe('variantKinds dan variantRatingsA', () => {
  const minMcb = familyVariants(CATALOG, 'mcb', 'min');

  it('jenis tanpa ulangan', () => {
    expect(variantKinds(minMcb)).toEqual(['dc', 'ac']);
    expect(variantKinds(familyVariants(CATALOG, 'panel', 'min'))).toEqual(['dc+', 'pe']);
  });

  it('arus pengenal per jenis, urut naik', () => {
    expect(variantRatingsA([...minMcb].reverse(), 'dc')).toEqual([16, 32]);
    expect(variantRatingsA(minMcb, 'ac')).toEqual([6, 10]);
    expect(variantRatingsA(familyVariants(CATALOG, 'panel', 'min'), 'pe')).toEqual([]);
  });
});

describe('pickVariant', () => {
  const minMcb = familyVariants(CATALOG, 'mcb', 'min');

  it('arus sama bila ada', () => {
    expect(pickVariant(minMcb, 'dc', 32)?.id).toBe('dc-32');
  });

  it('arus terdekat; seri memilih yang lebih kecil', () => {
    expect(pickVariant(minMcb, 'ac', 16)?.id).toBe('ac-10');
    expect(pickVariant(minMcb, 'dc', 24)?.id).toBe('dc-16');
  });

  it('tanpa arus: varian pertama jenis itu; jenis tidak ada: undefined', () => {
    expect(pickVariant(minMcb, 'ac')?.id).toBe('ac-6');
    expect(pickVariant(minMcb, 'pe')).toBeUndefined();
  });
});

describe('retainedTerminalIds', () => {
  it('id dan jenis sama tetap; selain itu dilepas', () => {
    expect(retainedTerminalIds(mcb('a', 'mcb-dc', 16), mcb('b', 'mcb-dc', 32))).toEqual([
      'pos-in',
      'neg-in',
    ]);
    expect(retainedTerminalIds(mcb('a', 'mcb-dc', 16), mcb('b', 'mcb-ac', 10))).toEqual([]);
    expect(retainedTerminalIds(busbar('a', 'dc+'), busbar('b', 'dc-'))).toEqual([]);
  });
});
