import { describe, expect, it } from 'vitest';
import type { CurvePoint } from '../catalog/shared';
import { bisectDecreasing, clamp, interpolate, interpolateLogLog } from './numeric';

describe('clamp', () => {
  it('menahan nilai di dalam batas', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.4, 0, 1)).toBe(0.4);
  });
});

describe('interpolate', () => {
  const xs = [0, 0.5, 1];
  const ys = [10, 20, 40];

  it('linier di antara titik', () => {
    expect(interpolate(xs, ys, 0.25)).toBeCloseTo(15, 10);
    expect(interpolate(xs, ys, 0.75)).toBeCloseTo(30, 10);
    expect(interpolate(xs, ys, 0.5)).toBe(20);
  });

  it('memakai nilai ujung di luar rentang', () => {
    expect(interpolate(xs, ys, -1)).toBe(10);
    expect(interpolate(xs, ys, 2)).toBe(40);
  });
});

describe('interpolateLogLog', () => {
  const points: CurvePoint[] = [
    [1, 1000],
    [10, 10],
    [100, 1],
  ];

  it('melewati titik kurva dan lurus pada skala log-log', () => {
    expect(interpolateLogLog(points, 10)).toBeCloseTo(10, 8);
    expect(interpolateLogLog(points, Math.sqrt(10))).toBeCloseTo(100, 6);
  });

  it('meneruskan kemiringan terakhir di atas titik terakhir', () => {
    expect(interpolateLogLog(points, 1000)).toBeCloseTo(0.1, 8);
  });

  it('memakai nilai pertama di bawah titik pertama', () => {
    expect(interpolateLogLog(points, 0.5)).toBe(1000);
  });
});

describe('bisectDecreasing', () => {
  it('menemukan akar fungsi menurun', () => {
    expect(bisectDecreasing((x) => 10 - 2 * x, 4, 0, 10)).toBeCloseTo(3, 9);
  });
});
