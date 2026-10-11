// Tampilan kabel menurut penampangnya (docs/UX.md §2.3).

export const WIRE_HIT_WIDTH_PX = 16;
export const WIRE_HALO_PX = 3;

/** Tebal garis: 3 px (≤ 2,5 mm²), 4 px (4–6 mm²), 6 px (≥ 10 mm²). */
export function wireStrokePx(areaMm2: number): number {
  if (areaMm2 <= 2.5) return 3;
  if (areaMm2 <= 6) return 4;
  return 6;
}
