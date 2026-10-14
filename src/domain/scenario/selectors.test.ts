import { describe, expect, it } from 'vitest';
import {
  resolveComponents,
  resolveTerminals,
  splitTerminalSelector,
  terminalMatches,
  terminalsConnected,
} from './selectors';
import { BUS_COMPONENTS, BUS_WIRES, CLOSED, COMPONENTS, WIRES } from './scenario-test-fixtures';

describe('resolveComponents', () => {
  it('mencocokkan id meja kerja lebih dulu', () => {
    expect(resolveComponents('bat1', COMPONENTS)).toEqual(['bat1']);
  });

  it('mencocokkan kategori, alias, lalu id katalog', () => {
    expect(resolveComponents('battery', COMPONENTS)).toEqual(['bat1']);
    expect(resolveComponents('scc', COMPONENTS)).toEqual(['scc1']);
    expect(resolveComponents('mcb', COMPONENTS)).toEqual(['mcb1']);
    expect(resolveComponents('catalog-load-dc', COMPONENTS)).toEqual(['load1']);
  });

  it('kosong bila tidak ada yang cocok', () => {
    expect(resolveComponents('inverter', COMPONENTS)).toEqual([]);
  });
});

describe('penunjuk terminal', () => {
  it('memecah di titik pertama', () => {
    expect(splitTerminalSelector('scc.bat-pos')).toEqual(['scc', 'bat-pos']);
    expect(splitTerminalSelector('scc')).toEqual(['scc', '']);
  });

  it('hanya terminal yang ada pada itemnya', () => {
    expect(resolveTerminals('scc.bat-pos', COMPONENTS)).toEqual([
      { componentId: 'scc1', terminalId: 'bat-pos' },
    ]);
    expect(resolveTerminals('scc.nope', COMPONENTS)).toEqual([]);
  });

  it('terminalMatches memeriksa komponen dan terminal', () => {
    const ref = { componentId: 'pv1', terminalId: 'pos' };
    expect(terminalMatches('pv.pos', ref, COMPONENTS)).toBe(true);
    expect(terminalMatches('pv.neg', ref, COMPONENTS)).toBe(false);
    expect(terminalMatches('pv.pos', undefined, COMPONENTS)).toBe(false);
  });
});

describe('terminalsConnected', () => {
  const bench = { components: COMPONENTS, wires: WIRES, closedSwitchIds: CLOSED };

  it('benar untuk kabel langsung', () => {
    expect(terminalsConnected(bench, 'scc.bat-pos', 'battery.pos')).toBe(true);
    expect(terminalsConnected(bench, 'scc.bat-pos', 'battery.neg')).toBe(false);
  });

  it('melewati busbar', () => {
    const viaBus = { components: BUS_COMPONENTS, wires: BUS_WIRES, closedSwitchIds: CLOSED };
    expect(terminalsConnected(viaBus, 'scc.bat-pos', 'battery.pos')).toBe(true);
  });

  it('melewati MCB hanya bila diminta dan tuasnya ON', () => {
    expect(terminalsConnected(bench, 'pv.pos', 'scc.pv-pos')).toBe(false);
    expect(terminalsConnected(bench, 'pv.pos', 'scc.pv-pos', true)).toBe(true);
    const off = { ...bench, closedSwitchIds: [] };
    expect(terminalsConnected(off, 'pv.pos', 'scc.pv-pos', true)).toBe(false);
  });
});
