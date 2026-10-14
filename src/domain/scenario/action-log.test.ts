import { describe, expect, it } from 'vitest';
import { wire } from '../circuit/validate-fixtures';
import { benchActions, csvCell, toCsv, type BenchState } from './action-log';

const BASE: BenchState = {
  components: [
    { id: 'bat1', catalogId: 'bat-a' },
    { id: 'mcb1', catalogId: 'mcb-a' },
  ],
  wires: [wire('bat1.pos', 'mcb1.pos-in')],
  closedSwitchIds: [],
};

describe('benchActions', () => {
  it('tanpa perubahan tanpa aksi', () => {
    expect(benchActions(BASE, BASE)).toEqual([]);
  });

  it('komponen, kabel, dan tuas', () => {
    const next: BenchState = {
      components: [...BASE.components, { id: 'scc1', catalogId: 'scc-a' }],
      wires: [wire('bat1.neg', 'mcb1.neg-in')],
      closedSwitchIds: ['mcb1'],
    };
    expect(benchActions(BASE, next)).toEqual([
      { action: 'component-add', detail: 'scc1 (scc-a)' },
      { action: 'wire-disconnect', detail: 'bat1.pos → mcb1.pos-in' },
      { action: 'wire-connect', detail: 'bat1.neg → mcb1.neg-in' },
      { action: 'switch-on', detail: 'mcb1' },
    ]);
  });

  it('komponen dihapus; tuas komponen yang dihapus tidak dicatat OFF', () => {
    const on = { ...BASE, closedSwitchIds: ['mcb1'] };
    const next: BenchState = { components: [BASE.components[0]!], wires: [], closedSwitchIds: [] };
    expect(benchActions(on, next)).toEqual([
      { action: 'component-remove', detail: 'mcb1' },
      { action: 'wire-disconnect', detail: 'bat1.pos → mcb1.pos-in' },
    ]);
  });
});

describe('CSV', () => {
  it('sel dikutip bila perlu', () => {
    expect(csvCell('biasa')).toBe('biasa');
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('kata "kutip"')).toBe('"kata ""kutip"""');
    expect(csvCell(12.5)).toBe('12.5');
  });

  it('baris dipisah CRLF', () => {
    expect(
      toCsv([
        ['a', 1],
        ['b;c', 2],
      ]),
    ).toBe('a;1\r\n"b;c";2\r\n');
    expect(toCsv([['a,b']], ',')).toBe('"a,b"\r\n');
  });
});
