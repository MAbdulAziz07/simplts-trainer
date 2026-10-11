import { describe, expect, it } from 'vitest';
import {
  BMS_CLOSED,
  BMS_DEFAULT_OVER_CURRENT_DELAY_S,
  BMS_DEFAULT_SHORT_CIRCUIT_FACTOR,
  bmsLimits,
  bmsStep,
} from './bms';

/** bat-lfp-51v2-100ah */
const PROTECTION = {
  internalBms: true,
  overVoltageCutoffV: 58.6,
  underVoltageCutoffV: 40,
  overCurrentDischargeA: 100,
  overCurrentDelayS: 10,
  shortCircuitFactor: 3,
  shortCircuitDelayMs: 1,
};
const LIMITS = bmsLimits(PROTECTION);
if (!LIMITS) throw new Error('batas BMS uji tidak terbentuk');

describe('bmsLimits', () => {
  it('baterai tanpa BMS di dalam tidak punya batas', () => {
    expect(bmsLimits({ internalBms: false, overCurrentDischargeA: 200 })).toBeUndefined();
  });

  it('mengambil ambang katalog', () => {
    expect(LIMITS).toEqual({
      overVoltageCutoffV: 58.6,
      underVoltageCutoffV: 40,
      overCurrentDischargeA: 100,
      overCurrentDelayS: 10,
      shortCircuitFactor: 3,
    });
  });

  it('tunda dan faktor hubung singkat memakai bawaan bila katalog kosong', () => {
    expect(bmsLimits({ internalBms: true })).toEqual({
      overCurrentDelayS: BMS_DEFAULT_OVER_CURRENT_DELAY_S,
      shortCircuitFactor: BMS_DEFAULT_SHORT_CIRCUIT_FACTOR,
    });
  });
});

describe('bmsStep', () => {
  it('arus normal: tetap tersambung', () => {
    expect(bmsStep(LIMITS, BMS_CLOSED, 51.2, -80, 1)).toEqual(BMS_CLOSED);
    expect(bmsStep(LIMITS, BMS_CLOSED, 54, 50, 1)).toEqual(BMS_CLOSED);
  });

  it('arus lebih memutus setelah 10 s terus-menerus', () => {
    let state = BMS_CLOSED;
    for (let second = 1; second <= 9; second += 1) state = bmsStep(LIMITS, state, 50, -120, 1);
    expect(state).toEqual({ open: false, overCurrentS: 9 });
    state = bmsStep(LIMITS, state, 50, -120, 1);
    expect(state).toEqual({ open: true, reason: 'over-current', overCurrentS: 0 });
  });

  it('penghitung arus lebih kembali nol saat arus turun', () => {
    const counting = bmsStep(LIMITS, BMS_CLOSED, 50, -120, 5);
    expect(counting.overCurrentS).toBe(5);
    expect(bmsStep(LIMITS, counting, 50, -90, 1)).toEqual(BMS_CLOSED);
  });

  it('hubung singkat (> 3·Idis) memutus seketika', () => {
    expect(bmsStep(LIMITS, BMS_CLOSED, 45, -301, 0.01)).toMatchObject({
      open: true,
      reason: 'short-circuit',
    });
    expect(bmsStep(LIMITS, BMS_CLOSED, 45, -300, 0.01).open).toBe(false);
  });

  it('tegangan kurang memutus saat melepas, tidak saat diisi', () => {
    expect(bmsStep(LIMITS, BMS_CLOSED, 39.9, -10, 1).reason).toBe('under-voltage');
    expect(bmsStep(LIMITS, BMS_CLOSED, 39.9, 0, 1).reason).toBe('under-voltage');
    expect(bmsStep(LIMITS, BMS_CLOSED, 39.9, 10, 1).open).toBe(false);
  });

  it('tegangan lebih memutus saat diisi, tidak saat melepas', () => {
    expect(bmsStep(LIMITS, BMS_CLOSED, 58.7, 5, 1).reason).toBe('over-voltage');
    expect(bmsStep(LIMITS, BMS_CLOSED, 58.7, -5, 1).open).toBe(false);
  });

  it('yang sudah putus tetap terkunci', () => {
    const open = bmsStep(LIMITS, BMS_CLOSED, 39, -10, 1);
    expect(bmsStep(LIMITS, open, 52, 0, 60)).toBe(open);
  });

  it('tanpa ambang arus: arus berapa pun tidak memutus', () => {
    const limits = bmsLimits({ internalBms: true });
    if (!limits) throw new Error('batas BMS uji tidak terbentuk');
    expect(bmsStep(limits, BMS_CLOSED, 50, -1000, 60)).toEqual(BMS_CLOSED);
  });
});
