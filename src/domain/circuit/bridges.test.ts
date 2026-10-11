import { describe, expect, it } from 'vitest';
import { deriveBridges, terminalPairs } from './bridges';
import type { Bridge } from './types';
import { busbar, place } from './validate-fixtures';

function links(bridges: Bridge[]): string[] {
  return bridges.map((b) => `${b.from.componentId}:${b.from.terminalId}-${b.to.terminalId}`);
}

describe('terminalPairs', () => {
  const ids = (list: string[]) => list.map((id) => ({ id }));

  it('memasangkan pos/neg polos dan berawalan', () => {
    expect(terminalPairs(ids(['pos', 'neg']), 'polar')).toEqual([
      { name: '', first: 'pos', second: 'neg' },
    ]);
    expect(terminalPairs(ids(['pv-pos', 'pv-neg', 'bat-pos', 'bat-neg']), 'polar')).toEqual([
      { name: 'pv', first: 'pv-pos', second: 'pv-neg' },
      { name: 'bat', first: 'bat-pos', second: 'bat-neg' },
    ]);
  });

  it('memasangkan l/n dan in/out', () => {
    expect(terminalPairs(ids(['ac-l', 'ac-n', 'pe']), 'ac')).toEqual([
      { name: 'ac', first: 'ac-l', second: 'ac-n' },
    ]);
    expect(terminalPairs(ids(['in', 'out']), 'through')).toEqual([
      { name: '', first: 'in', second: 'out' },
    ]);
    expect(terminalPairs(ids(['pos-in', 'pos-out', 'neg-in', 'neg-out']), 'through')).toHaveLength(
      2,
    );
  });

  it('terminal tanpa pasangan dilewati', () => {
    expect(terminalPairs(ids(['pos', 'pe']), 'polar')).toEqual([]);
    expect(terminalPairs(ids(['pos-in', 'pos-out']), 'polar')).toEqual([]);
  });
});

describe('deriveBridges', () => {
  const mcb = place('mcb1', 'mcb-dc');

  it('MCB: tanpa daftar berarti ON, kedua kutub tersambung', () => {
    expect(links(deriveBridges([mcb]))).toEqual(['mcb1:pos-in-pos-out', 'mcb1:neg-in-neg-out']);
  });

  it('MCB OFF tidak tersambung, MCB ON tersambung', () => {
    expect(deriveBridges([mcb], [])).toEqual([]);
    expect(deriveBridges([mcb], ['mcb1'])).toHaveLength(2);
  });

  it('busbar: semua terminal ke terminal pertama', () => {
    expect(links(deriveBridges([busbar('bus1', 'dc+', 3)], []))).toEqual([
      'bus1:t1-t2',
      'bus1:t1-t3',
    ]);
  });

  it('kWh meter selalu tersambung; combiner, panel beban, dan BMS menurut jalurnya', () => {
    const meter = place('kwh1', 'kwh-meter', {}, [
      ['l-in', 'acL'],
      ['l-out', 'acL'],
      ['n-in', 'acN'],
      ['n-out', 'acN'],
      ['pulse', 'data'],
    ]);
    const combiner = place('cmb1', 'combiner', {}, [
      ['s1-pos', 'pv+'],
      ['s1-neg', 'pv-'],
      ['s2-pos', 'pv+'],
      ['s2-neg', 'pv-'],
      ['out-pos', 'pv+'],
      ['out-neg', 'pv-'],
      ['pe', 'pe'],
    ]);
    const panel = place('pnl1', 'load-panel', {}, [
      ['in-l', 'acL'],
      ['in-n', 'acN'],
      ['pe', 'pe'],
      ['c1-l', 'acL'],
      ['c1-n', 'acN'],
    ]);
    const bms = place('bms1', 'bms', {}, [
      ['bat-pos', 'dc+'],
      ['bat-neg', 'dc-'],
      ['sys-pos', 'dc+'],
      ['sys-neg', 'dc-'],
    ]);
    expect(links(deriveBridges([meter, combiner, panel, bms], []))).toEqual([
      'kwh1:l-in-l-out',
      'kwh1:n-in-n-out',
      'cmb1:out-pos-s1-pos',
      'cmb1:out-pos-s2-pos',
      'cmb1:out-neg-s1-neg',
      'cmb1:out-neg-s2-neg',
      'pnl1:in-l-c1-l',
      'pnl1:in-n-c1-n',
      'bms1:bat-pos-sys-pos',
      'bms1:bat-neg-sys-neg',
    ]);
  });

  it('komponen lain tanpa sambungan dalam; `only` membatasi kategori', () => {
    expect(deriveBridges([place('pv1', 'pv-module'), place('scc1', 'scc-pwm')])).toEqual([]);
    expect(deriveBridges([mcb, busbar('bus1', 'dc+')], undefined, ['mcb-dc'])).toHaveLength(2);
  });
});
