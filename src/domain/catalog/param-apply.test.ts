import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../types';
import {
  PARAM_MAX_FACTOR,
  applyParams,
  normalizeParams,
  paramIssues,
  paramSpecsOf,
  paramValue,
} from './param-apply';
import { PARAM_SPECS } from './params';

const item = (category: string, electrical: object, protection: object = {}) =>
  ({ id: 'x', category, electrical, protection, terminals: [] }) as unknown as CatalogItem;

const PV = item('pv-module', { pmaxW: 100, vmpV: 18, impA: 5.56, vocV: 22, iscA: 5.97 });
const MCB = item(
  'mcb-dc',
  { ratedCurrentA: 16, curve: 'C', ratedVoltageDcV: 440, breakingCapacityKa: 10 },
  { ratedCurrentA: 16, curve: 'C', ratedVoltageDcV: 440, breakingCapacityKa: 10 },
);
const LOAD = item('load-dc', {
  ratedVoltageV: 12,
  maxPowerW: 200,
  minPowerW: 20,
  stepW: 10,
  resistanceAtMaxOhm: 0.72,
});
const BATTERY = item('battery', { nominalVoltageV: 12, capacityAh: 100, chargeCurrentMaxA: 30 });
const BUSBAR = item('busbar', { positions: 6, ratedCurrentA: 100, ratedVoltageV: 1000 });

const field = (target: CatalogItem, section: 'electrical' | 'protection', name: string) =>
  (target[section] as unknown as Record<string, unknown>)[name];

describe('PARAM_SPECS', () => {
  it('kunci unik per kategori', () => {
    for (const specs of Object.values(PARAM_SPECS)) {
      const keys = specs.map((spec) => spec.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('paramValue dan paramSpecsOf', () => {
  it('nilai default dari electrical atau protection', () => {
    const [ratedA] = PARAM_SPECS['mcb-dc'];
    expect(ratedA && paramValue(MCB, ratedA)).toBe(16);
  });

  it('field opsional yang tidak ada dilewati', () => {
    expect(paramSpecsOf(BATTERY).map((spec) => spec.key)).toEqual([
      'nominalV',
      'capacity',
      'chargeA',
    ]);
  });
});

describe('applyParams', () => {
  it('tanpa ubahan: item yang sama', () => {
    expect(applyParams(MCB, undefined)).toBe(MCB);
    expect(applyParams(MCB, {})).toBe(MCB);
  });

  it('field ada di electrical dan protection: keduanya diisi; katalog tidak berubah', () => {
    const applied = applyParams(MCB, { ratedA: 25, curve: 'B' });
    expect(field(applied, 'electrical', 'ratedCurrentA')).toBe(25);
    expect(field(applied, 'protection', 'ratedCurrentA')).toBe(25);
    expect(field(applied, 'protection', 'curve')).toBe('B');
    expect(field(MCB, 'protection', 'ratedCurrentA')).toBe(16);
  });

  it('parameter tetap tidak diterapkan', () => {
    expect(field(applyParams(BUSBAR, { positions: 8 }), 'electrical', 'positions')).toBe(6);
  });

  it('PV: Pmax baru menskala Imp dan Isc', () => {
    const applied = applyParams(PV, { pmax: 200 });
    expect(field(applied, 'electrical', 'impA')).toBeCloseTo(200 / 18, 6);
    expect(field(applied, 'electrical', 'iscA')).toBeCloseTo((5.97 * 200) / 18 / 5.56, 2);
  });

  it('PV: Pmax dan Isc diatur bersama, Isc mengikuti isian', () => {
    expect(field(applyParams(PV, { pmax: 120, isc: 9 }), 'electrical', 'iscA')).toBe(9);
  });

  it('PV: Vmp baru memperbarui Pmax', () => {
    expect(field(applyParams(PV, { vmp: 20 }), 'electrical', 'pmaxW')).toBeCloseTo(111.2, 6);
  });

  it('beban: R pada daya maksimum dihitung ulang', () => {
    expect(
      field(applyParams(LOAD, { maxPower: 100 }), 'electrical', 'resistanceAtMaxOhm'),
    ).toBeCloseTo(1.44, 6);
    expect(
      field(applyParams(LOAD, { nominalV: 24 }), 'electrical', 'resistanceAtMaxOhm'),
    ).toBeCloseTo(2.88, 6);
  });
});

describe('paramIssues', () => {
  it('ubahan sah: kosong', () => {
    expect(paramIssues(MCB, { ratedA: 25, curve: 'D' })).toEqual([]);
  });

  it.each([
    [{ hilang: 1 }, 'unknown'],
    [{ ratedA: 'besar' }, 'not-number'],
    [{ ratedA: 0 }, 'not-positive'],
    [{ ratedA: 16 * PARAM_MAX_FACTOR + 1 }, 'too-large'],
    [{ curve: 'X' }, 'not-option'],
  ])('%o → %s', (params, code) => {
    expect(paramIssues(MCB, params)).toEqual([{ key: Object.keys(params)[0], code }]);
  });

  it('parameter tetap tidak bisa diubah', () => {
    expect(paramIssues(BUSBAR, { positions: 8 })).toEqual([{ key: 'positions', code: 'fixed' }]);
    expect(paramIssues(BATTERY, { dischargeA: 50 })).toEqual([
      { key: 'dischargeA', code: 'unknown' },
    ]);
  });

  it('batas 10× default boleh tepat', () => {
    expect(paramIssues(MCB, { ratedA: 16 * PARAM_MAX_FACTOR })).toEqual([]);
  });

  it('PV: Vmp ≥ Voc dan Imp ≥ Isc ditolak', () => {
    expect(paramIssues(PV, { vmp: 23 })).toEqual([{ key: 'vmp', code: 'pv-vmp-above-voc' }]);
    expect(paramIssues(PV, { voc: 17 })).toEqual([{ key: 'voc', code: 'pv-vmp-above-voc' }]);
    expect(paramIssues(PV, { isc: 5 })).toEqual([{ key: 'isc', code: 'pv-imp-above-isc' }]);
  });

  it('beban: daya maksimum di bawah daya minimum ditolak', () => {
    expect(paramIssues(LOAD, { maxPower: 10 })).toEqual([
      { key: 'maxPower', code: 'load-max-below-min' },
    ]);
  });
});

describe('normalizeParams', () => {
  it('nilai sama dengan default dibuang', () => {
    expect(normalizeParams(MCB, { ratedA: 16, curve: 'B' })).toEqual({ curve: 'B' });
    expect(normalizeParams(MCB, { ratedA: 16 })).toBeUndefined();
  });
});
