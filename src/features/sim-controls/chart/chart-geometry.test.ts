import { describe, expect, it } from 'vitest';
import { binAtX, linePaths, niceMax, xOfBin, yOfValue, type PlotBox } from './chart-geometry';

const BOX: PlotBox = { xPx: 40, yPx: 10, widthPx: 400, heightPx: 100 };

describe('niceMax', () => {
  it('membulatkan ke 1, 2, atau 5 × 10ⁿ; paling kecil 10', () => {
    expect(niceMax(0)).toBe(10);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(79.5)).toBe(100);
    expect(niceMax(100)).toBe(100);
    expect(niceMax(101)).toBe(200);
    expect(niceMax(430)).toBe(500);
    expect(niceMax(1800)).toBe(2000);
    expect(niceMax(Number.NaN)).toBe(10);
  });
});

describe('skala', () => {
  it('xOfBin menaruh ruas di tengah lebarnya', () => {
    expect(xOfBin(0, 4, BOX)).toBe(90);
    expect(xOfBin(3, 4, BOX)).toBe(390);
  });

  it('yOfValue: nol di dasar, maksimum di puncak, di luar sumbu dijepit', () => {
    expect(yOfValue(0, 200, BOX)).toBe(110);
    expect(yOfValue(200, 200, BOX)).toBe(10);
    expect(yOfValue(50, 200, BOX)).toBe(85);
    expect(yOfValue(900, 200, BOX)).toBe(10);
    expect(yOfValue(-5, 200, BOX)).toBe(110);
  });

  it('binAtX kebalikan xOfBin dan dijepit ke tepi', () => {
    expect(binAtX(xOfBin(2, 4, BOX), 4, BOX)).toBe(2);
    expect(binAtX(0, 4, BOX)).toBe(0);
    expect(binAtX(9999, 4, BOX)).toBe(3);
  });
});

describe('linePaths', () => {
  it('garis bersambung selama ada nilai, putus di ruas kosong', () => {
    const paths = linePaths([0, 100, undefined, 200], 200, BOX);
    expect(paths).toEqual(['M 90.0,110.0 L 190.0,60.0', 'M 390.0,10.0 h 0.1']);
  });

  it('putus setelah ruas jam sekarang', () => {
    const paths = linePaths([0, 100, 200, 100], 200, BOX, 1);
    expect(paths).toEqual(['M 90.0,110.0 L 190.0,60.0', 'M 290.0,10.0 L 390.0,60.0']);
  });

  it('tanpa nilai tidak ada garis', () => {
    expect(linePaths([undefined, undefined], 200, BOX)).toEqual([]);
  });
});
