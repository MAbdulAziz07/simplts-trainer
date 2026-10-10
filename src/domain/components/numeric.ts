// Alat hitung kecil yang dipakai beberapa model komponen.
import type { CurvePoint } from '../catalog/shared';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Interpolasi linier pada tabel `xs` naik; di luar rentang memakai nilai ujung. */
export function interpolate(xs: readonly number[], ys: readonly number[], x: number): number {
  let x0 = Number.NaN;
  let y0 = 0;
  for (const [i, x1] of xs.entries()) {
    const y1 = ys[i] ?? y0;
    if (x <= x1) return i === 0 ? y1 : y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    x0 = x1;
    y0 = y1;
  }
  return y0;
}

/**
 * Interpolasi log-log melalui titik kurva `[x, y]` (x naik, semua positif).
 * Di bawah titik pertama memakai nilai pertama; di atas titik terakhir kemiringan terakhir diteruskan.
 */
export function interpolateLogLog(points: readonly CurvePoint[], x: number): number {
  const [first, ...rest] = points;
  if (!first) return 0;
  if (x <= first[0]) return first[1];
  let [x0, y0] = first;
  let slope = 0;
  for (const [x1, y1] of rest) {
    slope = Math.log(y1 / y0) / Math.log(x1 / x0);
    if (x <= x1) break;
    [x0, y0] = [x1, y1];
  }
  return y0 * Math.exp(slope * Math.log(x / x0));
}

/** Pencarian bagi-dua: `x` pada `[lo, hi]` dengan `fn(x) = target`, untuk `fn` yang menurun monoton. */
export function bisectDecreasing(
  fn: (x: number) => number,
  target: number,
  lo: number,
  hi: number,
  iterations = 60,
): number {
  let low = lo;
  let high = hi;
  for (let i = 0; i < iterations; i += 1) {
    const mid = (low + high) / 2;
    if (fn(mid) > target) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}
