import { describe, expect, it } from 'vitest';
import { BASE_DT_S, chooseDtS, MAX_DT_S, MIN_DT_S } from './time-step';

const NO_TRIP = Number.POSITIVE_INFINITY;
const calm = { ratio: 0.5, tripTimeS: NO_TRIP };

describe('chooseDtS', () => {
  it('semua proteksi jauh dari batas: sampai 60 s', () => {
    expect(chooseDtS([calm], false, 600)).toBe(MAX_DT_S);
    expect(chooseDtS([], false, 600)).toBe(MAX_DT_S);
  });

  it('tidak melebihi sisa waktu', () => {
    expect(chooseDtS([calm], false, 12.5)).toBe(12.5);
    expect(chooseDtS([calm], false, 0)).toBe(0);
  });

  it('I/In ≥ 0,9 atau ada penghitung tunda: langkah dasar 1 s', () => {
    expect(chooseDtS([{ ratio: 0.9, tripTimeS: NO_TRIP }], false, 600)).toBe(BASE_DT_S);
    expect(chooseDtS([{ ratio: 1.1, tripTimeS: NO_TRIP }], false, 600)).toBe(BASE_DT_S);
    expect(chooseDtS([calm], true, 600)).toBe(BASE_DT_S);
  });

  it('menuju trip: 0,2·t_trip, tidak lebih dari langkah dasar', () => {
    expect(chooseDtS([{ ratio: 2.5, tripTimeS: 2 }], false, 600)).toBeCloseTo(0.4, 9);
    expect(chooseDtS([{ ratio: 1.5, tripTimeS: 1374 }], false, 600)).toBe(BASE_DT_S);
    expect(chooseDtS([{ ratio: 2, tripTimeS: 3 }, calm], true, 600)).toBeCloseTo(0.6, 9);
  });

  it('daerah magnetik: minimum 10 ms', () => {
    expect(chooseDtS([{ ratio: 72, tripTimeS: 0.02 }], false, 600)).toBe(MIN_DT_S);
  });

  it('yang paling cepat trip menentukan', () => {
    const loads = [
      { ratio: 2, tripTimeS: 100 },
      { ratio: 3, tripTimeS: 10 },
    ];
    expect(chooseDtS(loads, false, 600)).toBe(1);
    expect(chooseDtS([...loads, { ratio: 4, tripTimeS: 1 }], false, 600)).toBeCloseTo(0.2, 9);
  });
});
