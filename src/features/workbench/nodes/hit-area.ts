// Area sentuh terminal (docs/UX.md §2.3): 44 px di layar pada semua tingkat zoom. Supaya area
// sentuh terminal yang rapat tidak bertumpuk, tiap area dipotong di garis tengah ke terminal lain
// pada komponen yang sama.
import type { TerminalSpot } from './geometry';

/** Sisi area sentuh terminal di layar. */
export const SCREEN_HIT_PX = 44;
/** Zoom dibulatkan ke kelipatan ini, supaya area sentuh tidak dihitung ulang tiap gerak zoom. */
export const ZOOM_STEP = 0.05;

export interface PointPx {
  xPx: number;
  yPx: number;
}

type Center = Pick<TerminalSpot, 'xPx' | 'yPx'>;

/** Zoom dibulatkan ke `ZOOM_STEP`; tidak pernah nol. */
export function quantizeZoom(zoom: number): number {
  return Math.max(Math.round(zoom / ZOOM_STEP) * ZOOM_STEP, ZOOM_STEP);
}

/** Sisi area sentuh di ruang meja kerja agar tampil `SCREEN_HIT_PX` di layar pada zoom ini. */
export function hitSidePx(zoom: number): number {
  return SCREEN_HIT_PX / quantizeZoom(zoom);
}

/** Memotong poligon cembung dengan setengah bidang `x·dx + y·dy ≤ limit` (Sutherland–Hodgman). */
function clipHalfPlane(polygon: readonly PointPx[], dx: number, dy: number, limit: number) {
  const side = (point: PointPx) => point.xPx * dx + point.yPx * dy - limit;
  const clipped: PointPx[] = [];
  polygon.forEach((current, index) => {
    const previous = polygon[(index + polygon.length - 1) % polygon.length] ?? current;
    const [currentSide, previousSide] = [side(current), side(previous)];
    if (currentSide <= 0 !== previousSide <= 0) {
      const t = previousSide / (previousSide - currentSide);
      clipped.push({
        xPx: previous.xPx + t * (current.xPx - previous.xPx),
        yPx: previous.yPx + t * (current.yPx - previous.yPx),
      });
    }
    if (currentSide <= 0) clipped.push(current);
  });
  return clipped;
}

/**
 * Area sentuh sebuah terminal sebagai poligon relatif terhadap pusatnya: persegi bersisi `sidePx`
 * yang dipotong garis tengah ke tiap terminal lain. Terminal yang berimpit tidak saling memotong.
 */
export function hitPolygon(spot: Center, others: readonly Center[], sidePx: number): PointPx[] {
  const half = sidePx / 2;
  let polygon: PointPx[] = [
    { xPx: -half, yPx: -half },
    { xPx: half, yPx: -half },
    { xPx: half, yPx: half },
    { xPx: -half, yPx: half },
  ];
  for (const other of others) {
    const dx = other.xPx - spot.xPx;
    const dy = other.yPx - spot.yPx;
    const squaredPx = dx * dx + dy * dy;
    // Diri sendiri, terminal berimpit, atau terlalu jauh untuk menyentuh persegi ini.
    if (squaredPx === 0 || squaredPx >= 2 * sidePx * sidePx) continue;
    polygon = clipHalfPlane(polygon, dx, dy, squaredPx / 2);
  }
  return polygon;
}

/** Poligon area sentuh sebagai `clip-path` CSS untuk elemen bersisi `sidePx` yang terpusat. */
export function hitClipPath(polygon: readonly PointPx[], sidePx: number): string {
  const half = sidePx / 2;
  const points = polygon.map(
    (point) => `${(point.xPx + half).toFixed(1)}px ${(point.yPx + half).toFixed(1)}px`,
  );
  return `polygon(${points.join(', ')})`;
}
