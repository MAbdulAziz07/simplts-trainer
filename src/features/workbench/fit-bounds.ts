// Batas rangkaian yang dipaskan ke meja kerja, dan pemeriksaan apakah semuanya sedang terlihat.
// Fungsi murni, dipakai tombol "paskan" dan pemasan ulang otomatis.
import { GRID_PX } from './flow-types';
import type { BoxPx } from './placement';

/**
 * Ruang di luar kotak komponen: nama dan deret indikator (LED, LCD, bar SoC) di atas, tuas MCB di
 * kanan, jajaran terminal di bawah.
 */
export const FIT_MARGIN_PX = {
  left: GRID_PX,
  top: 4 * GRID_PX,
  right: 3 * GRID_PX,
  bottom: 3 * GRID_PX,
};
/** Lebar layar yang ditempati bilah alat di tepi kiri meja; tidak ikut zoom. */
export const FIT_TOOLBAR_WIDTH_PX = 80;
/**
 * Lebar layar di kiri meja yang tertutup panel langkah skenario (bilah alat 76 px + panel 320 px +
 * jarak 12 px; scenarios.css). Rangkaian dipaskan di kanannya supaya terminal tidak tertutup.
 */
export const SCENARIO_PANEL_INSET_PX = 408;
/** Lebar bebas paling kecil yang masih layak dipakai untuk memaskan rangkaian. */
const MIN_FREE_WIDTH_PX = 400;

/** Kelonggaran pembulatan (px layar) saat memeriksa apakah batas rangkaian terlihat. */
const VISIBLE_TOLERANCE_PX = 2;

/**
 * Lebar layar di kiri meja yang tidak dipakai rangkaian: bilah alat, ditambah panel skenario bila
 * tampil. Pada meja sempit panel diabaikan supaya rangkaian tidak menjadi terlalu kecil.
 */
export function fitLeftInsetPx(workbenchWidthPx: number, hasScenarioPanel: boolean): number {
  if (hasScenarioPanel && workbenchWidthPx - SCENARIO_PANEL_INSET_PX >= MIN_FREE_WIDTH_PX)
    return SCENARIO_PANEL_INSET_PX;
  return FIT_TOOLBAR_WIDTH_PX;
}

/** Kotak yang memuat semua komponen beserta ruang di luarnya; kosong bila meja kosong. */
export function fitBounds(boxes: readonly BoxPx[]): BoxPx | undefined {
  if (boxes.length === 0) return undefined;
  const left = Math.min(...boxes.map((box) => box.xPx)) - FIT_MARGIN_PX.left;
  const top = Math.min(...boxes.map((box) => box.yPx)) - FIT_MARGIN_PX.top;
  const right = Math.max(...boxes.map((box) => box.xPx + box.widthPx)) + FIT_MARGIN_PX.right;
  const bottom = Math.max(...boxes.map((box) => box.yPx + box.heightPx)) + FIT_MARGIN_PX.bottom;
  return { xPx: left, yPx: top, widthPx: right - left, heightPx: bottom - top };
}

/** Geseran dan zoom kanvas: titik meja `p` tampil di layar pada `p × zoom + geseran`. */
export interface ViewTransform {
  xPx: number;
  yPx: number;
  zoom: number;
}

/**
 * `true` bila seluruh `bounds` terlihat di meja kerja selebar `widthPx` dan setinggi `heightPx`,
 * di kanan `leftInsetPx` (bawaan: bilah alat). Hasil tombol "paskan" selalu memenuhi ini.
 */
export function isFullyVisible(
  bounds: BoxPx,
  view: ViewTransform,
  widthPx: number,
  heightPx: number,
  leftInsetPx = FIT_TOOLBAR_WIDTH_PX,
): boolean {
  const left = bounds.xPx * view.zoom + view.xPx;
  const top = bounds.yPx * view.zoom + view.yPx;
  const right = (bounds.xPx + bounds.widthPx) * view.zoom + view.xPx;
  const bottom = (bounds.yPx + bounds.heightPx) * view.zoom + view.yPx;
  return (
    left >= leftInsetPx - VISIBLE_TOLERANCE_PX &&
    top >= -VISIBLE_TOLERANCE_PX &&
    right <= widthPx + VISIBLE_TOLERANCE_PX &&
    bottom <= heightPx + VISIBLE_TOLERANCE_PX
  );
}
