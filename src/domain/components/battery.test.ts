// Nilai acuan: docs/MODEL_FISIKA.md §4.2, §4.3, §4.7, §15 (toleransi 2%).
import { describe, expect, it } from 'vitest';
import {
  batteryAcceptanceA,
  batteryChargeEfficiency,
  batteryChargeTempCompensationV,
  batteryChargeVoltageV,
  batteryConstantPowerPoint,
  batteryDischargeVoltageV,
  batteryEffectiveCapacityAh,
  batteryOcvV,
  batteryResistanceOhm,
  batteryStepSocPct,
} from './battery';
import { BATTERY_LFP_24V_100AH as LFP, BATTERY_VRLA_100AH as VRLA, within } from './test-fixtures';

const expectNear = (actual: number, expected: number, tolerance?: number) =>
  expect(within(actual, expected, tolerance), `${actual} vs acuan ${expected}`).toBe(true);

// Kabel 1 m / 25 mm² pergi-pulang (§4.7).
const CABLE_OHM = 0.0014;
const INVERTER_INPUT_W = 568.2;

describe('batteryOcvV', () => {
  it('mengikuti tabel OCV VRLA, termasuk SoC 0% dan 100%', () => {
    expect(batteryOcvV(VRLA, 0)).toBe(11.6);
    expect(batteryOcvV(VRLA, 50)).toBeCloseTo(12.3, 10);
    expect(batteryOcvV(VRLA, 85)).toBeCloseTo(12.7, 10);
    expect(batteryOcvV(VRLA, 100)).toBe(12.85);
  });

  it('SoC di luar 0..100 dibatasi', () => {
    expect(batteryOcvV(VRLA, -10)).toBe(11.6);
    expect(batteryOcvV(VRLA, 140)).toBe(12.85);
  });

  it('LiFePO4: kurva datar di tengah', () => {
    expect(batteryOcvV(LFP, 70) - batteryOcvV(LFP, 30)).toBeLessThan(0.4);
  });
});

describe('batteryResistanceOhm', () => {
  it('contoh §4.7: R(0.5) = 7.9 mΩ; penuh 4.5 mΩ; kosong 11.25 mΩ', () => {
    expectNear(batteryResistanceOhm(VRLA, 50), 0.0079);
    expect(batteryResistanceOhm(VRLA, 100)).toBeCloseTo(0.0045, 10);
    expect(batteryResistanceOhm(VRLA, 0)).toBeCloseTo(0.01125, 10);
  });

  it('LiFePO4: tetap terhadap SoC', () => {
    expect(batteryResistanceOhm(LFP, 10)).toBeCloseTo(0.0016, 10);
  });
});

describe('batteryDischargeVoltageV', () => {
  it('contoh §4.7: 47.9 A pada SoC 50% dengan kabel → 11.86 V', () => {
    expectNear(batteryDischargeVoltageV(VRLA, 50, -47.9, CABLE_OHM), 11.86);
    expectNear(batteryDischargeVoltageV(VRLA, 50, 47.9, CABLE_OHM), 11.86);
  });

  it('tanpa arus = OCV selama SoC belum rendah', () => {
    expect(batteryDischargeVoltageV(VRLA, 80, 0)).toBeCloseTo(12.65, 5);
  });

  it('SoC 0%: tegangan runtuh 2 V di bawah OCV; arus sangat besar tidak memberi nilai negatif', () => {
    expect(batteryDischargeVoltageV(VRLA, 0, 0)).toBeCloseTo(9.6, 10);
    expect(batteryDischargeVoltageV(VRLA, 0, 5000)).toBe(0);
  });

  it('LiFePO4: V = OCV − I·Rint', () => {
    expect(batteryDischargeVoltageV(LFP, 50, 100)).toBeCloseTo(26.32 - 0.16, 10);
  });
});

describe('batteryChargeVoltageV', () => {
  it('bulk berakhir (14.4 V) di SoC 88–92% pada 0.2–0.3 C (§4.2)', () => {
    expectNear(batteryChargeVoltageV(VRLA, 88, 30), 14.4);
    expectNear(batteryChargeVoltageV(VRLA, 92, 20), 14.4);
    expect(batteryChargeVoltageV(VRLA, 50, 20)).toBeLessThan(13.2);
  });

  it('SoC 0% dan 100% tanpa arus: OCV + ΔVover', () => {
    expect(batteryChargeVoltageV(VRLA, 0, 0)).toBeCloseTo(11.9, 10);
    expect(batteryChargeVoltageV(VRLA, 100, 0)).toBeCloseTo(14.45, 10);
  });

  it('LiFePO4: 3.65 V/sel baru tercapai mendekati SoC 100%', () => {
    expect(batteryChargeVoltageV(LFP, 90, 50)).toBeLessThan(28.4);
    expectNear(batteryChargeVoltageV(LFP, 100, 0), 3.65 * 8);
  });
});

describe('batteryConstantPowerPoint', () => {
  it('contoh §4.7: 568.2 W pada SoC 50%, R 9.3 mΩ → 47.9 A; 11.86 V', () => {
    const point = batteryConstantPowerPoint(VRLA, 50, INVERTER_INPUT_W, CABLE_OHM);
    expectNear(point?.currentA ?? 0, 47.9, 0.01);
    expectNear(point?.voltageV ?? 0, 11.86, 0.01);
  });

  it('LVD 10.5 V tercapai sebelum SoC 0%, makin awal pada beban berat (§4.7, US9)', () => {
    const lvdSocPct = (powerW: number) => {
      let socPct = 50;
      while ((batteryConstantPowerPoint(VRLA, socPct, powerW, CABLE_OHM)?.voltageV ?? 0) > 10.5) {
        socPct -= 0.1;
      }
      return socPct;
    };
    const medium = lvdSocPct(INVERTER_INPUT_W);
    expect(medium).toBeGreaterThan(4.5);
    expect(medium).toBeLessThan(7.5);
    expect(lvdSocPct(113.4)).toBeLessThan(medium);
    expect(lvdSocPct(113.4)).toBeGreaterThan(0);
  });

  it('daya 0: tanpa arus', () => {
    expect(batteryConstantPowerPoint(VRLA, 50, 0)).toEqual({
      currentA: 0,
      voltageV: 12.3 - 2 * Math.exp(-10),
    });
  });

  it('daya melebihi kemampuan (diskriminan negatif): null', () => {
    expect(batteryConstantPowerPoint(VRLA, 50, 20000, CABLE_OHM)).toBeNull();
    expect(batteryConstantPowerPoint(VRLA, 0, 3000, CABLE_OHM)).toBeNull();
  });

  it('SoC 100%: arus lebih kecil daripada pada SoC 50%', () => {
    const full = batteryConstantPowerPoint(VRLA, 100, INVERTER_INPUT_W, CABLE_OHM);
    expect(full?.currentA).toBeLessThan(47.9);
    expect(full?.voltageV).toBeGreaterThan(12.5);
  });
});

describe('batteryEffectiveCapacityAh', () => {
  it('titik tabel VRLA: 0 °C 86%, 25 °C 100%, 40 °C 105%', () => {
    expect(batteryEffectiveCapacityAh(VRLA, 0)).toBeCloseTo(86, 10);
    expect(batteryEffectiveCapacityAh(VRLA, 25)).toBeCloseTo(100, 10);
    expect(batteryEffectiveCapacityAh(VRLA, 40)).toBeCloseTo(105, 10);
  });

  it('suhu 15 °C (interpolasi) dan 65 °C (ekstrapolasi 0.0056/°C)', () => {
    expect(batteryEffectiveCapacityAh(VRLA, 15)).toBeCloseTo(94.4, 10);
    expect(batteryEffectiveCapacityAh(VRLA, 65)).toBeCloseTo(119, 10);
  });

  it('di bawah titik terendah turun, tidak pernah negatif', () => {
    expect(batteryEffectiveCapacityAh(VRLA, -10)).toBeCloseTo(80.4, 10);
    expect(batteryEffectiveCapacityAh(LFP, -200)).toBe(0);
  });
});

describe('batteryChargeEfficiency', () => {
  it('VRLA: 0.95 sampai SoC 80%, turun linier ke 0.70 pada 100%', () => {
    expect(batteryChargeEfficiency(VRLA, 0)).toBe(0.95);
    expect(batteryChargeEfficiency(VRLA, 80)).toBe(0.95);
    expect(batteryChargeEfficiency(VRLA, 90)).toBeCloseTo(0.825, 10);
    expect(batteryChargeEfficiency(VRLA, 100)).toBe(0.7);
  });

  it('LiFePO4: 0.96 di semua SoC', () => {
    expect(batteryChargeEfficiency(LFP, 0)).toBe(0.96);
    expect(batteryChargeEfficiency(LFP, 100)).toBe(0.96);
  });
});

describe('batteryAcceptanceA', () => {
  it('a·Cn·(1 − SoC): SoC 0% → 100 A, 90% → 10 A, 100% → 0 A', () => {
    expect(batteryAcceptanceA(VRLA, 0)).toBe(100);
    expect(batteryAcceptanceA(VRLA, 90)).toBeCloseTo(10, 10);
    expect(batteryAcceptanceA(VRLA, 100)).toBe(0);
  });

  it('akhir absorption: di bawah 0.02·Cn mulai SoC 98%', () => {
    expect(batteryAcceptanceA(VRLA, 98.5)).toBeLessThan(2);
  });
});

describe('batteryStepSocPct', () => {
  it('contoh §4.7: 47.9 A selama 10 menit menurunkan SoC 12.5% (Peukert)', () => {
    expectNear(50 - batteryStepSocPct(VRLA, 50, -47.9, 600), 12.5);
  });

  it('§15: pengosongan 47.9 A dari 100% ke 0% butuh 1.33 jam', () => {
    let socPct = 100;
    let seconds = 0;
    while (socPct > 0) {
      socPct = batteryStepSocPct(VRLA, socPct, -47.9, 10);
      seconds += 10;
    }
    expectNear(seconds / 3600, 1.33);
  });

  it('contoh §4.7 LiFePO4: isi 50 A dari 20% mencapai 95% dalam 1.56 jam', () => {
    let socPct = 20;
    let seconds = 0;
    while (socPct < 95) {
      socPct = batteryStepSocPct(LFP, socPct, 50, 10);
      seconds += 10;
    }
    expectNear(seconds / 3600, 1.56);
  });

  it('mengisi VRLA: ηc 0.95 di bawah SoC 80%', () => {
    expectNear(batteryStepSocPct(VRLA, 50, 20, 3600) - 50, 0.95 * 20, 0.001);
  });

  it('batas: SoC 0% tidak turun lagi, SoC 100% tidak naik lagi', () => {
    expect(batteryStepSocPct(VRLA, 0, -50, 600)).toBe(0);
    expect(batteryStepSocPct(VRLA, 100, 30, 600)).toBe(100);
    expect(batteryStepSocPct(VRLA, 99.9, 30, 3600)).toBe(100);
  });

  it('tanpa arus: swa-lepas 0.1% per hari', () => {
    expect(batteryStepSocPct(VRLA, 80, 0, 86400)).toBeCloseTo(79.9, 10);
  });

  it('suhu 15 °C mempercepat dan 65 °C memperlambat penurunan SoC', () => {
    const at25 = 50 - batteryStepSocPct(VRLA, 50, -47.9, 600);
    expectNear(50 - batteryStepSocPct(VRLA, 50, -47.9, 600, 15), at25 / 0.944, 0.001);
    expectNear(50 - batteryStepSocPct(VRLA, 50, -47.9, 600, 65), at25 / 1.19, 0.001);
  });
});

describe('batteryChargeTempCompensationV', () => {
  it('contoh §4.2 pada 35 °C: float −0.18 V (13.7 → 13.52), cycle −0.30 V (14.4 → 14.10)', () => {
    expect(batteryChargeTempCompensationV(-3, 6, 35)).toBeCloseTo(-0.18, 10);
    expect(batteryChargeTempCompensationV(-5, 6, 35)).toBeCloseTo(-0.3, 10);
  });

  it('25 °C tanpa koreksi; 15 °C menaikkan, 65 °C menurunkan', () => {
    expect(batteryChargeTempCompensationV(-5, 6, 25)).toBeCloseTo(0, 10);
    expect(batteryChargeTempCompensationV(-5, 6, 15)).toBeCloseTo(0.3, 10);
    expect(batteryChargeTempCompensationV(-5, 6, 65)).toBeCloseTo(-1.2, 10);
  });
});
