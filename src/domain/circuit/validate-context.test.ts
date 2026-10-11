import { describe, expect, it } from 'vitest';
import {
  buildContext,
  DEFAULT_MIN_CELL_TEMP_C,
  finding,
  liveNetlist,
  netOf,
  ofCategory,
  polePairs,
  seriesPath,
  sourceEdges,
  terminalKey,
  terminalsInNet,
} from './validate-context';
import { CABLES, OFFGRID_COMPONENTS, OFFGRID_WIRES, place, wire } from './validate-fixtures';

describe('buildContext', () => {
  const ctx = buildContext({
    components: OFFGRID_COMPONENTS,
    wires: OFFGRID_WIRES,
    cables: CABLES,
  });

  it('mengurutkan komponen, memakai suhu bawaan, dan mencatat terminal berkabel', () => {
    expect(ctx.components.map((c) => c.id)).toEqual(['bat1', 'load1', 'mcb1', 'pv1', 'scc1']);
    expect(ctx.minCellTempC).toBe(DEFAULT_MIN_CELL_TEMP_C);
    expect(ctx.wired.has(terminalKey({ componentId: 'pv1', terminalId: 'pos' }))).toBe(true);
    expect(ctx.wired.size).toBe(16);
  });

  it('design menganggap MCB ON; live mengikuti closedSwitchIds', () => {
    const open = buildContext({
      components: OFFGRID_COMPONENTS,
      wires: OFFGRID_WIRES,
      cables: CABLES,
      closedSwitchIds: [],
    });
    expect(netOf(open.design, 'pv1', 'pos')).toBe(netOf(open.design, 'scc1', 'pv-pos'));
    expect(netOf(open.live, 'pv1', 'pos')).not.toBe(netOf(open.live, 'scc1', 'pv-pos'));
    expect(netOf(ctx.live, 'pv1', 'pos')).toBe(netOf(ctx.live, 'scc1', 'pv-pos'));
  });

  it('id komponen ganda hanya dipakai sekali', () => {
    const twice = buildContext({
      components: [place('a', 'battery'), place('a', 'pv-module')],
      wires: [],
      cables: CABLES,
    });
    expect(twice.components).toHaveLength(1);
    expect(twice.byId.get('a')?.item.category).toBe('battery');
  });

  it('ofCategory dan terminalsInNet menyaring menurut kategori', () => {
    expect(ofCategory(ctx, 'battery', 'pv-module').map((c) => c.id)).toEqual(['bat1', 'pv1']);
    const netId = netOf(ctx.design, 'scc1', 'pv-pos');
    expect(terminalsInNet(ctx, ctx.design, netId, ['pv-module'])).toEqual([
      { componentId: 'pv1', terminalId: 'pos' },
    ]);
    expect(terminalsInNet(ctx, ctx.design, netId, ['battery'])).toEqual([]);
    expect(terminalsInNet(ctx, ctx.design, undefined, ['battery'])).toEqual([]);
  });
});

describe('liveNetlist', () => {
  it('MCB OFF memisahkan sisi masuk dan keluar', () => {
    const components = [place('mcb1', 'mcb-dc')];
    const on = liveNetlist(components, [], ['mcb1']);
    const off = liveNetlist(components, [], []);
    expect(netOf(on, 'mcb1', 'pos-in')).toBe(netOf(on, 'mcb1', 'pos-out'));
    expect(netOf(off, 'mcb1', 'pos-in')).not.toBe(netOf(off, 'mcb1', 'pos-out'));
  });
});

describe('polePairs', () => {
  it('mengenali pos/neg, l/n, dan a/b', () => {
    const names = (id: string, category: Parameters<typeof place>[1]) =>
      polePairs(place(id, category).item).map((p) => `${p.first}/${p.second}`);
    expect(names('s', 'scc-pwm')).toEqual([
      'pv-pos/pv-neg',
      'bat-pos/bat-neg',
      'load-pos/load-neg',
    ]);
    expect(names('i', 'inverter-offgrid')).toEqual(['dc-pos/dc-neg', 'ac-l/ac-n']);
    expect(names('l', 'load-dc')).toEqual(['a/b']);
    expect(names('g', 'grid')).toEqual(['l/n']);
  });
});

describe('sourceEdges dan seriesPath', () => {
  const components = [place('b1', 'battery'), place('b2', 'battery'), place('b3', 'battery')];

  it('dua baterai seri dijumlahkan, baterai paralel tidak', () => {
    const ctx = buildContext({
      components,
      wires: [wire('b1.pos', 'b2.neg'), wire('b2.pos', 'b3.pos'), wire('b2.neg', 'b3.neg')],
      cables: CABLES,
    });
    const edges = sourceEdges(ctx, ctx.design, 'battery', () => 12);
    expect(edges).toHaveLength(3);
    const path = seriesPath(edges, netOf(ctx.design, 'b1', 'neg'), netOf(ctx.design, 'b2', 'pos'));
    expect(path?.sum).toBe(24);
    expect(path?.ids[0]).toBe('b1');
  });

  it('memilih jalur dengan jumlah terbesar', () => {
    const edges = [
      { id: 'x', negNet: 'a', posNet: 'c', value: 12 },
      { id: 'y', negNet: 'a', posNet: 'b', value: 12 },
      { id: 'z', negNet: 'b', posNet: 'c', value: 12 },
    ];
    expect(seriesPath(edges, 'a', 'c')).toEqual({ sum: 24, ids: ['y', 'z'] });
  });

  it('tanpa jalur, net sama, net tak dikenal, atau lingkaran: undefined', () => {
    const edges = [
      { id: 'x', negNet: 'a', posNet: 'b', value: 12 },
      { id: 'y', negNet: 'b', posNet: 'a', value: 12 },
    ];
    expect(seriesPath(edges, 'b', 'c')).toBeUndefined();
    expect(seriesPath(edges, 'a', 'a')).toBeUndefined();
    expect(seriesPath(edges, undefined, 'a')).toBeUndefined();
    expect(seriesPath(edges, 'a', 'z')).toBeUndefined();
  });
});

describe('finding', () => {
  it('id komponen diurutkan tanpa ulangan', () => {
    expect(finding('short-circuit', 'danger', ['b', 'a', 'b'], { wireIds: ['w1'] })).toEqual({
      code: 'short-circuit',
      severity: 'danger',
      componentIds: ['a', 'b'],
      wireIds: ['w1'],
    });
  });
});
