// Nilai acuan: docs/MODEL_FISIKA.md §2.2–2.4, §15 (toleransi 2%).
import { describe, expect, it } from 'vitest';
import { pvCurveAt } from './pv';
import { pvArrayVocV, pvUniformArray } from './pv-array';
import {
  pwmChargePoint,
  pwmDetectVoltageScale,
  pwmLoadConnected,
  pwmLoadOverloadTimeS,
  pwmNextStage,
  pwmSetpoints,
  pwmVocStatus,
} from './scc';
import { PV_240W_60P, PV_GENERIC_100WP, PV_JS185CB_48P, within } from './test-fixtures';
import { PWM_RBL_20A as SCC, PWM_RBL_20A_PROTECTION as PROTECTION } from './test-fixtures-bos';

const expectNear = (actual: number, expected: number, tolerance?: number) =>
  expect(within(actual, expected, tolerance), `${actual} vs acuan ${expected}`).toBe(true);

const setpoints12 = pwmSetpoints(SCC, 'sealed');
const hot185x2 = pvUniformArray(pvCurveAt(PV_JS185CB_48P, 800, 55), 1, 2);

describe('pwmDetectVoltageScale', () => {
  it('baterai 12 V terbaca sebagai sistem 12 V; baterai 24 V sebagai 24 V', () => {
    expect(pwmDetectVoltageScale(SCC, 12.6)).toBe(1);
    expect(pwmDetectVoltageScale(SCC, 25.2)).toBe(2);
  });

  it('US17: PV dipasang dulu, Voc 22 V terbaca sebagai sistem 24 V', () => {
    expect(pwmDetectVoltageScale(SCC, 22)).toBe(2);
    expect(pwmDetectVoltageScale(SCC, 16)).toBe(1);
  });
});

describe('pwmSetpoints', () => {
  it('sistem 12 V: ambang datasheet RBL', () => {
    expect(setpoints12).toEqual({
      voltageScale: 1,
      absorptionV: 14.4,
      floatV: 13.7,
      rechargeV: 13.0,
      loadDisconnectV: 10.7,
      loadReconnectV: 12.6,
      pvVocMaxV: 24,
      pvPowerMaxW: 240,
    });
  });

  it('jenis baterai mengubah Vabs: gel 14.2 V, flooded 14.6 V', () => {
    expect(pwmSetpoints(SCC, 'gel').absorptionV).toBe(14.2);
    expect(pwmSetpoints(SCC, 'flooded').absorptionV).toBe(14.6);
  });

  it('sistem 24 V: ambang × 2, batas PV 48 V / 480 W', () => {
    const setpoints24 = pwmSetpoints(SCC, 'sealed', 2);
    expect(setpoints24.absorptionV).toBe(28.8);
    expect(setpoints24.loadDisconnectV).toBe(21.4);
    expect(setpoints24.pvVocMaxV).toBe(48);
    expect(setpoints24.pvPowerMaxW).toBe(480);
  });
});

describe('pwmVocStatus', () => {
  it('panel kelas 12 V (Voc 22 V dan 17.7 V) normal pada batas 24 V', () => {
    expect(pwmVocStatus(22, 24, PROTECTION)).toBe('ok');
    expect(pwmVocStatus(24, 24, PROTECTION)).toBe('ok');
  });

  it('sampai 1.2 × batas galat; di atasnya rusak (240W-60P, Voc 37.2 V)', () => {
    expect(pwmVocStatus(28.5, 24, PROTECTION)).toBe('fault');
    expect(pwmVocStatus(pvArrayVocV([[pvCurveAt(PV_240W_60P, 1000, 25)]]), 24, PROTECTION)).toBe(
      'damaged',
    );
  });
});

describe('pwmChargePoint', () => {
  it('contoh §2.4: 2P JS185CB-48P, Vbat 12.6 V → dibatasi 20.00 A, 252 W', () => {
    const point = pwmChargePoint(SCC, hot185x2, 12.6);
    expect(point.pvVoltageV).toBeCloseTo(12.9, 10);
    expect(Math.abs(point.chargeCurrentA - 20)).toBeLessThanOrEqual(0.2);
    expectNear(point.harvestW, 252);
  });

  it('contoh §2.4: Vbat 14.4 V → 14.89 A, 214.4 W', () => {
    const point = pwmChargePoint(SCC, hot185x2, 14.4);
    expectNear(point.chargeCurrentA, 14.89);
    expectNear(point.harvestW, 214.4);
  });

  it('contoh §2.4: satu panel STC, Vbat 12.7 V → 165.3 W', () => {
    const array = pvUniformArray(pvCurveAt(PV_JS185CB_48P, 1000, 25), 1, 1);
    expectNear(pwmChargePoint(SCC, array, 12.7).harvestW, 165.3);
  });

  it('paket Minimum: 2P panel 100 Wp STC, Vbat 12.6 V → mendekati 2·Isc, di bawah 20 A', () => {
    const array = pvUniformArray(pvCurveAt(PV_GENERIC_100WP, 1000, 25), 1, 2);
    const point = pwmChargePoint(SCC, array, 12.6);
    expectNear(point.chargeCurrentA, 2 * 5.97);
    expect(point.pvPowerW).toBeCloseTo(point.chargeCurrentA * 12.9, 10);
  });

  it('penerimaan baterai membatasi arus (absorption); baterai penuh → 0 A', () => {
    expect(pwmChargePoint(SCC, hot185x2, 14.4, 6).chargeCurrentA).toBe(6);
    expect(pwmChargePoint(SCC, hot185x2, 14.4, 0).chargeCurrentA).toBe(0);
  });

  it('iradiasi 0: tanpa arus, tidak ada arus balik', () => {
    const dark = pvUniformArray(pvCurveAt(PV_JS185CB_48P, 0, 25), 1, 2);
    expect(pwmChargePoint(SCC, dark, 12.6)).toEqual({
      pvVoltageV: 12.9,
      chargeCurrentA: 0,
      harvestW: 0,
      pvPowerW: 0,
    });
  });

  it('tanpa baterai (0 V): tidak mengisi', () => {
    expect(pwmChargePoint(SCC, hot185x2, 0).chargeCurrentA).toBe(0);
  });
});

describe('pwmNextStage', () => {
  const next = (stage: Parameters<typeof pwmNextStage>[2], voltageV: number, elapsedS = 0) =>
    pwmNextStage(SCC, setpoints12, stage, voltageV, elapsedS);

  it('bulk → absorption saat Vbat mencapai 14.4 V', () => {
    expect(next('bulk', 14.39)).toBe('bulk');
    expect(next('bulk', 14.4)).toBe('absorption');
  });

  it('absorption → float setelah 120 menit', () => {
    expect(next('absorption', 14.4, 7199)).toBe('absorption');
    expect(next('absorption', 14.4, 7200)).toBe('float');
  });

  it('float → bulk saat Vbat turun di bawah 13.0 V', () => {
    expect(next('float', 13.0)).toBe('float');
    expect(next('float', 12.99)).toBe('bulk');
  });
});

describe('pwmLoadConnected', () => {
  it('putus pada 10.7 V, tersambung lagi pada 12.6 V, di antaranya tetap', () => {
    expect(pwmLoadConnected(setpoints12, true, 10.7)).toBe(false);
    expect(pwmLoadConnected(setpoints12, true, 11.5)).toBe(true);
    expect(pwmLoadConnected(setpoints12, false, 11.5)).toBe(false);
    expect(pwmLoadConnected(setpoints12, false, 12.6)).toBe(true);
  });
});

describe('pwmLoadOverloadTimeS', () => {
  it('sampai Iload_max 10 A tidak diputus', () => {
    expect(pwmLoadOverloadTimeS(SCC, PROTECTION, 10)).toBe(Number.POSITIVE_INFINITY);
    expect(pwmLoadOverloadTimeS(SCC, PROTECTION, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it('§2.3: 1.25× → 60 s; 1.5× → 5 s; makin besar makin cepat', () => {
    expectNear(pwmLoadOverloadTimeS(SCC, PROTECTION, 12.5), 60);
    expectNear(pwmLoadOverloadTimeS(SCC, PROTECTION, 15), 5);
    expect(pwmLoadOverloadTimeS(SCC, PROTECTION, 11)).toBe(60);
    expect(pwmLoadOverloadTimeS(SCC, PROTECTION, 47.3)).toBeLessThan(1);
  });

  it('tanpa kurva: tidak diputus', () => {
    const noCurve = { ...PROTECTION, loadOverloadCurve: [] };
    expect(pwmLoadOverloadTimeS(SCC, noCurve, 30)).toBe(Number.POSITIVE_INFINITY);
  });
});
