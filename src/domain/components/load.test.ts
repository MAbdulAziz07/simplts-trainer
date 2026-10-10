// Nilai acuan: katalog beban (resistanceAtMaxOhm) dan docs/MODEL_FISIKA.md §5.3.
import { describe, expect, it } from 'vitest';
import { loadCurrentA, loadPowerW, loadResistanceOhm, loadSnapPowerW } from './load';
import { LOAD_AC_500W, LOAD_DC_200W } from './test-fixtures-bos';

describe('loadSnapPowerW', () => {
  it('membulatkan ke langkah 10 W dan membatasi 0..maks', () => {
    expect(loadSnapPowerW(LOAD_DC_200W, 104)).toBe(100);
    expect(loadSnapPowerW(LOAD_DC_200W, 106)).toBe(110);
    expect(loadSnapPowerW(LOAD_DC_200W, 900)).toBe(200);
    expect(loadSnapPowerW(LOAD_DC_200W, -20)).toBe(0);
  });

  it('langkah 0: hanya dibatasi', () => {
    expect(loadSnapPowerW({ ...LOAD_DC_200W, stepW: 0 }, 104)).toBe(104);
  });
});

describe('loadResistanceOhm', () => {
  it('setelan maksimum cocok dengan katalog: 0.72 Ω (DC 200 W) dan 96.8 Ω (AC 500 W)', () => {
    expect(loadResistanceOhm(LOAD_DC_200W, 200)).toBeCloseTo(0.72, 10);
    expect(loadResistanceOhm(LOAD_AC_500W, 500)).toBeCloseTo(96.8, 10);
  });

  it('setelan 0 = terbuka; setelan di atas rating dibatasi ke maksimum', () => {
    expect(loadResistanceOhm(LOAD_DC_200W, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(loadResistanceOhm(LOAD_DC_200W, 1000)).toBeCloseTo(0.72, 10);
  });
});

describe('loadCurrentA', () => {
  it('pada tegangan nominal: 200 W / 12 V = 16.67 A; 500 W / 220 V = 2.27 A', () => {
    expect(loadCurrentA(0.72, 12)).toBeCloseTo(16.667, 3);
    expect(loadCurrentA(96.8, 220)).toBeCloseTo(2.273, 3);
  });

  it('tanpa tegangan atau beban terbuka: 0 A', () => {
    expect(loadCurrentA(0.72, 0)).toBe(0);
    expect(loadCurrentA(Number.POSITIVE_INFINITY, 12)).toBe(0);
    expect(loadCurrentA(0, 12)).toBe(0);
  });
});

describe('loadPowerW', () => {
  it('pada tegangan nominal menyerap daya setelan', () => {
    expect(loadPowerW(96.8, 220)).toBeCloseTo(500, 10);
  });

  it('mengikuti kuadrat tegangan: 230 V → 546.5 W; 11 V (baterai turun) → 168.1 W', () => {
    expect(loadPowerW(96.8, 230)).toBeCloseTo(546.49, 2);
    expect(loadPowerW(0.72, 11)).toBeCloseTo(168.06, 2);
  });

  it('inverter mati (0 V) atau beban terbuka: 0 W', () => {
    expect(loadPowerW(96.8, 0)).toBe(0);
    expect(loadPowerW(Number.POSITIVE_INFINITY, 220)).toBe(0);
  });
});
