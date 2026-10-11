// Ukuran komponen di meja kerja pada zoom 100% (docs/UX.md §2.2: kecil, sedang, besar).
import type { ComponentCategory } from '@/domain';

export interface SizePx {
  widthPx: number;
  heightPx: number;
}

const SMALL_PX = 144;
const MEDIUM_PX = 216;
const LARGE_PX = 288;

/** Sisi terpanjang gambar; rasio gambar dipertahankan agar posisi terminal (%) tetap pas. */
const LONG_SIDE_PX: Record<ComponentCategory, number> = {
  'pv-module': MEDIUM_PX,
  'scc-pwm': 264,
  'scc-mppt': 264,
  battery: MEDIUM_PX,
  bms: MEDIUM_PX,
  'inverter-offgrid': LARGE_PX,
  'inverter-gridtie': LARGE_PX,
  'inverter-hybrid': LARGE_PX,
  'mcb-dc': SMALL_PX,
  'mcb-ac': 168,
  fuse: SMALL_PX,
  spd: SMALL_PX,
  combiner: LARGE_PX,
  cable: SMALL_PX,
  'kwh-meter': MEDIUM_PX,
  busbar: LARGE_PX,
  grounding: SMALL_PX,
  'load-panel': LARGE_PX,
  'load-dc': SMALL_PX,
  'load-ac': SMALL_PX,
  grid: MEDIUM_PX,
};

/** Rasio lebar:tinggi kotak pengganti untuk item yang gambarnya belum ada. */
const FALLBACK_ASPECT: Partial<Record<ComponentCategory, number>> = {
  busbar: 4,
  'load-panel': 1.5,
  grid: 1.5,
  bms: 1.5,
};
const DEFAULT_FALLBACK_ASPECT = 0.8;

/**
 * Ukuran tampil sebuah komponen sebelum diputar.
 * @param image ukuran gambar asli; kosong bila gambarnya belum ada.
 */
export function componentSizePx(category: ComponentCategory, image?: SizePx): SizePx {
  const longSidePx = LONG_SIDE_PX[category];
  const aspect = image
    ? image.widthPx / image.heightPx
    : (FALLBACK_ASPECT[category] ?? DEFAULT_FALLBACK_ASPECT);
  return aspect >= 1
    ? { widthPx: longSidePx, heightPx: Math.round(longSidePx / aspect) }
    : { widthPx: Math.round(longSidePx * aspect), heightPx: longSidePx };
}
