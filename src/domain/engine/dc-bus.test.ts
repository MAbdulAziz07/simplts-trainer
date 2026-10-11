import { describe, expect, it } from 'vitest';
import {
  batteryAcceptanceA,
  batteryChargeVoltageV,
  batteryConstantPowerPoint,
  batteryDischargeVoltageV,
  batteryOcvV,
} from '../components/battery';
import { BATTERY_VRLA_100AH, within } from '../components/test-fixtures';
import { bankCurrentA, bankRestVoltageV, solveBus } from './dc-bus';
import type { BatteryBank, BusSource } from './dc-bus';

const bank = (socPct: number, seriesCount = 1, parallelCount = 1): BatteryBank => {
  return { electrical: BATTERY_VRLA_100AH, seriesCount, parallelCount, socPct };
};
const noSink = () => 0;
/** Sumber arus tetap sampai tegangan setelan. */
const source = (currentA: number, limitV = 14.4): BusSource => {
  return { availableA: () => currentA, limitV };
};

describe('bankRestVoltageV', () => {
  it('satu baterai = OCV; dua seri = dua kali', () => {
    expect(bankRestVoltageV(bank(50))).toBeCloseTo(12.3, 6);
    expect(bankRestVoltageV(bank(50, 2))).toBeCloseTo(24.6, 6);
    expect(bankRestVoltageV(bank(50, 1, 3))).toBeCloseTo(12.3, 6);
  });
});

describe('bankCurrentA', () => {
  it('di tegangan istirahat: tanpa arus', () => {
    expect(bankCurrentA(bank(50), batteryOcvV(BATTERY_VRLA_100AH, 50))).toBe(0);
  });

  it('melepas: kebalikan batteryDischargeVoltageV', () => {
    const voltageV = batteryDischargeVoltageV(BATTERY_VRLA_100AH, 50, 30);
    expect(bankCurrentA(bank(50), voltageV)).toBeCloseTo(30, 6);
  });

  it('diisi: kebalikan batteryChargeVoltageV, bertanda negatif', () => {
    const voltageV = batteryChargeVoltageV(BATTERY_VRLA_100AH, 50, 15);
    expect(bankCurrentA(bank(50), voltageV)).toBeCloseTo(-15, 6);
  });

  it('arus isi dibatasi penerimaan baterai', () => {
    const acceptanceA = batteryAcceptanceA(BATTERY_VRLA_100AH, 95);
    expect(bankCurrentA(bank(95), 20)).toBeCloseTo(-acceptanceA, 6);
    expect(bankCurrentA(bank(100), 20)).toBeCloseTo(0, 9);
  });

  it('paralel menggandakan arus, seri menggandakan tegangan', () => {
    const voltageV = batteryDischargeVoltageV(BATTERY_VRLA_100AH, 50, 30);
    expect(bankCurrentA(bank(50, 1, 2), voltageV)).toBeCloseTo(60, 6);
    expect(bankCurrentA(bank(50, 2, 1), 2 * voltageV)).toBeCloseTo(30, 6);
  });
});

describe('solveBus', () => {
  it('tanpa sumber dan pemakai: tegangan istirahat, tanpa arus', () => {
    expect(solveBus(bank(50), 0, [], noSink)).toEqual({
      voltageV: bankRestVoltageV(bank(50)),
      batteryCurrentA: 0,
      sourceCurrentsA: [],
      sinkCurrentA: 0,
      regulated: false,
      collapsed: false,
    });
  });

  it('beban daya konstan 568,2 W: sama dengan bentuk tertutup §4.2', () => {
    const expected = batteryConstantPowerPoint(BATTERY_VRLA_100AH, 50, 568.2);
    const solution = solveBus(bank(50), 0, [], (voltageV) => 568.2 / voltageV);
    expect(solution.collapsed).toBe(false);
    expect(solution.voltageV).toBeCloseTo(expected?.voltageV ?? 0, 6);
    expect(solution.batteryCurrentA).toBeCloseTo(expected?.currentA ?? 0, 6);
    expect(solution.sinkCurrentA).toBeCloseTo(solution.batteryCurrentA, 9);
  });

  it('beban resistif 1 Ω', () => {
    const solution = solveBus(bank(80), 0, [], (voltageV) => voltageV / 1);
    expect(solution.batteryCurrentA).toBeCloseTo(solution.voltageV, 9);
    expect(solution.voltageV).toBeCloseTo(
      batteryDischargeVoltageV(BATTERY_VRLA_100AH, 80, solution.batteryCurrentA),
      6,
    );
  });

  it('daya yang diminta tidak tersedia: runtuh', () => {
    const solution = solveBus(bank(50), 0, [], (voltageV) => 50_000 / voltageV);
    expect(solution).toMatchObject({ collapsed: true, voltageV: 0, batteryCurrentA: 0 });
  });

  it('sumber di bawah setelan: semua arus tersedia masuk baterai', () => {
    const solution = solveBus(bank(50), 0, [source(10)], noSink);
    expect(solution.regulated).toBe(false);
    expect(solution.sourceCurrentsA).toEqual([10]);
    expect(solution.batteryCurrentA).toBeCloseTo(-10, 9);
    expect(solution.voltageV).toBeCloseTo(batteryChargeVoltageV(BATTERY_VRLA_100AH, 50, 10), 6);
  });

  it('sumber melebihi pemakai: sisanya mengisi baterai', () => {
    const solution = solveBus(bank(50), 0, [source(10)], () => 4);
    expect(solution.batteryCurrentA).toBeCloseTo(-6, 9);
  });

  it('baterai hampir penuh: tegangan ditahan di setelan, arus sumber dikurangi', () => {
    const solution = solveBus(bank(95), 0, [source(20)], noSink);
    expect(solution.regulated).toBe(true);
    expect(solution.voltageV).toBeCloseTo(14.4, 6);
    expect(solution.sourceCurrentsA[0]).toBeLessThan(20);
    expect(solution.batteryCurrentA).toBeCloseTo(-(solution.sourceCurrentsA[0] ?? 0), 9);
  });

  it('dua sumber di setelan yang sama berbagi sebanding arus tersedianya', () => {
    const solution = solveBus(bank(95), 0, [source(20), source(10)], noSink);
    const [first = 0, second = 0] = solution.sourceCurrentsA;
    expect(first / second).toBeCloseTo(2, 6);
    expect(first + second).toBeCloseTo(-solution.batteryCurrentA, 9);
  });

  it('setelan float lebih rendah: tegangan bus ikut turun', () => {
    const solution = solveBus(bank(100), 0, [source(20, 13.7)], () => 2);
    expect(solution.voltageV).toBeCloseTo(13.7, 6);
    expect(solution.sourceCurrentsA[0]).toBeCloseTo(2, 6);
    expect(solution.batteryCurrentA).toBeCloseTo(0, 6);
  });

  it('bankOffsetV: tegangan bus = tegangan bank dikurangi jatuh tegangan antarbaterai', () => {
    const plain = solveBus(bank(50, 2), 0, [], (voltageV) => voltageV / 2);
    const withDrop = solveBus(bank(50, 2), 0.5, [], (voltageV) => voltageV / 2);
    expect(withDrop.voltageV).toBeLessThan(plain.voltageV);
    expect(within(plain.voltageV - withDrop.voltageV, 0.5, 0.05)).toBe(true);
  });
});
