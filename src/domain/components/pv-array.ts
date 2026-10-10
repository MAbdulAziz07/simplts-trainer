// Susunan modul PV: string seri, string paralel, bayangan per modul, titik daya maksimum
// (docs/MODEL_FISIKA.md §1.5–1.6). Kurva tiap modul berasal dari pv.ts.
import { bisectDecreasing } from './numeric';
import { pvVoltageV, type PvCurve } from './pv';

/** Iradiasi sisa pada bagian teduh `d` (§1.6), asumsi trainer. [PERLU VERIFIKASI] */
export const PV_SHADE_DIFFUSE_FRACTION = 0.15;
/** Tegangan maju dioda bypass `Vf` (§1.6). [PERLU VERIFIKASI] */
export const PV_BYPASS_DIODE_DROP_V = 0.6;

const MPP_SCAN_POINTS = 400;
const MPP_REFINE_ITERATIONS = 40;

/** Array = daftar string paralel; tiap string = daftar kurva modul yang diseri. */
export type PvArray = PvCurve[][];

export interface PvPowerPoint {
  voltageV: number;
  currentA: number;
  powerW: number;
}

/** Iradiasi efektif modul yang sebagian luasnya (`shadedFraction` 0..1) teduh. */
export function pvShadedIrradianceWm2(
  irradianceWm2: number,
  shadedFraction: number,
  diffuseFraction = PV_SHADE_DIFFUSE_FRACTION,
): number {
  return irradianceWm2 * (1 - shadedFraction * (1 - diffuseFraction));
}

/** Array `parallelCount` string, masing-masing `seriesCount` modul identik. */
export function pvUniformArray(
  curve: PvCurve,
  seriesCount: number,
  parallelCount: number,
): PvArray {
  return Array.from({ length: parallelCount }, () =>
    Array.from({ length: seriesCount }, () => curve),
  );
}

/** Tegangan string pada arus string; modul yang Isc-nya terlampaui dilewati dioda bypass (−Vf). */
export function pvStringVoltageV(
  modules: readonly PvCurve[],
  currentA: number,
  bypassDropV = PV_BYPASS_DIODE_DROP_V,
): number {
  return modules.reduce(
    (sumV, curve) => sumV + (currentA > curve.iscA ? -bypassDropV : pvVoltageV(curve, currentA)),
    0,
  );
}

/** Arus string pada tegangan terminal string (pencarian bagi-dua; tanpa arus balik). */
export function pvStringCurrentA(modules: readonly PvCurve[], voltageV: number): number {
  const maxIscA = modules.reduce((max, curve) => Math.max(max, curve.iscA), 0);
  if (maxIscA <= 0) return 0;
  if (voltageV >= pvStringVoltageV(modules, 0)) return 0;
  if (voltageV <= pvStringVoltageV(modules, maxIscA)) return maxIscA;
  return bisectDecreasing((currentA) => pvStringVoltageV(modules, currentA), voltageV, 0, maxIscA);
}

/** Arus array pada tegangan terminal: jumlah arus semua string. */
export function pvArrayCurrentA(array: PvArray, voltageV: number): number {
  return array.reduce((sumA, modules) => sumA + pvStringCurrentA(modules, voltageV), 0);
}

/** Tegangan rangkaian terbuka array: string dengan Voc tertinggi (arus balik tidak dimodelkan). */
export function pvArrayVocV(array: PvArray): number {
  return array.reduce((max, modules) => Math.max(max, pvStringVoltageV(modules, 0)), 0);
}

/** Arus hubung singkat array. */
export function pvArrayIscA(array: PvArray): number {
  return pvArrayCurrentA(array, 0);
}

/**
 * Titik daya maksimum global pada rentang tegangan (bawaan 0..Voc array): pindai lalu haluskan.
 * Rentang dipakai untuk jendela MPPT; puncak di luar rentang diabaikan.
 */
export function pvArrayMaxPower(
  array: PvArray,
  minVoltageV = 0,
  maxVoltageV = Number.POSITIVE_INFINITY,
): PvPowerPoint {
  const lowV = Math.max(minVoltageV, 0);
  const highV = Math.min(maxVoltageV, pvArrayVocV(array));
  if (highV <= lowV) return { voltageV: 0, currentA: 0, powerW: 0 };
  const powerAt = (voltageV: number) => voltageV * pvArrayCurrentA(array, voltageV);

  const stepV = (highV - lowV) / MPP_SCAN_POINTS;
  let bestV = lowV;
  let bestW = powerAt(lowV);
  for (let i = 1; i <= MPP_SCAN_POINTS; i += 1) {
    const voltageV = lowV + i * stepV;
    const powerW = powerAt(voltageV);
    if (powerW > bestW) {
      bestV = voltageV;
      bestW = powerW;
    }
  }

  // Penghalusan: pencarian tiga-bagian di sekitar titik pindai terbaik.
  let left = Math.max(bestV - stepV, lowV);
  let right = Math.min(bestV + stepV, highV);
  for (let i = 0; i < MPP_REFINE_ITERATIONS; i += 1) {
    const third = (right - left) / 3;
    if (powerAt(left + third) < powerAt(right - third)) left += third;
    else right -= third;
  }
  const voltageV = (left + right) / 2;
  const refinedW = powerAt(voltageV);
  if (refinedW < bestW) return { voltageV: bestV, currentA: bestW / bestV, powerW: bestW };
  return { voltageV, currentA: pvArrayCurrentA(array, voltageV), powerW: refinedW };
}

/** Arus balik ke satu string yang terganggu dari string paralel lain: (Np − 1)·Isc (§1.5). */
export function pvStringReverseCurrentA(parallelCount: number, stringIscA: number): number {
  return Math.max(parallelCount - 1, 0) * stringIscA;
}
