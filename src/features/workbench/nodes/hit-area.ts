// Area sentuh terminal (docs/UX.md §2.3): 44 px di layar pada semua tingkat zoom. Supaya area
// sentuh terminal yang rapat tidak bertumpuk, tiap area dipotong di garis tengah ke terminal lain
// pada komponen yang sama. Supaya komponen kecil tetap bisa dipilih pada zoom kecil, area sentuh
// juga tidak masuk ke inti badan komponen.
import type { SizePx } from '@/ui';
import type { TerminalSpot } from './geometry';

/** Sisi area sentuh terminal di layar. */
export const SCREEN_HIT_PX = 44;
/** Sisi inti badan komponen di layar yang selalu bebas dari area sentuh terminal. */
export const SCREEN_CORE_PX = 24;
/** Inti badan paling besar sebagian ini dari lebar atau tinggi komponen. */
const MAX_CORE_SHARE = 0.5;
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

/** Kotak relatif terhadap pojok kiri atas node. */
export interface RectPx {
  leftPx: number;
  topPx: number;
  rightPx: number;
  bottomPx: number;
}

/**
 * Inti badan komponen di ruang meja: kotak di tengah node yang tampil `SCREEN_CORE_PX` di layar,
 * paling besar separuh lebar dan tinggi node.
 */
export function bodyCore(box: SizePx, zoom: number): RectPx {
  const corePx = SCREEN_CORE_PX / quantizeZoom(zoom);
  const halfWidthPx = Math.min(corePx, box.widthPx * MAX_CORE_SHARE) / 2;
  const halfHeightPx = Math.min(corePx, box.heightPx * MAX_CORE_SHARE) / 2;
  const [centerX, centerY] = [box.widthPx / 2, box.heightPx / 2];
  return {
    leftPx: centerX - halfWidthPx,
    topPx: centerY - halfHeightPx,
    rightPx: centerX + halfWidthPx,
    bottomPx: centerY + halfHeightPx,
  };
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

/**
 * Memotong area sentuh di batas inti badan, ke arah dalam dari sisi terminalnya. Titik terminal
 * yang tampak tetap utuh di dalam area, juga bila terminal itu sendiri dekat atau di dalam inti.
 */
export function clipToCore(
  polygon: readonly PointPx[],
  spot: Pick<TerminalSpot, 'xPx' | 'yPx' | 'side' | 'dotPx'>,
  core: RectPx,
): PointPx[] {
  const keepPx = spot.dotPx / 2;
  switch (spot.side) {
    case 'top':
      return clipHalfPlane(polygon, 0, 1, Math.max(core.topPx - spot.yPx, keepPx));
    case 'bottom':
      return clipHalfPlane(polygon, 0, -1, Math.max(spot.yPx - core.bottomPx, keepPx));
    case 'left':
      return clipHalfPlane(polygon, 1, 0, Math.max(core.leftPx - spot.xPx, keepPx));
    case 'right':
      return clipHalfPlane(polygon, -1, 0, Math.max(spot.xPx - core.rightPx, keepPx));
  }
}

/** Poligon area sentuh sebagai `clip-path` CSS untuk elemen bersisi `sidePx` yang terpusat. */
export function hitClipPath(polygon: readonly PointPx[], sidePx: number): string {
  const half = sidePx / 2;
  const points = polygon.map(
    (point) => `${(point.xPx + half).toFixed(1)}px ${(point.yPx + half).toFixed(1)}px`,
  );
  return `polygon(${points.join(', ')})`;
}
