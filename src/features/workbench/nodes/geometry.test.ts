import { describe, expect, it } from 'vitest';
import type { Terminal, TerminalKind } from '@/domain';
import { ROTATIONS_DEG } from '@/data';
import {
  MAX_DOT_PX,
  MAX_HIT_PX,
  MIN_DOT_PX,
  MIN_HIT_PX,
  UNPLACED_OFFSET_PX,
  UNPLACED_PITCH_PX,
  layoutTerminals,
  rotatePointPct,
  rotatedSizePx,
} from './geometry';

const terminal = (
  id: string,
  xPct: number,
  yPct: number,
  kind: TerminalKind = 'dc+',
): Terminal => ({
  id,
  label: id,
  kind,
  xPct,
  yPct,
  maxWires: 1,
});

const SIZE = { widthPx: 200, heightPx: 100 };

describe('rotatePointPct', () => {
  it('memutar searah jarum jam', () => {
    const topLeft = { xPct: 10, yPct: 20 };
    expect(rotatePointPct(topLeft, 0)).toEqual({ xPct: 10, yPct: 20 });
    expect(rotatePointPct(topLeft, 90)).toEqual({ xPct: 80, yPct: 10 });
    expect(rotatePointPct(topLeft, 180)).toEqual({ xPct: 90, yPct: 80 });
    expect(rotatePointPct(topLeft, 270)).toEqual({ xPct: 20, yPct: 90 });
  });

  it('empat kali 90° kembali ke titik semula dan pusat tidak bergeser', () => {
    let point = { xPct: 37, yPct: 81 };
    for (let i = 0; i < 4; i++) point = rotatePointPct(point, 90);
    expect(point).toEqual({ xPct: 37, yPct: 81 });
    for (const deg of ROTATIONS_DEG)
      expect(rotatePointPct({ xPct: 50, yPct: 50 }, deg)).toEqual({ xPct: 50, yPct: 50 });
  });
});

describe('rotatedSizePx', () => {
  it('menukar lebar dan tinggi pada 90° dan 270°', () => {
    expect(rotatedSizePx(SIZE, 0)).toEqual(SIZE);
    expect(rotatedSizePx(SIZE, 180)).toEqual(SIZE);
    expect(rotatedSizePx(SIZE, 90)).toEqual({ widthPx: 100, heightPx: 200 });
    expect(rotatedSizePx(SIZE, 270)).toEqual({ widthPx: 100, heightPx: 200 });
  });
});

describe('layoutTerminals', () => {
  it('mengubah persen menjadi piksel dan memilih sisi terdekat', () => {
    const [bottom, left] = layoutTerminals([terminal('a', 25, 90), terminal('b', 5, 40)], SIZE, 0);
    expect(bottom).toMatchObject({ xPx: 50, yPx: 90, side: 'bottom', placed: true });
    expect(left).toMatchObject({ xPx: 10, yPx: 40, side: 'left', placed: true });
  });

  it('terminal ikut berputar bersama komponen', () => {
    const [spot] = layoutTerminals([terminal('a', 25, 90)], SIZE, 90);
    // Kotak menjadi 100x200; titik bawah-kiri pindah ke sisi kiri.
    expect(spot).toMatchObject({ xPx: 10, yPx: 50, side: 'left' });
  });

  it('terminal tanpa posisi dijajarkan rata tengah di bawah node', () => {
    const spots = layoutTerminals(
      [terminal('a', 0, 0), terminal('b', 0, 0), terminal('c', 0, 0)],
      SIZE,
      0,
    );
    expect(spots.map((spot) => spot.xPx)).toEqual([
      100 - UNPLACED_PITCH_PX,
      100,
      100 + UNPLACED_PITCH_PX,
    ]);
    for (const spot of spots)
      expect(spot).toMatchObject({ yPx: 100 + UNPLACED_OFFSET_PX, side: 'bottom', placed: false });
  });

  it('terminal tunggal memakai titik dan area sentuh terbesar', () => {
    const [spot] = layoutTerminals([terminal('pe', 50, 90, 'pe')], SIZE, 0);
    expect(spot).toMatchObject({ dotPx: MAX_DOT_PX, hitPx: MAX_HIT_PX });
  });

  it('terminal rapat mengecil tetapi area sentuh tidak di bawah 24 px', () => {
    // 6 terminal berjarak 10 px.
    const spots = layoutTerminals(
      [5, 10, 15, 20, 25, 30].map((xPct, i) => terminal(`t${i}`, xPct, 90)),
      SIZE,
      0,
    );
    for (const spot of spots) {
      expect(spot.hitPx).toBe(MIN_HIT_PX);
      expect(spot.dotPx).toBe(MIN_DOT_PX);
    }
  });

  it('area sentuh mengikuti jarak ke terminal terdekat', () => {
    // Berjarak 30 px: area sentuh 30 px, titik 24 px.
    const spots = layoutTerminals([terminal('a', 10, 90), terminal('b', 25, 90)], SIZE, 0);
    expect(spots.map((spot) => [spot.hitPx, spot.dotPx])).toEqual([
      [30, 24],
      [30, 24],
    ]);
  });

  it('label terminal sesisi yang rapat berselang-seling baris', () => {
    const tight = layoutTerminals(
      [10, 25, 40, 55].map((xPct, i) => terminal(`t${i}`, xPct, 95)),
      SIZE,
      0,
    );
    expect(tight.map((spot) => spot.labelRow)).toEqual([0, 1, 0, 1]);

    const wide = layoutTerminals([terminal('a', 10, 95), terminal('b', 90, 95)], SIZE, 0);
    expect(wide.map((spot) => spot.labelRow)).toEqual([0, 0]);

    // Terminal di sisi kiri/kanan bertumpuk tegak, tidak perlu selang-seling.
    const side = layoutTerminals([terminal('a', 2, 40), terminal('b', 2, 60)], SIZE, 0);
    expect(side.map((spot) => spot.labelRow)).toEqual([0, 0]);
  });
});
