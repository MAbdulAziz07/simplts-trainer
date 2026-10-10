// Nilai acuan: docs/MODEL_FISIKA.md §5.2–5.4, §15 (toleransi 2%).
import { describe, expect, it } from 'vitest';
import { batteryConstantPowerPoint } from './battery';
import {
  inverterDcInputW,
  inverterEfficiency,
  inverterLossCoefficients,
  inverterLowVoltageAlarm,
  inverterOverloadTimeS,
  inverterStepDcState,
  type InverterDcState,
} from './inverter';
import { BATTERY_VRLA_100AH, within } from './test-fixtures';
import { INVERTER_500W as INV, INVERTER_500W_PROTECTION as PROTECTION } from './test-fixtures-bos';

const expectNear = (actual: number, expected: number, tolerance?: number) =>
  expect(within(actual, expected, tolerance), `${actual} vs acuan ${expected}`).toBe(true);

describe('inverterLossCoefficients', () => {
  it('tabel §5.2, 500 W: k1 0.0379, k2 1.650e-4', () => {
    const { k1, k2 } = inverterLossCoefficients(INV);
    expectNear(k1, 0.0379);
    expectNear(k2, 1.65e-4);
  });

  it('tabel §5.2, 1.5 kW: k1 0.0228, k2 5.00e-5', () => {
    const { k1, k2 } = inverterLossCoefficients({
      ...INV,
      ratedAcPowerW: 1500,
      noLoadPowerW: 20,
      efficiencyAtHalfLoad: 0.92,
      efficiencyAtFullLoad: 0.9,
    });
    expectNear(k1, 0.0228);
    expectNear(k2, 5.0e-5);
  });
});

describe('inverterDcInputW', () => {
  it('contoh §5.4: beban 500 W → 568.2 W; 100 W → 113.4 W', () => {
    expectNear(inverterDcInputW(INV, 500), 568.2, 0.005);
    expectNear(inverterDcInputW(INV, 100), 113.4);
  });

  it('tanpa beban: hanya P0 = 8 W', () => {
    expect(inverterDcInputW(INV, 0)).toBe(8);
    expect(inverterDcInputW(INV, -10)).toBe(8);
  });

  it('beban di atas rating tetap terhitung (rugi kuadrat membesar)', () => {
    expect(inverterDcInputW(INV, 750)).toBeGreaterThan(750 / 0.88);
  });

  it('§4.7: masukan 568.2 W menarik 47.9 A dari VRLA 100 Ah pada SoC 50%', () => {
    const point = batteryConstantPowerPoint(
      BATTERY_VRLA_100AH,
      50,
      inverterDcInputW(INV, 500),
      0.0014,
    );
    expectNear(point?.currentA ?? 0, 47.9, 0.01);
  });
});

describe('inverterEfficiency', () => {
  it('tabel §5.2: η 0.73 / 0.83 / 0.89 / 0.88 pada 5 / 10 / 25 / 100% beban', () => {
    expectNear(inverterEfficiency(INV, 25), 0.734);
    expectNear(inverterEfficiency(INV, 50), 0.83);
    expectNear(inverterEfficiency(INV, 125), 0.89);
    expectNear(inverterEfficiency(INV, 250), 0.9, 0.001);
    expectNear(inverterEfficiency(INV, 500), 0.88, 0.001);
  });

  it('tanpa beban: 0', () => {
    expect(inverterEfficiency(INV, 0)).toBe(0);
  });
});

describe('inverterOverloadTimeS', () => {
  const time = (ratio: number) => inverterOverloadTimeS(INV, PROTECTION, 500 * ratio);

  it('sampai Pr kontinu', () => {
    expect(time(0.5)).toBe(Number.POSITIVE_INFINITY);
    expect(time(1)).toBe(Number.POSITIVE_INFINITY);
  });

  it('§5.3: 1.00–1.10 → 600 s; 1.25 → 60 s; 1.5 → 10 s; 2.0 → 1 s; ≥ lonjakan → 0.1 s', () => {
    expect(time(1.05)).toBe(600);
    expectNear(time(1.1), 600);
    expectNear(time(1.25), 60);
    expectNear(time(1.5), 10);
    expectNear(time(2), 1);
    expect(time(3)).toBe(0.1);
    expect(time(10)).toBe(0.1);
  });

  it('di antara titik: menurun terhadap beban', () => {
    expect(time(1.35)).toBeLessThan(60);
    expect(time(1.35)).toBeGreaterThan(10);
  });

  it('tanpa kurva: tidak mati', () => {
    expect(inverterOverloadTimeS(INV, { ...PROTECTION, overloadCurve: [] }, 5000)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe('inverterLowVoltageAlarm', () => {
  it('alarm di bawah 11.0 V', () => {
    expect(inverterLowVoltageAlarm(INV, 10.9)).toBe(true);
    expect(inverterLowVoltageAlarm(INV, 11.0)).toBe(false);
  });
});

describe('inverterStepDcState', () => {
  const running: InverterDcState = { on: true, lowVoltageS: 0 };
  const stopped: InverterDcState = { on: false, lowVoltageS: 0 };

  it('tegangan normal: tetap hidup', () => {
    expect(inverterStepDcState(INV, running, 12.3, 1)).toEqual(running);
  });

  it('LVD: di bawah 10.5 V selama 10 s baru mati; sag singkat diabaikan', () => {
    let state = running;
    for (let second = 0; second < 9; second += 1) state = inverterStepDcState(INV, state, 10.2, 1);
    expect(state).toEqual({ on: true, lowVoltageS: 9 });
    expect(inverterStepDcState(INV, state, 11.8, 1)).toEqual(running);
    expect(inverterStepDcState(INV, state, 10.2, 1)).toEqual(stopped);
  });

  it('histeresis: setelah mati baru hidup lagi pada 12.5 V', () => {
    expect(inverterStepDcState(INV, stopped, 12.0, 1).on).toBe(false);
    expect(inverterStepDcState(INV, stopped, 12.5, 1).on).toBe(true);
  });

  it('HVD: di atas 15.5 V mati seketika dan tidak hidup selama masih tinggi', () => {
    expect(inverterStepDcState(INV, running, 15.6, 1)).toEqual(stopped);
    expect(inverterStepDcState(INV, stopped, 15.6, 1).on).toBe(false);
    expect(inverterStepDcState(INV, stopped, 13.0, 1).on).toBe(true);
  });
});
