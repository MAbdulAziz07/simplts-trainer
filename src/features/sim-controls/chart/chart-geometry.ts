// Geometri grafik 24 jam: skala, lintasan garis, dan ruas di bawah penunjuk. Fungsi murni.

export interface PlotBox {
  xPx: number;
  yPx: number;
  widthPx: number;
  heightPx: number;
}

/** Batas atas sumbu terkecil yang "bulat" (1, 2, atau 5 × 10ⁿ) di atas `value`; paling kecil 10. */
export function niceMax(value: number): number {
  const floor = 10;
  if (!(value > floor)) return floor;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((multiple) => multiple * magnitude >= value) ?? 10;
  return step * magnitude;
}

/** Posisi mendatar tengah ruas `index` dari `binCount` ruas. */
export function xOfBin(index: number, binCount: number, box: PlotBox): number {
  return box.xPx + ((index + 0.5) / binCount) * box.widthPx;
}

/** Posisi tegak nilai pada sumbu 0..`max`; nilai di luar sumbu dijepit ke tepinya. */
export function yOfValue(value: number, max: number, box: PlotBox): number {
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  return box.yPx + (1 - ratio) * box.heightPx;
}

/** Ruas di bawah posisi mendatar `xPx`, dijepit ke ruas pertama dan terakhir. */
export function binAtX(xPx: number, binCount: number, box: PlotBox): number {
  const index = Math.floor(((xPx - box.xPx) / box.widthPx) * binCount);
  return Math.min(Math.max(index, 0), binCount - 1);
}

const point = (xPx: number, yPx: number) => `${xPx.toFixed(1)},${yPx.toFixed(1)}`;

/**
 * Atribut `d` tiap potongan garis. Garis putus di ruas kosong dan setelah ruas `breakAfter`
 * (ruas jam sekarang): ruas sesudahnya berasal dari hari sebelumnya. Titik tunggal digambar
 * sebagai garis sangat pendek supaya tetap terlihat.
 */
export function linePaths(
  values: readonly (number | undefined)[],
  max: number,
  box: PlotBox,
  breakAfter?: number,
): string[] {
  const paths: string[] = [];
  let run: string[] = [];
  const flush = (): void => {
    const [only] = run;
    if (run.length === 1 && only) paths.push(`M ${only} h 0.1`);
    else if (run.length > 1) paths.push(`M ${run.join(' L ')}`);
    run = [];
  };
  values.forEach((value, index) => {
    if (value === undefined) {
      flush();
      return;
    }
    run.push(point(xOfBin(index, values.length, box), yOfValue(value, max, box)));
    if (index === breakAfter) flush();
  });
  flush();
  return paths;
}
