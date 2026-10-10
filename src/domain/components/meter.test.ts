// Nilai acuan: docs/MODEL_FISIKA.md §10.2–10.3, §15.
import { describe, expect, it } from 'vitest';
import {
  kwhMeterAccumulate,
  kwhMeterCanMeasure,
  kwhMeterPulseCount,
  kwhMeterReadingKwh,
  type KwhMeterEnergy,
} from './meter';
import { KWH_METER_SDM230 as METER } from './test-fixtures-bos';

const EMPTY: KwhMeterEnergy = { importWh: 0, exportWh: 0 };

// Contoh §10.3: 30 menit ekspor 300 W lalu 30 menit impor 500 W, langkah 1 s.
const runExample = (reversed = false) => {
  let energy = EMPTY;
  for (let second = 0; second < 1800; second += 1) {
    energy = kwhMeterAccumulate(energy, -300, 1, reversed);
  }
  for (let second = 0; second < 1800; second += 1) {
    energy = kwhMeterAccumulate(energy, 500, 1, reversed);
  }
  return energy;
};

describe('kwhMeterAccumulate', () => {
  it('contoh §10.3: ekspor 150 Wh, impor 250 Wh (±0.5%)', () => {
    const energy = runExample();
    expect(energy.exportWh).toBeCloseTo(150, 6);
    expect(energy.importWh).toBeCloseTo(250, 6);
  });

  it('terpasang terbalik: impor dan ekspor tertukar', () => {
    const energy = runExample(true);
    expect(energy.importWh).toBeCloseTo(150, 6);
    expect(energy.exportWh).toBeCloseTo(250, 6);
  });

  it('daya 0 atau dt 0: energi tidak bertambah', () => {
    expect(kwhMeterAccumulate(EMPTY, 0, 3600)).toEqual(EMPTY);
    expect(kwhMeterAccumulate(EMPTY, 500, 0)).toEqual(EMPTY);
  });
});

describe('kwhMeterCanMeasure', () => {
  it('SDM230 membaca pada 176–276 V', () => {
    expect(kwhMeterCanMeasure(METER, 220)).toBe(true);
    expect(kwhMeterCanMeasure(METER, 176)).toBe(true);
    expect(kwhMeterCanMeasure(METER, 175)).toBe(false);
    expect(kwhMeterCanMeasure(METER, 277)).toBe(false);
    expect(kwhMeterCanMeasure(METER, 0)).toBe(false);
  });
});

describe('kwhMeterReadingKwh', () => {
  it('contoh §10.3: SDM230 menampilkan 0.15 / 0.25 kWh, juga dengan εg +0.5%', () => {
    expect(kwhMeterReadingKwh(METER, 150)).toBeCloseTo(0.15, 10);
    expect(kwhMeterReadingKwh(METER, 250)).toBeCloseTo(0.25, 10);
    expect(kwhMeterReadingKwh(METER, 150, 0.5)).toBeCloseTo(0.15, 10);
    expect(kwhMeterReadingKwh(METER, 250, 0.5)).toBeCloseTo(0.25, 10);
  });

  it('dibulatkan ke bawah ke resolusi 0.01 kWh; energi 0 atau negatif tampil 0', () => {
    expect(kwhMeterReadingKwh(METER, 159.9)).toBeCloseTo(0.15, 10);
    expect(kwhMeterReadingKwh(METER, 0)).toBe(0);
    expect(kwhMeterReadingKwh(METER, -5)).toBe(0);
  });

  it('galat unit dibatasi ±1%', () => {
    expect(kwhMeterReadingKwh(METER, 100000, 1)).toBeCloseTo(101, 8);
    expect(kwhMeterReadingKwh(METER, 100000, 50)).toBeCloseTo(101, 8);
    expect(kwhMeterReadingKwh(METER, 100000, -50)).toBeCloseTo(99, 8);
  });

  it('berputar ke 0 setelah melewati 99999.99 kWh', () => {
    expect(kwhMeterReadingKwh(METER, 99999990)).toBeCloseTo(99999.99, 6);
    expect(kwhMeterReadingKwh(METER, 100000000)).toBeCloseTo(0, 6);
  });
});

describe('kwhMeterPulseCount', () => {
  it('SDM230 0.001 kWh/pulsa: 250 Wh → 250 pulsa', () => {
    expect(kwhMeterPulseCount(METER, 250)).toBe(250);
    expect(kwhMeterPulseCount(METER, 0.9)).toBe(0);
  });

  it('contoh §10.3: 3200 imp/kWh, 250 Wh → 800 pulsa', () => {
    expect(kwhMeterPulseCount({ ...METER, pulseKwhPerPulse: 1 / 3200 }, 250)).toBe(800);
  });

  it('energi negatif: 0 pulsa', () => {
    expect(kwhMeterPulseCount(METER, -10)).toBe(0);
  });
});
