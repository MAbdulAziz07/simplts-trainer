// Nilai acuan: docs/MODEL_FISIKA.md §1.4, §1.5, §1.7 A/B, §2.4, §3.4, §6.3 (toleransi 2%).
import { describe, expect, it } from 'vitest';
import { pvCurveAt } from './pv';
import {
  pvArrayCurrentA,
  pvArrayIscA,
  pvArrayMaxPower,
  pvArrayVocV,
  pvShadedIrradianceWm2,
  pvStringCurrentA,
  pvStringReverseCurrentA,
  pvStringVoltageV,
  pvUniformArray,
} from './pv-array';
import {
  PV_240W_60P,
  PV_GENERIC_100WP,
  PV_JS185CB_48P,
  PV_JS310CB_80P,
  within,
} from './test-fixtures';

const expectNear = (actual: number, expected: number, tolerance?: number) =>
  expect(within(actual, expected, tolerance), `${actual} vs acuan ${expected}`).toBe(true);

const hot240 = pvCurveAt(PV_240W_60P, 800, 55);
const stc310 = pvCurveAt(PV_JS310CB_80P, 1000, 25);
const shaded310 = pvCurveAt(PV_JS310CB_80P, pvShadedIrradianceWm2(1000, 0.5), 25);
const dark = pvCurveAt(PV_240W_60P, 0, 25);

describe('pvShadedIrradianceWm2', () => {
  it('contoh §1.7 B: 50% teduh → 575 W/m²', () => {
    expect(pvShadedIrradianceWm2(1000, 0.5)).toBeCloseTo(575, 10);
  });

  it('tanpa teduh tetap; teduh penuh tersisa bagian difus', () => {
    expect(pvShadedIrradianceWm2(800, 0)).toBe(800);
    expect(pvShadedIrradianceWm2(800, 1)).toBeCloseTo(120, 10);
    expect(pvShadedIrradianceWm2(800, 1, 0.25)).toBeCloseTo(200, 10);
  });
});

describe('pvUniformArray', () => {
  it('membentuk Np string berisi Ns modul', () => {
    const array = pvUniformArray(hot240, 4, 2);
    expect(array).toHaveLength(2);
    expect(array[0]).toHaveLength(4);
    expect(pvUniformArray(hot240, 1, 0)).toEqual([]);
  });
});

describe('pvStringVoltageV', () => {
  it('modul identik: tegangan dijumlahkan', () => {
    expect(pvStringVoltageV([hot240, hot240], 0)).toBeCloseTo(2 * hot240.vocV, 3);
  });

  it('modul teduh dilewati dioda bypass bila arus string melebihi Isc-nya', () => {
    const currentA = 10;
    const voltageV = pvStringVoltageV([stc310, shaded310], currentA);
    expect(voltageV).toBeCloseTo(pvStringVoltageV([stc310], currentA) - 0.6, 10);
  });
});

describe('pvStringCurrentA', () => {
  it('modul identik: I_string(V) = I_modul(V/Ns)', () => {
    expectNear(pvStringCurrentA([hot240, hot240], 60), 4.87);
  });

  it('terminal terbuka 0 A; hubung singkat = Isc terbesar', () => {
    expect(pvStringCurrentA([hot240, hot240], 80)).toBe(0);
    expect(pvStringCurrentA([stc310, shaded310], -5)).toBeCloseTo(stc310.iscA, 10);
  });

  it('iradiasi 0 atau string kosong: 0 A', () => {
    expect(pvStringCurrentA([dark, dark], 10)).toBe(0);
    expect(pvStringCurrentA([], 10)).toBe(0);
  });
});

describe('pvArrayCurrentA, pvArrayVocV, pvArrayIscA', () => {
  it('paralel: arus dijumlahkan, tegangan sama (§1.5)', () => {
    const array = pvUniformArray(hot240, 1, 2);
    expect(pvArrayIscA(array)).toBeCloseTo(2 * hot240.iscA, 8);
    expect(pvArrayVocV(array)).toBeCloseTo(hot240.vocV, 3);
    expectNear(pvArrayCurrentA(array, 30), 2 * 4.87);
  });

  it('contoh §2.4: 2 paralel JS185CB-48P pada 12.9 V = 20.17 A', () => {
    const array = pvUniformArray(pvCurveAt(PV_JS185CB_48P, 800, 55), 1, 2);
    expectNear(pvArrayCurrentA(array, 12.9), 20.17);
    expectNear(pvArrayCurrentA(array, 14.7), 14.89);
  });

  it('array kosong atau gelap: 0', () => {
    expect(pvArrayVocV([])).toBe(0);
    expect(pvArrayIscA([])).toBe(0);
    expect(pvArrayIscA(pvUniformArray(dark, 2, 2))).toBe(0);
  });
});

describe('pvArrayMaxPower', () => {
  it('contoh §1.7 A: 166.0 W pada 26.72 V, 6.21 A', () => {
    const point = pvArrayMaxPower([[hot240]]);
    expectNear(point.powerW, 166.0, 0.01);
    expectNear(point.voltageV, 26.72);
    expectNear(point.currentA, 6.21);
  });

  it('STC: paling banyak 0.5% di atas Pmax datasheet (§1.4)', () => {
    const powerW = pvArrayMaxPower([[pvCurveAt(PV_240W_60P, 1000, 25)]]).powerW;
    expect(powerW).toBeGreaterThanOrEqual(240);
    expect(powerW).toBeLessThan(240 * 1.005);
  });

  it('suhu sel 65 °C, G 1000: 200.5 W (§1.4)', () => {
    expectNear(pvArrayMaxPower([[pvCurveAt(PV_240W_60P, 1000, 65)]]).powerW, 200.5);
  });

  it('suhu sel 15 °C: daya di atas Pmax STC', () => {
    const powerW = pvArrayMaxPower([[pvCurveAt(PV_240W_60P, 1000, 15)]]).powerW;
    expectNear(powerW, 240 * (1 + 0.0045 * 10));
  });

  it('contoh §3.4 dan §6.3: 2 seri JS310 = 438.9 W; 4 seri 240W-60P = 664.1 W pada 106.9 V', () => {
    const js310 = pvArrayMaxPower(pvUniformArray(pvCurveAt(PV_JS310CB_80P, 800, 55), 2, 1));
    expectNear(js310.powerW, 438.9);
    expectNear(js310.voltageV, 44.7);
    const string240 = pvArrayMaxPower(pvUniformArray(hot240, 4, 1));
    expectNear(string240.powerW, 664.1);
    expectNear(string240.voltageV, 106.9);
  });

  it('contoh §1.7 B: bayangan memberi dua puncak; yang global 377.3 W pada 52.2 V', () => {
    expectNear(pvArrayMaxPower([[stc310, stc310]]).powerW, 622.5);
    const global = pvArrayMaxPower([[stc310, shaded310]]);
    expectNear(global.powerW, 377.3);
    expectNear(global.voltageV, 52.2);
    expectNear(global.currentA, 7.22);
    const lower = pvArrayMaxPower([[stc310, shaded310]], 0, 30);
    expectNear(lower.powerW, 303.9);
    expectNear(lower.voltageV, 24.9);
    expectNear(lower.currentA, 12.23);
  });

  it('paket Minimum: 2 paralel panel 100 Wp pada STC ≈ 200 W', () => {
    const point = pvArrayMaxPower(pvUniformArray(pvCurveAt(PV_GENERIC_100WP, 1000, 25), 1, 2));
    expectNear(point.powerW, 200);
    expectNear(point.currentA, 2 * 5.56, 0.05);
  });

  it('iradiasi 0, array kosong, atau rentang di luar kurva: daya 0', () => {
    const zero = { voltageV: 0, currentA: 0, powerW: 0 };
    expect(pvArrayMaxPower(pvUniformArray(dark, 1, 2))).toEqual(zero);
    expect(pvArrayMaxPower([])).toEqual(zero);
    expect(pvArrayMaxPower([[hot240]], 60, 115)).toEqual(zero);
  });
});

describe('pvStringReverseCurrentA', () => {
  it('contoh §1.5: 3 string 240W-60P → 17.1 A (> fuse 15 A)', () => {
    expect(pvStringReverseCurrentA(3, 8.56)).toBeCloseTo(17.12, 10);
  });

  it('satu string: tidak ada arus balik', () => {
    expect(pvStringReverseCurrentA(1, 8.56)).toBe(0);
    expect(pvStringReverseCurrentA(0, 8.56)).toBe(0);
  });
});
