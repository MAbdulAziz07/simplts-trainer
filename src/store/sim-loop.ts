// Putaran bingkai simulasi di atas `requestAnimationFrame`: waktu nyata dikumpulkan lalu
// diserahkan ke `onTick` paling sering `1 / TICK_S` kali per detik.

/** Jarak terpendek antarhitungan: 20 hitungan per detik. */
export const TICK_S = 0.05;
/** Jeda bingkai terpanjang yang dihitung; tab yang baru kembali tampil tidak melompat jauh. */
export const MAX_FRAME_S = 0.25;

export interface FrameAccumulator {
  /** Menerima cap waktu bingkai (ms); mengembalikan detik yang harus dihitung, atau 0. */
  push: (nowMs: number) => number;
}

/** Pengumpul waktu antarbingkai; dipisah dari `requestAnimationFrame` agar bisa diuji. */
export function createFrameAccumulator(tickS = TICK_S, maxFrameS = MAX_FRAME_S): FrameAccumulator {
  let lastMs: number | undefined;
  let pendingS = 0;
  return {
    push: (nowMs) => {
      const elapsedS = lastMs === undefined ? 0 : (nowMs - lastMs) / 1000;
      lastMs = nowMs;
      pendingS += Math.min(Math.max(elapsedS, 0), maxFrameS);
      if (pendingS < tickS) return 0;
      const dueS = pendingS;
      pendingS = 0;
      return dueS;
    },
  };
}

/**
 * Menjalankan `onTick(realDtS)` selama belum dihentikan; mengembalikan fungsi penghenti. Di luar
 * browser (unit test) tidak melakukan apa-apa.
 */
export function startFrameLoop(onTick: (realDtS: number) => void): () => void {
  if (typeof requestAnimationFrame !== 'function') return () => {};
  const accumulator = createFrameAccumulator();
  let frameId = 0;
  const frame = (nowMs: number): void => {
    const dueS = accumulator.push(nowMs);
    if (dueS > 0) onTick(dueS);
    frameId = requestAnimationFrame(frame);
  };
  frameId = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(frameId);
}
