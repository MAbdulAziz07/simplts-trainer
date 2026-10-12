import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ENV,
  SIM_SPEEDS,
  IRRADIANCE_MAX_WM2,
  clockHourAt,
  cloudFactorOf,
  environmentAt,
  formatClock,
  withClockHour,
} from './sim-env';

describe('clockHourAt dan withClockHour', () => {
  it('jam maju bersama waktu simulasi dan berputar di 24', () => {
    expect(clockHourAt(DEFAULT_ENV, 0)).toBe(10);
    expect(clockHourAt(DEFAULT_ENV, 1800)).toBeCloseTo(10.5, 9);
    expect(clockHourAt(DEFAULT_ENV, 15 * 3600)).toBeCloseTo(1, 9);
  });

  it('menyetel jam tidak mengubah waktu simulasi', () => {
    const timeS = 5 * 3600;
    const settings = withClockHour(DEFAULT_ENV, timeS, 6.25);
    expect(clockHourAt(settings, timeS)).toBeCloseTo(6.25, 9);
    expect(clockHourAt(settings, timeS + 3600)).toBeCloseTo(7.25, 9);
  });
});

describe('cloudFactorOf', () => {
  it('cerah = 1, tertutup penuh = 0,12, di luar rentang dijepit', () => {
    expect(cloudFactorOf(0)).toBe(1);
    expect(cloudFactorOf(100)).toBeCloseTo(0.12, 9);
    expect(cloudFactorOf(50)).toBeCloseTo(0.56, 9);
    expect(cloudFactorOf(-20)).toBe(1);
    expect(cloudFactorOf(250)).toBeCloseTo(0.12, 9);
  });
});

describe('environmentAt', () => {
  it('otomatis: terang di siang hari, nol di malam hari, lebih redup saat berawan', () => {
    const noon = environmentAt({ ...DEFAULT_ENV, startHour: 12 }, 0);
    const night = environmentAt({ ...DEFAULT_ENV, startHour: 0 }, 0);
    const cloudy = environmentAt({ ...DEFAULT_ENV, startHour: 12, cloudCoverPct: 100 }, 0);
    expect(noon.irradianceWm2).toBeGreaterThan(900);
    expect(night.irradianceWm2).toBe(0);
    expect(cloudy.irradianceWm2).toBeCloseTo(noon.irradianceWm2 * 0.12, 6);
    expect(noon.ambientTempC).toBeGreaterThan(night.ambientTempC);
  });

  it('manual: nilai slider dipakai apa adanya dan dijepit ke rentangnya', () => {
    const manual = { ...DEFAULT_ENV, manualIrradianceWm2: 400, manualAmbientTempC: 35 };
    expect(environmentAt(manual, 0)).toEqual({ irradianceWm2: 400, ambientTempC: 35 });
    expect(environmentAt(manual, 12 * 3600)).toEqual({ irradianceWm2: 400, ambientTempC: 35 });
    const over = { ...DEFAULT_ENV, manualIrradianceWm2: 9999, manualAmbientTempC: -40 };
    expect(environmentAt(over, 0)).toEqual({ irradianceWm2: IRRADIANCE_MAX_WM2, ambientTempC: 15 });
  });
});

describe('formatClock', () => {
  it('jam desimal menjadi JJ:MM', () => {
    expect(formatClock(10.5)).toBe('10:30');
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(23.999)).toBe('23:59');
    expect(formatClock(24.25)).toBe('00:15');
  });
});

describe('SIM_SPEEDS', () => {
  it('waktu nyata, 1 menit, 10 menit, dan 1 jam simulasi per detik', () => {
    expect([...SIM_SPEEDS]).toEqual([1, 60, 600, 3600]);
  });
});
