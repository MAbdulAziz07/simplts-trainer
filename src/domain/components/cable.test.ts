// Nilai acuan: docs/MODEL_FISIKA.md §8.2–8.3 (toleransi 2%).
import { describe, expect, it } from 'vitest';
import {
  cableDropLevel,
  cableEffectiveAmpacityA,
  cableHeatLevel,
  cableIsOverheating,
  cableLoopResistanceOhm,
  cableResistivityOhmMm2PerM,
  cableSteadyTempC,
  cableStepTempC,
  cableVoltageDropPct,
  cableVoltageDropV,
} from './cable';
import { within } from './test-fixtures';
import { CABLE_NYY, CABLE_PV } from './test-fixtures-bos';

const expectNear = (actual: number, expected: number, tolerance?: number) =>
  expect(within(actual, expected, tolerance), `${actual} vs acuan ${expected}`).toBe(true);

describe('cableResistivityOhmMm2PerM', () => {
  it('20 °C = 0.0175; suhu 15 °C lebih rendah, 65 °C lebih tinggi', () => {
    expect(cableResistivityOhmMm2PerM(CABLE_PV, 20)).toBe(0.0175);
    expect(cableResistivityOhmMm2PerM(CABLE_PV, 15)).toBeCloseTo(0.0175 * 0.98035, 10);
    expect(cableResistivityOhmMm2PerM(CABLE_PV, 65)).toBeCloseTo(0.0175 * 1.17685, 10);
  });
});

describe('cableLoopResistanceOhm', () => {
  it('contoh DS-KBL: 2.5 mm², 10 m → 0.140 Ω', () => {
    expect(cableLoopResistanceOhm(CABLE_PV, { areaMm2: 2.5, lengthM: 10 })).toBeCloseTo(0.14, 10);
  });

  it('contoh §8.3 paket Minimum, 3 m: 4 mm² 26.3 mΩ; 6 mm² 17.5 mΩ; 10 mm² 10.5 mΩ', () => {
    expectNear(cableLoopResistanceOhm(CABLE_PV, { areaMm2: 4, lengthM: 3 }), 0.0263);
    expectNear(cableLoopResistanceOhm(CABLE_PV, { areaMm2: 6, lengthM: 3 }), 0.0175);
    expectNear(cableLoopResistanceOhm(CABLE_PV, { areaMm2: 10, lengthM: 3 }), 0.0105);
  });

  it('US4: 2.5 → 6 mm² menurunkan R ke 0.417×', () => {
    const thin = cableLoopResistanceOhm(CABLE_PV, { areaMm2: 2.5, lengthM: 5 });
    const thick = cableLoopResistanceOhm(CABLE_PV, { areaMm2: 6, lengthM: 5 });
    expectNear(thick / thin, 0.417);
  });

  it('sambungan menambah Rc; suhu konduktor 65 °C menaikkan R 17.7%', () => {
    const base = cableLoopResistanceOhm(CABLE_PV, { areaMm2: 4, lengthM: 3 });
    expect(cableLoopResistanceOhm(CABLE_PV, { areaMm2: 4, lengthM: 3, jointCount: 4 })).toBeCloseTo(
      base + 0.0012,
      10,
    );
    expect(
      cableLoopResistanceOhm(CABLE_PV, { areaMm2: 4, lengthM: 3, conductorTempC: 65 }),
    ).toBeCloseTo(base * 1.17685, 10);
  });

  it('panjang 0: hanya resistansi sambungan', () => {
    expect(cableLoopResistanceOhm(CABLE_PV, { areaMm2: 4, lengthM: 0 })).toBe(0);
  });
});

describe('cableVoltageDropV dan cableVoltageDropPct', () => {
  it('contoh DS-KBL: 20 A pada 0.140 Ω, 48 V → 2.80 V (5.83%)', () => {
    const dropV = cableVoltageDropV(20, 0.14);
    expect(dropV).toBeCloseTo(2.8, 10);
    expectNear(cableVoltageDropPct(dropV, 48), 5.83);
  });

  it('contoh §8.3: 4 mm², 3 m, 20 A, 12.6 V → 0.525 V (4.17%)', () => {
    const dropV = cableVoltageDropV(
      -20,
      cableLoopResistanceOhm(CABLE_PV, { areaMm2: 4, lengthM: 3 }),
    );
    expectNear(dropV, 0.525);
    expectNear(cableVoltageDropPct(dropV, 12.6), 4.17);
  });

  it('tanpa arus atau tanpa sumber: 0', () => {
    expect(cableVoltageDropV(0, 0.14)).toBe(0);
    expect(cableVoltageDropPct(1, 0)).toBe(0);
  });
});

describe('cableDropLevel', () => {
  it('hijau ≤ 3%, kuning 3–5%, merah > 5%', () => {
    expect(cableDropLevel(2.78)).toBe('ok');
    expect(cableDropLevel(3)).toBe('ok');
    expect(cableDropLevel(4.17)).toBe('warning');
    expect(cableDropLevel(5.83)).toBe('bad');
  });
});

describe('cableEffectiveAmpacityA', () => {
  it('kabel PV: faktor 1.00 sampai 60 °C, 0.92 pada 70 °C, 0.75 pada 90 °C', () => {
    expect(cableEffectiveAmpacityA(CABLE_PV, 44, 35)).toBe(44);
    expect(cableEffectiveAmpacityA(CABLE_PV, 44, 65)).toBeCloseTo(44 * 0.96, 10);
    expect(cableEffectiveAmpacityA(CABLE_PV, 44, 70)).toBeCloseTo(44 * 0.92, 10);
    expect(cableEffectiveAmpacityA(CABLE_PV, 44, 120)).toBeCloseTo(44 * 0.75, 10);
  });

  it('pengelompokan mengalikan; NYY tanpa tabel suhu', () => {
    expect(cableEffectiveAmpacityA(CABLE_NYY, 25, 65, 0.8)).toBeCloseTo(20, 10);
  });
});

describe('cableSteadyTempC', () => {
  it('contoh §8.3: PV 4 mm² (44 A), Ta 35 °C, 60 A → 90.8 °C', () => {
    expectNear(cableSteadyTempC(CABLE_PV, 60, 44, 35), 90.8);
  });

  it('contoh §8.3: NYY 2.5 mm² (25 A), Ta 30 °C, 35 A → 108 °C', () => {
    expectNear(cableSteadyTempC(CABLE_NYY, 35, 25, 30), 108);
  });

  it('tanpa arus = suhu lingkungan; arus tepat KHA pada Tref = Tmax', () => {
    expect(cableSteadyTempC(CABLE_PV, 0, 44, 35)).toBe(35);
    expect(cableSteadyTempC(CABLE_PV, 44, 44, 60)).toBe(90);
    expect(cableSteadyTempC(CABLE_PV, 44, 0, 35)).toBe(35);
  });
});

describe('cableStepTempC', () => {
  it('setelah satu konstanta waktu (10 menit) menempuh 63.2% selisih', () => {
    expect(cableStepTempC(CABLE_PV, 30, 90, 600)).toBeCloseTo(30 + 60 * (1 - Math.exp(-1)), 10);
  });

  it('dt 0 tidak berubah; dt sangat panjang mencapai suhu tunak', () => {
    expect(cableStepTempC(CABLE_PV, 30, 90, 0)).toBe(30);
    expect(cableStepTempC(CABLE_PV, 30, 90, 1e6)).toBeCloseTo(90, 6);
  });
});

describe('cableHeatLevel', () => {
  it('normal sampai KHA, hangat sampai 1.25×, panas di atasnya', () => {
    expect(cableHeatLevel(CABLE_PV, 44, 44, 60)).toBe('normal');
    expect(cableHeatLevel(CABLE_PV, 50, 44, 60)).toBe('warm');
    expect(cableHeatLevel(CABLE_PV, 60, 44, 60)).toBe('hot');
  });

  it('panas bila suhu konduktor mencapai Tmax walau arus di bawah KHA', () => {
    expect(cableHeatLevel(CABLE_NYY, 20, 25, 70)).toBe('hot');
  });
});

describe('cableIsOverheating', () => {
  const protection = { maxConductorTempC: 70, overheatDamageMarginK: 20, overheatDamageDelayS: 60 };

  it('zona rusak mulai Tmax + 20 K', () => {
    expect(cableIsOverheating(protection, 89.9)).toBe(false);
    expect(cableIsOverheating(protection, 108)).toBe(true);
  });
});
