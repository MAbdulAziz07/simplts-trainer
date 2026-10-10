// Nilai acuan: katalog grid-pln dan docs/MODEL_FISIKA.md §6.2.
import { describe, expect, it } from 'vitest';
import { gridIsWithinWindow, gridNetPowerW, gridVoltageWindow } from './grid';
import { GRID_PLN } from './test-fixtures-bos';

describe('gridVoltageWindow', () => {
  it('220 V +5% / −10% → 198..231 V', () => {
    const { minVoltageV, maxVoltageV } = gridVoltageWindow(GRID_PLN);
    expect(minVoltageV).toBeCloseTo(198, 10);
    expect(maxVoltageV).toBeCloseTo(231, 10);
  });
});

describe('gridIsWithinWindow', () => {
  it('nominal 220 V / 50 Hz di dalam jendela', () => {
    expect(gridIsWithinWindow(GRID_PLN, 220, 50)).toBe(true);
    expect(gridIsWithinWindow(GRID_PLN, 199, 49.2)).toBe(true);
  });

  it('tegangan di luar jendela atau jaringan padam', () => {
    expect(gridIsWithinWindow(GRID_PLN, 197, 50)).toBe(false);
    expect(gridIsWithinWindow(GRID_PLN, 232, 50)).toBe(false);
    expect(gridIsWithinWindow(GRID_PLN, 0, 0)).toBe(false);
  });

  it('frekuensi di luar 50 ±1 Hz', () => {
    expect(gridIsWithinWindow(GRID_PLN, 220, 51.2)).toBe(false);
    expect(gridIsWithinWindow(GRID_PLN, 220, 48.8)).toBe(false);
    expect(gridIsWithinWindow(GRID_PLN, 220, 48.8, 2)).toBe(true);
  });
});

describe('gridNetPowerW', () => {
  it('positif = impor, negatif = ekspor', () => {
    expect(gridNetPowerW(500, 0)).toBe(500);
    expect(gridNetPowerW(338, 638)).toBe(-300);
    expect(gridNetPowerW(0, 0)).toBe(0);
  });
});
