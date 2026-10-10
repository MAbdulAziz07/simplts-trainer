// Nilai acuan: docs/MODEL_FISIKA.md §1.7 A, §3.4, §6.3, §15 (toleransi 2%).
import { describe, expect, it } from 'vitest';
import {
  pvCellTempC,
  pvCurrentA,
  pvCurve,
  pvCurveAt,
  pvPointsAt,
  pvStringVocColdV,
  pvVoltageV,
} from './pv';
import { PV_240W_60P, PV_GENERIC_100WP, PV_JS310CB_80P, within } from './test-fixtures';

const expectNear = (actual: number, expected: number, tolerance?: number) =>
  expect(within(actual, expected, tolerance), `${actual} vs acuan ${expected}`).toBe(true);

describe('pvCellTempC', () => {
  it('contoh §1.7 A: Ta 30 °C, G 800, NOCT 45 → 55 °C', () => {
    expect(pvCellTempC(30, 800, 45)).toBeCloseTo(55, 10);
  });

  it('iradiasi 0 memberi suhu lingkungan; pemasangan menambah suhu', () => {
    expect(pvCellTempC(27, 0, 45)).toBe(27);
    expect(pvCellTempC(27, 0, 45, 15)).toBe(42);
  });

  it('contoh §11.3: Ta 27.6 °C, G 810 → 53.0 °C', () => {
    expectNear(pvCellTempC(27.6, 810, 45), 53.0);
  });
});

describe('pvPointsAt', () => {
  it('STC mengembalikan nilai datasheet', () => {
    const points = pvPointsAt(PV_240W_60P, 1000, 25);
    expect(points.iscA).toBeCloseTo(8.56, 10);
    expect(points.impA).toBeCloseTo(8.01, 10);
    expect(points.vocV).toBeCloseTo(37.2, 10);
    expect(points.vmpV).toBeCloseTo(30.0, 10);
  });

  it('contoh §1.7 A: 240W-60P pada G 800, Tc 55 °C', () => {
    const points = pvPointsAt(PV_240W_60P, 800, 55);
    expectNear(points.iscA, 6.951);
    expectNear(points.impA, 6.504);
    expectNear(points.vocV, 33.82);
    expectNear(points.vmpV, 25.13);
  });

  it('Isc berbanding lurus iradiasi (US5)', () => {
    const ratio = pvPointsAt(PV_240W_60P, 500, 40).iscA / pvPointsAt(PV_240W_60P, 1000, 40).iscA;
    expect(ratio).toBeCloseTo(0.5, 10);
  });

  it('iradiasi 0 atau negatif: semua keluaran 0', () => {
    expect(pvPointsAt(PV_240W_60P, 0, 25)).toEqual({ iscA: 0, impA: 0, vocV: 0, vmpV: 0 });
    expect(pvPointsAt(PV_240W_60P, -5, 25).iscA).toBe(0);
  });

  it('suhu sel 65 °C: Voc turun ke 33.18 V (US6)', () => {
    const hot = pvPointsAt(PV_240W_60P, 1000, 65);
    expectNear(hot.vocV, 33.18, 0.01);
    expect(hot.vocV / 37.2).toBeCloseTo(0.892, 3);
    expect(hot.iscA).toBeGreaterThan(8.56);
  });

  it('suhu sel 15 °C: Voc naik di atas nilai STC', () => {
    const cold = pvPointsAt(PV_240W_60P, 1000, 15);
    expectNear(cold.vocV, 37.2 * 1.027);
    expect(cold.iscA).toBeLessThan(8.56);
  });

  it('iradiasi sangat rendah tidak menghasilkan tegangan negatif', () => {
    const dim = pvPointsAt(PV_GENERIC_100WP, 1e-9, 25);
    expect(dim.vocV).toBeGreaterThanOrEqual(0);
    expect(dim.vmpV).toBeGreaterThanOrEqual(0);
  });
});

describe('pvCurve', () => {
  it('contoh §1.7 A: C2 0.09357 dan C1 2.28e-5', () => {
    const curve = pvCurveAt(PV_240W_60P, 800, 55);
    expectNear(curve.c2, 0.09357);
    expectNear(curve.c1, 2.28e-5, 0.05);
  });

  it('kurva gelap berkoefisien nol', () => {
    const dark = pvCurve({ iscA: 0, impA: 0, vocV: 0, vmpV: 0 });
    expect(dark).toEqual({ iscA: 0, impA: 0, vocV: 0, vmpV: 0, c1: 0, c2: 0 });
  });
});

describe('pvCurrentA', () => {
  const curve = pvCurveAt(PV_240W_60P, 800, 55);

  it('I(0) = Isc, I(Vmp) = Imp, I(Voc) ≈ 0', () => {
    expect(pvCurrentA(curve, 0)).toBeCloseTo(curve.iscA, 10);
    // Selisih terhadap Imp = Isc·C1 (suku "−1" pada rumus), di sini 0.00016 A.
    expect(pvCurrentA(curve, curve.vmpV)).toBeCloseTo(curve.impA, 3);
    expect(pvCurrentA(curve, curve.vocV)).toBeLessThan(0.001);
  });

  it('contoh §1.7 A: I(30 V) = 4.87 A', () => {
    expectNear(pvCurrentA(curve, 30), 4.87);
  });

  it('dibatasi 0..Isc di luar rentang tegangan', () => {
    expect(pvCurrentA(curve, -5)).toBe(curve.iscA);
    expect(pvCurrentA(curve, curve.vocV + 10)).toBe(0);
  });

  it('iradiasi 0: tidak ada arus', () => {
    expect(pvCurrentA(pvCurveAt(PV_240W_60P, 0, 25), 12)).toBe(0);
  });
});

describe('pvVoltageV', () => {
  const curve = pvCurveAt(PV_240W_60P, 800, 55);

  it('kebalikan dari pvCurrentA', () => {
    for (const voltageV of [5, 20, 25.13, 30, 33]) {
      expect(pvVoltageV(curve, pvCurrentA(curve, voltageV))).toBeCloseTo(voltageV, 6);
    }
  });

  it('arus 0 memberi Voc; arus >= Isc memberi 0 V', () => {
    expectNear(pvVoltageV(curve, 0), curve.vocV, 0.001);
    expect(pvVoltageV(curve, curve.iscA)).toBe(0);
    expect(pvVoltageV(curve, curve.iscA * 2)).toBe(0);
  });

  it('iradiasi 0: tegangan 0', () => {
    expect(pvVoltageV(pvCurveAt(PV_240W_60P, 0, 25), 0)).toBe(0);
  });
});

describe('pvStringVocColdV', () => {
  it('contoh §3.4: 2 seri 240W-60P pada 20 °C = 75.4 V', () => {
    expect(pvStringVocColdV(PV_240W_60P, 2, 20)).toBeCloseTo(75.4, 1);
  });

  it('suhu 15 °C: 2 seri JS310CB-80P = 60.8 V; 4 seri 240W-60P = 152.8 V', () => {
    expect(pvStringVocColdV(PV_JS310CB_80P, 2, 15)).toBeCloseTo(60.8, 1);
    expect(pvStringVocColdV(PV_240W_60P, 4, 15)).toBeCloseTo(152.8, 1);
  });

  it('suhu 65 °C: di bawah Voc STC', () => {
    expect(pvStringVocColdV(PV_240W_60P, 1, 65)).toBeCloseTo(33.18, 2);
  });
});
