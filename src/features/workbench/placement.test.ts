import { describe, expect, it } from 'vitest';
import { GRID_PX } from './flow-types';
import { CLEARANCE_X_PX, CLEARANCE_Y_PX, findFreeSpot, type BoxPx } from './placement';

const box = (xPx: number, yPx: number, widthPx = 96, heightPx = 144): BoxPx => ({
  xPx,
  yPx,
  widthPx,
  heightPx,
});

const clear = (a: BoxPx, b: BoxPx): boolean =>
  a.xPx >= b.xPx + b.widthPx + CLEARANCE_X_PX ||
  b.xPx >= a.xPx + a.widthPx + CLEARANCE_X_PX ||
  a.yPx >= b.yPx + b.heightPx + CLEARANCE_Y_PX ||
  b.yPx >= a.yPx + a.heightPx + CLEARANCE_Y_PX;

describe('findFreeSpot', () => {
  it('meja kosong: memakai posisi yang diminta, dibulatkan ke kisi', () => {
    expect(findFreeSpot(box(250, 131), [])).toEqual({ xPx: 240, yPx: 120 });
  });

  it('bergeser ke samping bila tempatnya terisi', () => {
    const first = box(240, 120);
    const spot = findFreeSpot(box(240, 120), [first]);
    expect(spot.yPx).toBe(120);
    expect(spot.xPx).toBeGreaterThan(240);
    expect(clear({ ...box(0, 0), ...spot }, first)).toBe(true);
  });

  it('komponen yang ditambah berturut-turut tidak saling menimpa', () => {
    const placed: BoxPx[] = [];
    for (let i = 0; i < 12; i++) {
      const size = i % 3 === 0 ? box(0, 0, 264, 262) : box(0, 0);
      const spot = findFreeSpot({ ...size, xPx: 480, yPx: 240 }, placed);
      const next = { ...size, ...spot };
      for (const other of placed) expect(clear(next, other)).toBe(true);
      expect(Math.abs(spot.xPx % GRID_PX)).toBe(0);
      expect(Math.abs(spot.yPx % GRID_PX)).toBe(0);
      placed.push(next);
    }
  });

  it('turun ke baris berikutnya bila baris itu penuh', () => {
    const wall = box(-2000, 100, 5000, 100);
    const spot = findFreeSpot(box(240, 120), [wall]);
    expect(spot.yPx).toBeGreaterThanOrEqual(200 + CLEARANCE_Y_PX);
  });

  it('meja yang penuh sama sekali: kembali ke posisi yang diminta', () => {
    const everything = box(-10000, -10000, 20000, 20000);
    expect(findFreeSpot(box(240, 120), [everything])).toEqual({ xPx: 240, yPx: 120 });
  });
});
