// Nilai acuan: docs/MODEL_FISIKA.md §11.2–11.3 (toleransi 2%).
import { describe, expect, it } from 'vitest';
import {
  sunAmbientTempC,
  sunCosZenith,
  sunDeclinationDeg,
  sunEquationOfTimeMin,
  sunIrradianceWm2,
  sunSolarHour,
} from './sun';
import { within } from './test-fixtures';

const expectNear = (actual: number, expected: number, tolerance?: number) =>
  expect(within(actual, expected, tolerance), `${actual} vs acuan ${expected}`).toBe(true);

const MARCH_21 = 80;
const JUNE_21 = 172;
const DECEMBER_21 = 355;

// Iradiasi harian langit cerah (kWh/m²), integrasi tiap menit.
const dailyKwhM2 = (dayOfYear: number, cloudFactor = 1) => {
  let sumWm2 = 0;
  for (let minute = 0; minute < 1440; minute += 1) {
    sumWm2 += sunIrradianceWm2(minute / 60, dayOfYear, cloudFactor);
  }
  return sumWm2 / 60 / 1000;
};

describe('sunDeclinationDeg', () => {
  it('mendekati 0° di ekuinoks dan ±23.45° di titik balik', () => {
    expect(Math.abs(sunDeclinationDeg(MARCH_21))).toBeLessThan(0.5);
    expect(sunDeclinationDeg(JUNE_21)).toBeCloseTo(23.45, 1);
    expect(sunDeclinationDeg(DECEMBER_21)).toBeCloseTo(-23.45, 1);
  });
});

describe('sunEquationOfTimeMin', () => {
  it('contoh §11.3: 21 Maret → −7.8 menit', () => {
    expectNear(sunEquationOfTimeMin(MARCH_21), -7.8);
  });
});

describe('sunSolarHour', () => {
  it('contoh §11.3: 10:00 WIB → 9.807 jam surya', () => {
    expect(sunSolarHour(10, MARCH_21)).toBeCloseTo(9.807, 2);
  });
});

describe('sunCosZenith', () => {
  it('contoh §11.3: 21 Maret 10:00 → 0.8391', () => {
    expectNear(sunCosZenith(10, MARCH_21), 0.8391);
  });

  it('negatif pada malam hari', () => {
    expect(sunCosZenith(0, MARCH_21)).toBeLessThan(0);
  });
});

describe('sunIrradianceWm2', () => {
  it('contoh §11.3: langit cerah 810 W/m²; kc 0.6 → 486; kc 0.25 → 203', () => {
    expectNear(sunIrradianceWm2(10, MARCH_21), 810);
    expectNear(sunIrradianceWm2(10, MARCH_21, 0.6), 486);
    expectNear(sunIrradianceWm2(10, MARCH_21, 0.25), 203);
  });

  it('malam hari dan faktor awan 0: iradiasi 0', () => {
    expect(sunIrradianceWm2(0, MARCH_21)).toBe(0);
    expect(sunIrradianceWm2(20, MARCH_21)).toBe(0);
    expect(sunIrradianceWm2(12, MARCH_21, 0)).toBe(0);
  });

  it('terbit sekitar 06:00 dan terbenam sekitar 18:00 WIB', () => {
    expect(sunIrradianceWm2(5.8, MARCH_21)).toBe(0);
    expect(sunIrradianceWm2(6.4, MARCH_21)).toBeGreaterThan(0);
    expect(sunIrradianceWm2(17.8, MARCH_21)).toBeGreaterThan(0);
    expect(sunIrradianceWm2(18.4, MARCH_21)).toBe(0);
  });

  it('§11.2: iradiasi harian cerah 7.2 (Mar), 6.6 (Jun), 6.4 (Des) kWh/m²; kc 0.7 ≈ 5.0', () => {
    expectNear(dailyKwhM2(MARCH_21), 7.2);
    expectNear(dailyKwhM2(JUNE_21), 6.6);
    expectNear(dailyKwhM2(DECEMBER_21), 6.4);
    expectNear(dailyKwhM2(MARCH_21, 0.7), 5.0);
  });
});

describe('sunAmbientTempC', () => {
  it('contoh §11.3: 10:00 hari cerah → 27.6 °C', () => {
    expectNear(sunAmbientTempC(10), 27.6);
  });

  it('terendah 24 °C pukul 06:00; tertinggi 32 °C (cerah) pukul 14:30', () => {
    expect(sunAmbientTempC(6)).toBeCloseTo(24, 10);
    expect(sunAmbientTempC(14.5)).toBeCloseTo(32, 10);
    expect(sunAmbientTempC(14.5, 0.25)).toBeCloseTo(29.75, 10);
  });

  it('menyambung melewati tengah malam dan tetap di antara 24 dan 32 °C', () => {
    expect(sunAmbientTempC(24)).toBeCloseTo(sunAmbientTempC(0), 10);
    expect(sunAmbientTempC(30)).toBeCloseTo(sunAmbientTempC(6), 10);
    for (let hour = 0; hour < 24; hour += 0.5) {
      expect(sunAmbientTempC(hour)).toBeGreaterThanOrEqual(24);
      expect(sunAmbientTempC(hour)).toBeLessThanOrEqual(32);
    }
    expect(sunAmbientTempC(2)).toBeLessThan(sunAmbientTempC(22));
  });
});
