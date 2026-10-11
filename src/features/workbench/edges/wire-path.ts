// Lintasan kabel: kurva Bézier yang keluar tegak lurus dari sisi node tempat terminal berada,
// sehingga kabel antara dua terminal sejajar tetap melengkung (menjuntai) dan mudah dipilih.

export type WireSide = 'top' | 'right' | 'bottom' | 'left';

export interface WireEnd {
  x: number;
  y: number;
  side: WireSide;
}

export interface WirePath {
  /** Atribut `d` SVG. */
  d: string;
  /** Titik tengah kurva. */
  midX: number;
  midY: number;
}

const MIN_REACH_PX = 40;
const MAX_REACH_PX = 160;
const REACH_RATIO = 0.35;
/** Kabel di jalur berbeda melengkung berbeda dalam, agar kabel sejajar (+ dan −) tidak berimpit. */
export const LANE_COUNT = 5;
const LANE_STEP_PX = 18;

/** Jalur sebuah kabel dari nomor di id-nya (`w7` → 2). */
export function wireLane(wireId: string): number {
  return Number(/\d+$/.exec(wireId)?.[0] ?? 0) % LANE_COUNT;
}

const DIRECTION: Record<WireSide, [number, number]> = {
  top: [0, -1],
  right: [1, 0],
  bottom: [0, 1],
  left: [-1, 0],
};

export function wirePath(source: WireEnd, target: WireEnd, lane = 0): WirePath {
  const distancePx = Math.hypot(target.x - source.x, target.y - source.y);
  const reachPx =
    Math.min(MAX_REACH_PX, Math.max(MIN_REACH_PX, distancePx * REACH_RATIO)) + lane * LANE_STEP_PX;
  const control = (end: WireEnd): [number, number] => {
    const [dx, dy] = DIRECTION[end.side];
    return [end.x + dx * reachPx, end.y + dy * reachPx];
  };
  const [c1x, c1y] = control(source);
  const [c2x, c2y] = control(target);
  return {
    d: `M ${source.x},${source.y} C ${c1x},${c1y} ${c2x},${c2y} ${target.x},${target.y}`,
    // Titik kurva kubik pada t = 0,5.
    midX: (source.x + 3 * c1x + 3 * c2x + target.x) / 8,
    midY: (source.y + 3 * c1y + 3 * c2y + target.y) / 8,
  };
}
