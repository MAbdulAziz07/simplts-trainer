import { describe, expect, it } from 'vitest';
import type { Finding } from '../circuit/types';
import { quantitiesOf } from './quantities';
import { appendSample, evaluateRule, usesInstrument, type QuantitySample } from './rules';
import { contextOf, snapshotAfter } from './scenario-test-fixtures';
import type { ScenarioRule } from './types';

const snapshot = snapshotAfter(30);
const context = contextOf(snapshot);
const check = (rule: ScenarioRule, patch = {}) => evaluateRule(rule, { ...context, ...patch });

describe('aturan meja kerja', () => {
  it('connected, placed, switch', () => {
    expect(check({ kind: 'connected', a: 'scc.bat-pos', b: 'battery.pos' })).toBe(true);
    expect(check({ kind: 'connected', a: 'scc.bat-pos', b: 'battery.neg' })).toBe(false);
    expect(check({ kind: 'placed', component: 'battery' })).toBe(true);
    expect(check({ kind: 'placed', component: 'battery', count: 2 })).toBe(false);
    expect(check({ kind: 'switch', component: 'mcb1', on: true })).toBe(true);
    expect(check({ kind: 'switch', component: 'mcb1', on: false })).toBe(false);
  });

  it('condition membaca kondisi simulasi', () => {
    expect(check({ kind: 'condition', component: 'mcb1', conditions: ['ok'] })).toBe(true);
    expect(check({ kind: 'condition', component: 'mcb1', conditions: ['tripped'] })).toBe(false);
  });
});

describe('aturan alat ukur', () => {
  const meter = (value: number, patch = {}) => ({
    multimeter: {
      open: true,
      fn: 'vdc' as const,
      red: { componentId: 'pv1', terminalId: 'pos' },
      black: { componentId: 'pv1', terminalId: 'neg' },
      reading: { kind: 'value' as const, value },
      ...patch,
    },
  });
  const voc = context.references['module-voc'] ?? 0;
  const rule: ScenarioRule = {
    kind: 'multimeter',
    fn: 'vdc',
    red: 'pv.pos',
    black: 'pv.neg',
    expected: { ref: 'module-voc' },
  };

  it('lulus dalam toleransi 5% di titik ukur yang benar', () => {
    expect(check(rule, meter(voc * 1.04))).toBe(true);
    expect(check(rule, meter(voc * 1.06))).toBe(false);
  });

  it('gagal bila probe terbalik, fungsi salah, alat tertutup, atau OL', () => {
    expect(check(rule, meter(-voc))).toBe(false);
    expect(check(rule, meter(voc, { fn: 'vac' }))).toBe(false);
    expect(check(rule, meter(voc, { open: false }))).toBe(false);
    expect(check(rule, meter(voc, { reading: { kind: 'overload' } }))).toBe(false);
    const swapped = meter(voc, { red: { componentId: 'pv1', terminalId: 'neg' } });
    expect(check(rule, swapped)).toBe(false);
  });

  it('tanpa titik ukur: bacaan mutlak', () => {
    expect(check({ kind: 'multimeter', fn: 'vdc', expected: 12 }, meter(-12.1))).toBe(true);
  });

  it('tang ampere pada kabel yang ditunjuk', () => {
    const clamp = (value: number, wireId = 'bat1.pos>scc1.bat-pos') => ({
      clamp: {
        open: true,
        mode: 'dc' as const,
        wireId,
        reading: { kind: 'value' as const, value },
      },
    });
    const clampRule: ScenarioRule = { kind: 'clamp', mode: 'dc', wire: 'battery.pos', minA: 1 };
    expect(check(clampRule, clamp(-3))).toBe(true);
    expect(check(clampRule, clamp(0.5))).toBe(false);
    expect(check(clampRule, clamp(3, 'pv1.pos>mcb1.pos-in'))).toBe(false);
    expect(check({ kind: 'clamp', mode: 'dc', expected: 5 }, clamp(5.2))).toBe(true);
  });

  it('usesInstrument menelusuri aturan gabungan', () => {
    expect(usesInstrument(rule)).toBe(true);
    expect(usesInstrument({ kind: 'all', rules: [{ kind: 'fault-found' }, rule] })).toBe(true);
    expect(usesInstrument({ kind: 'placed', component: 'pv' })).toBe(false);
  });
});

describe('aturan besaran', () => {
  it('value dengan batas bawah dan atas', () => {
    expect(check({ kind: 'value', quantity: 'pv-power-w', min: 1 })).toBe(true);
    expect(check({ kind: 'value', quantity: 'pv-power-w', max: 1 })).toBe(false);
  });

  it('trend membandingkan dengan cuplikan durationS sebelumnya', () => {
    const now = quantitiesOf(snapshot);
    const sample = (timeS: number, soc: number): QuantitySample => ({
      timeS,
      values: { ...now, 'soc-pct': soc },
    });
    const rule: ScenarioRule = {
      kind: 'trend',
      quantity: 'soc-pct',
      direction: 'rise',
      durationS: 20,
    };
    const before = now['soc-pct'] - 0.5;
    expect(check(rule, { history: [sample(snapshot.timeS - 25, before)] })).toBe(true);
    expect(check(rule, { history: [sample(snapshot.timeS - 10, before)] })).toBe(false);
    expect(check({ ...rule, direction: 'fall' }, { history: [sample(0, before)] })).toBe(false);
    expect(check({ ...rule, minDelta: 1 }, { history: [sample(0, before)] })).toBe(false);
  });

  it('appendSample: waktu mundur memulai riwayat baru, yang lama dibuang', () => {
    const values = quantitiesOf(snapshot);
    const history = appendSample([{ timeS: 0, values }], { timeS: 10, values });
    expect(history.map((s) => s.timeS)).toEqual([0, 10]);
    expect(appendSample(history, { timeS: 5, values }).map((s) => s.timeS)).toEqual([5]);
    expect(appendSample(history, { timeS: 10, values })).toHaveLength(2);
    expect(appendSample(history, { timeS: 100, values }, 50).map((s) => s.timeS)).toEqual([100]);
  });
});

describe('aturan temuan, gangguan, dan gabungan', () => {
  const finding = (severity: Finding['severity']): Finding => ({
    code: 'open-circuit',
    severity,
    componentIds: [],
  });

  it('no-finding memakai ambang keparahan', () => {
    expect(check({ kind: 'no-finding' }, { findings: [finding('warning')] })).toBe(true);
    expect(check({ kind: 'no-finding' }, { findings: [finding('danger')] })).toBe(false);
    expect(
      check({ kind: 'no-finding', severity: 'warning' }, { findings: [finding('warning')] }),
    ).toBe(false);
  });

  it('fault-found, all, any', () => {
    expect(check({ kind: 'fault-found' })).toBe(false);
    expect(check({ kind: 'fault-found' }, { faultFound: true })).toBe(true);
    const yes: ScenarioRule = { kind: 'placed', component: 'pv' };
    const no: ScenarioRule = { kind: 'placed', component: 'inverter' };
    expect(check({ kind: 'all', rules: [yes, no] })).toBe(false);
    expect(check({ kind: 'any', rules: [yes, no] })).toBe(true);
  });
});
