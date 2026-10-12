// Letak terminal pada node: posisi katalog (% terhadap gambar) → piksel pada node yang sudah
// diputar, sisi terdekat, dan ukuran titik serta area sentuhnya.
import type { Terminal } from '@/domain';
import type { RotationDeg } from '@/data';
import type { SizePx } from '@/ui';

export interface PointPct {
  xPct: number;
  yPct: number;
}

export type Side = 'top' | 'right' | 'bottom' | 'left';

export interface TerminalSpot {
  terminal: Terminal;
  /** Pusat terminal terhadap pojok kiri atas node yang sudah diputar. */
  xPx: number;
  yPx: number;
  /** Sisi node terdekat; menentukan arah keluar kabel. */
  side: Side;
  /** Garis tengah titik yang tampak. */
  dotPx: number;
  /**
   * Ruang bebas di sekitar titik (24–44 px) menurut jarak ke terminal terdekat; menentukan jarak
   * label. Area sentuhnya sendiri dihitung di hit-area.ts.
   */
  hitPx: number;
  /** `false` bila posisi di katalog belum diisi (0, 0) dan terminal dijajarkan di bawah node. */
  placed: boolean;
  /** Baris label: terminal atas/bawah yang rapat berselang-seling agar labelnya tidak bertumpuk. */
  labelRow: 0 | 1;
}

export const MIN_HIT_PX = 24;
export const MAX_HIT_PX = 44;
export const MAX_DOT_PX = 24;
export const MIN_DOT_PX = 14;
/** Sela antara titik terminal yang bersebelahan. */
const DOT_GAP_PX = 6;
/** Jajaran terminal yang posisinya belum diisi: jarak antarpusat dan jarak dari tepi bawah. */
export const UNPLACED_PITCH_PX = 30;
export const UNPLACED_OFFSET_PX = 22;
/** Di bawah jarak mendatar ini label dua terminal sesisi dianggap bertumpuk. */
export const LABEL_CLEARANCE_PX = 56;

/** Memutar titik searah jarum jam mengelilingi pusat gambar. */
export function rotatePointPct(point: PointPct, rotationDeg: RotationDeg): PointPct {
  const { xPct, yPct } = point;
  switch (rotationDeg) {
    case 90:
      return { xPct: 100 - yPct, yPct: xPct };
    case 180:
      return { xPct: 100 - xPct, yPct: 100 - yPct };
    case 270:
      return { xPct: yPct, yPct: 100 - xPct };
    default:
      return { xPct, yPct };
  }
}

/** Ukuran kotak node setelah diputar: 90° dan 270° menukar lebar dan tinggi. */
export function rotatedSizePx(size: SizePx, rotationDeg: RotationDeg): SizePx {
  return rotationDeg === 90 || rotationDeg === 270
    ? { widthPx: size.heightPx, heightPx: size.widthPx }
    : size;
}

export function isPlaced(terminal: Pick<Terminal, 'xPct' | 'yPct'>): boolean {
  return terminal.xPct !== 0 || terminal.yPct !== 0;
}

function nearestSide(point: PointPct): Side {
  const distances: [Side, number][] = [
    ['bottom', 100 - point.yPct],
    ['top', point.yPct],
    ['left', point.xPct],
    ['right', 100 - point.xPct],
  ];
  return distances.reduce((best, candidate) => (candidate[1] < best[1] ? candidate : best))[0];
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Menata semua terminal sebuah komponen.
 * @param size ukuran komponen sebelum diputar.
 */
export function layoutTerminals(
  terminals: readonly Terminal[],
  size: SizePx,
  rotationDeg: RotationDeg,
): TerminalSpot[] {
  const box = rotatedSizePx(size, rotationDeg);
  const unplacedCount = terminals.filter((terminal) => !isPlaced(terminal)).length;
  let unplacedIndex = 0;

  const spots = terminals.map((terminal): TerminalSpot => {
    const base = { terminal, dotPx: MAX_DOT_PX, hitPx: MAX_HIT_PX, labelRow: 0 as const };
    if (!isPlaced(terminal)) {
      const offset = unplacedIndex++ - (unplacedCount - 1) / 2;
      return {
        ...base,
        xPx: box.widthPx / 2 + offset * UNPLACED_PITCH_PX,
        yPx: box.heightPx + UNPLACED_OFFSET_PX,
        side: 'bottom',
        placed: false,
      };
    }
    const point = rotatePointPct(terminal, rotationDeg);
    return {
      ...base,
      xPx: (point.xPct / 100) * box.widthPx,
      yPx: (point.yPct / 100) * box.heightPx,
      side: nearestSide(point),
      placed: true,
    };
  });

  for (const spot of spots) {
    const nearestPx = Math.min(
      ...spots
        .filter((other) => other !== spot)
        .map((other) => Math.hypot(other.xPx - spot.xPx, other.yPx - spot.yPx)),
    );
    spot.hitPx = Math.round(clamp(nearestPx, MIN_HIT_PX, MAX_HIT_PX));
    spot.dotPx = Math.round(clamp(nearestPx - DOT_GAP_PX, MIN_DOT_PX, MAX_DOT_PX));
  }
  staggerLabels(spots);
  return spots;
}

function staggerLabels(spots: TerminalSpot[]): void {
  for (const side of ['top', 'bottom'] as const) {
    const row = spots.filter((spot) => spot.side === side).sort((a, b) => a.xPx - b.xPx);
    row.forEach((spot, index) => {
      const previous = row[index - 1];
      const isCrowded = previous !== undefined && spot.xPx - previous.xPx < LABEL_CLEARANCE_PX;
      spot.labelRow = isCrowded && previous.labelRow === 0 ? 1 : 0;
    });
  }
}
