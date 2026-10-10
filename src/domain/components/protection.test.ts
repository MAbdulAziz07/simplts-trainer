// Nilai acuan: docs/MODEL_FISIKA.md §9.1–9.2, §15 (toleransi 2%).
import { describe, expect, it } from 'vitest';
import {
  faultCurrentA,
  fuseMeltTimeS,
  mcbAcCanInterruptDc,
  mcbDcCanInterrupt,
  mcbEffectiveRatedCurrentA,
  mcbMagneticThresholdA,
  mcbTripTimeS,
  thermalDoseStep,
} from './protection';
import { within } from './test-fixtures';
import { FUSE_POINTS, MCB_AC_10A, MCB_DC_20A } from './test-fixtures-bos';

const expectNear = (actual: number, expected: number, tolerance?: number) =>
  expect(within(actual, expected, tolerance), `${actual} vs acuan ${expected}`).toBe(true);

describe('mcbEffectiveRatedCurrentA', () => {
  it('pada suhu acuan = In', () => {
    expect(mcbEffectiveRatedCurrentA(20, 55, 55)).toBe(20);
  });

  it('suhu 65 °C menurunkan dan 15 °C menaikkan In (Tref 55 °C)', () => {
    expect(mcbEffectiveRatedCurrentA(20, 65, 55)).toBeCloseTo(19, 10);
    expect(mcbEffectiveRatedCurrentA(20, 15, 55)).toBeCloseTo(24, 10);
  });
});

describe('mcbMagneticThresholdA', () => {
  it('contoh §9.1: 20 A kurva C pada DC → 11.2·In = 224 A', () => {
    expect(mcbMagneticThresholdA(20, 'C', true)).toBeCloseTo(224, 10);
  });

  it('AC: B 4, C 8, D 14 × In', () => {
    expect(mcbMagneticThresholdA(10, 'B', false)).toBe(40);
    expect(mcbMagneticThresholdA(10, 'C', false)).toBe(80);
    expect(mcbMagneticThresholdA(10, 'D', false)).toBe(140);
  });
});

describe('mcbTripTimeS', () => {
  const tripDc20 = (currentA: number) => mcbTripTimeS(currentA, 20, 'C', true);

  it('contoh §9.1: 25 A → 4108 s; 30 A → 1374 s; 50 A → 23.4 s', () => {
    expectNear(tripDc20(25), 4108);
    expectNear(tripDc20(30), 1374);
    expectNear(tripDc20(50), 23.4);
  });

  it('contoh US13: hubung singkat PV 17.1 A tidak trip; baterai 1448 A trip 0.02 s', () => {
    expect(tripDc20(17.1)).toBe(Number.POSITIVE_INFINITY);
    expect(tripDc20(1448)).toBe(0.02);
  });

  it('batas: sampai 1.13·In tidak trip; tepat di ambang magnetik 0.02 s', () => {
    expect(tripDc20(20)).toBe(Number.POSITIVE_INFINITY);
    expect(tripDc20(22.5)).toBe(Number.POSITIVE_INFINITY);
    expect(tripDc20(22.7)).toBeLessThan(7200);
    expect(tripDc20(224)).toBe(0.02);
    expect(tripDc20(223)).toBeGreaterThan(0.02);
  });

  it('melewati titik kurva dan menurun terhadap arus', () => {
    expectNear(tripDc20(29), 1800);
    expectNear(tripDc20(100), 6);
    expect(tripDc20(150)).toBeLessThan(tripDc20(100));
  });

  it('arah arus tidak berpengaruh; kurva AC trip magnetik lebih awal', () => {
    expect(tripDc20(-50)).toBe(tripDc20(50));
    expect(mcbTripTimeS(170, 20, 'C', false)).toBe(0.02);
  });

  it('suhu sekitar 65 °C mempercepat trip, 15 °C menunda', () => {
    const hot = mcbTripTimeS(25, mcbEffectiveRatedCurrentA(20, 65, 55), 'C', true);
    const cold = mcbTripTimeS(25, mcbEffectiveRatedCurrentA(20, 15, 55), 'C', true);
    expect(hot).toBeLessThan(tripDc20(25));
    expect(cold).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('fuseMeltTimeS', () => {
  it('contoh US12: 420 A pada fuse 10 A putus dalam 5 ms', () => {
    expect(fuseMeltTimeS(420, 10, FUSE_POINTS)).toBe(0.005);
  });

  it('contoh §9.2: fuse string 15 A dengan arus balik 17.1 A bertahan sekitar 9 jam', () => {
    expectNear(fuseMeltTimeS(17.1, 15, FUSE_POINTS) / 3600, 9, 0.1);
  });

  it('melewati titik kurva; di bawah 1.13·In tidak melebur', () => {
    expectNear(fuseMeltTimeS(30, 15, FUSE_POINTS), 150);
    expectNear(fuseMeltTimeS(75, 15, FUSE_POINTS), 1);
    expect(fuseMeltTimeS(15, 15, FUSE_POINTS)).toBe(Number.POSITIVE_INFINITY);
    expect(fuseMeltTimeS(0, 15, FUSE_POINTS)).toBe(Number.POSITIVE_INFINITY);
  });

  it('tanpa titik kurva: tidak melebur', () => {
    expect(fuseMeltTimeS(100, 15, [])).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('thermalDoseStep', () => {
  it('arus lebih tetap: dosis mencapai 1 tepat pada waktu trip', () => {
    let dose = 0;
    for (let second = 0; second < 23; second += 1) dose = thermalDoseStep(dose, 23, 2.5, 1);
    expect(dose).toBeCloseTo(1, 10);
  });

  it('di bawah In mendingin dengan τcool 300 s', () => {
    expect(thermalDoseStep(0.8, Number.POSITIVE_INFINITY, 0.5, 300)).toBeCloseTo(
      0.8 * Math.exp(-1),
      10,
    );
  });

  it('antara In dan 1.13·In dosis tetap', () => {
    expect(thermalDoseStep(0.4, Number.POSITIVE_INFINITY, 1.1, 60)).toBe(0.4);
  });
});

describe('mcbDcCanInterrupt', () => {
  it('contoh US13: 1448 A pada 12 V di bawah Icu 10 kA → padam', () => {
    expect(mcbDcCanInterrupt(MCB_DC_20A, 12.85, 1448)).toBe(true);
  });

  it('tegangan di atas Ue, arus di atas Icu, atau polaritas terbalik → rusak', () => {
    expect(mcbDcCanInterrupt(MCB_DC_20A, 600, 100)).toBe(false);
    expect(mcbDcCanInterrupt(MCB_DC_20A, 48, 10001)).toBe(false);
    expect(mcbDcCanInterrupt(MCB_DC_20A, 12, 100, true)).toBe(false);
    expect(mcbDcCanInterrupt({ ...MCB_DC_20A, polarized: false }, 12, 100, true)).toBe(true);
  });
});

describe('mcbAcCanInterruptDc', () => {
  it('tanpa rating DC: padam hanya di bawah 48 V dan sampai 3·In', () => {
    expect(mcbAcCanInterruptDc(MCB_AC_10A, 12, 30)).toBe(true);
    expect(mcbAcCanInterruptDc(MCB_AC_10A, 12, 31)).toBe(false);
    expect(mcbAcCanInterruptDc(MCB_AC_10A, 48, 15)).toBe(false);
  });

  it('dengan rating DC: dibatasi tegangan DC dan Icu', () => {
    const rated = { ...MCB_AC_10A, ratedVoltageDcV: 60 };
    expect(mcbAcCanInterruptDc(rated, 48, 500)).toBe(true);
    expect(mcbAcCanInterruptDc(rated, 72, 500)).toBe(false);
    expect(mcbAcCanInterruptDc(rated, 48, 7000)).toBe(false);
  });
});

describe('faultCurrentA', () => {
  it('contoh §9.1: VRLA 12.85 V, 4.5 mΩ + kabel 2 m / 16 mm² → 1448 A', () => {
    expectNear(faultCurrentA(12.85, 0.0045 + (0.0175 * 2 * 2) / 16), 1448);
  });

  it('contoh US12: 12.6 V pada jalur 0.03 Ω → 420 A', () => {
    expect(faultCurrentA(12.6, 0.03)).toBeCloseTo(420, 10);
  });

  it('resistansi 0: tak terhingga', () => {
    expect(faultCurrentA(12.6, 0)).toBe(Number.POSITIVE_INFINITY);
  });
});
