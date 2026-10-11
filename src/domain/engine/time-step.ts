// Panjang sub-langkah waktu (docs/MODEL_FISIKA.md §12 butir 4): percepatan tidak boleh melompati
// trip.
import type { SwitchLoad } from './protection-events';

/** Langkah dasar waktu simulasi. */
export const BASE_DT_S = 1;
/** Langkah terpanjang saat semua proteksi jauh dari batasnya. */
export const MAX_DT_S = 60;
export const MIN_DT_S = 0.01;
/** Di bawah `I/In` ini langkah boleh sepanjang `MAX_DT_S`. */
export const CALM_LOAD_RATIO = 0.9;
/** Bagian waktu trip yang boleh ditempuh satu sub-langkah. */
export const TRIP_TIME_FRACTION = 0.2;

/**
 * Sub-langkah berikutnya: sampai 60 s bila semua `I/In < 0,9` dan tidak ada penghitung tunda yang
 * berjalan; 1 s bila ada yang mendekati batas; `0,2·t_trip` (minimum 10 ms) bila ada proteksi yang
 * sedang menuju trip. Tidak pernah melebihi `remainingS`.
 */
export function chooseDtS(
  loads: readonly Pick<SwitchLoad, 'ratio' | 'tripTimeS'>[],
  hasPendingTimers: boolean,
  remainingS: number,
): number {
  let dtS = MAX_DT_S;
  if (hasPendingTimers || loads.some((load) => load.ratio >= CALM_LOAD_RATIO)) dtS = BASE_DT_S;
  for (const { tripTimeS } of loads) {
    if (!Number.isFinite(tripTimeS)) continue;
    dtS = Math.min(dtS, Math.max(TRIP_TIME_FRACTION * tripTimeS, MIN_DT_S));
  }
  return Math.max(Math.min(dtS, remainingS), 0);
}
