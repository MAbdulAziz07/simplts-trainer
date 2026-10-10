// Model satu modul PV: suhu sel, koreksi iradiasi/suhu, kurva I-V eksplisit C1/C2
// (docs/MODEL_FISIKA.md §1.2–1.4, §3.3). Susunan seri/paralel dan bayangan: pv-array.ts.
import type { PvModuleElectrical } from '../catalog/sources';
import { clamp } from './numeric';

export const STC_IRRADIANCE_WM2 = 1000;
export const STC_CELL_TEMP_C = 25;
const NOCT_IRRADIANCE_WM2 = 800;
const NOCT_AMBIENT_TEMP_C = 20;
const KELVIN_OFFSET = 273.15;

/** Faktor log tegangan terhadap iradiasi `L` (§1.1), asumsi trainer. [PERLU VERIFIKASI] */
export const PV_LOG_VOLTAGE_FACTOR = 25;

/** Titik khas kurva I-V pada kondisi kerja tertentu. */
export interface PvPoints {
  iscA: number;
  impA: number;
  vocV: number;
  vmpV: number;
}

/** Titik khas ditambah koefisien kurva eksplisit (§1.4). */
export interface PvCurve extends PvPoints {
  c1: number;
  c2: number;
}

const DARK_POINTS: PvPoints = { iscA: 0, impA: 0, vocV: 0, vmpV: 0 };

/** Suhu sel dari suhu lingkungan dan iradiasi (§1.2); `mountRiseK` = kenaikan karena pemasangan. */
export function pvCellTempC(
  ambientTempC: number,
  irradianceWm2: number,
  noctC: number,
  mountRiseK = 0,
): number {
  const irradiance = Math.max(irradianceWm2, 0);
  return (
    ambientTempC + ((noctC - NOCT_AMBIENT_TEMP_C) / NOCT_IRRADIANCE_WM2) * irradiance + mountRiseK
  );
}

/** Isc, Imp, Voc, Vmp pada iradiasi dan suhu sel tertentu (§1.3). Iradiasi 0 memberi nol. */
export function pvPointsAt(
  module: PvModuleElectrical,
  irradianceWm2: number,
  cellTempC: number,
): PvPoints {
  if (irradianceWm2 <= 0) return DARK_POINTS;
  const ratio = irradianceWm2 / STC_IRRADIANCE_WM2;
  const deltaT = cellTempC - STC_CELL_TEMP_C;
  const alpha = module.tempCoeffIscPerC;
  const thermalV =
    (module.vocV / PV_LOG_VOLTAGE_FACTOR) *
    ((cellTempC + KELVIN_OFFSET) / (STC_CELL_TEMP_C + KELVIN_OFFSET));
  const logTermV = thermalV * Math.log(ratio);
  const currentFactor = ratio * (1 + alpha * deltaT);

  const vocV = module.vocV * (1 + module.tempCoeffVocPerC * deltaT) + logTermV;
  const vmpV = module.vmpV * (1 + (module.tempCoeffPmaxPerC - alpha) * deltaT) + logTermV;
  // Di bawah jangkauan model (iradiasi sangat rendah) tegangan runtuh: perlakukan sebagai gelap.
  if (vmpV <= 0 || vocV <= vmpV) return DARK_POINTS;
  return { iscA: module.iscA * currentFactor, impA: module.impA * currentFactor, vocV, vmpV };
}

/** Koefisien C1/C2 dari titik khas (§1.4). C1 sangat kecil; jangan dibulatkan. */
export function pvCurve(points: PvPoints): PvCurve {
  if (points.iscA <= 0 || points.vocV <= 0) return { ...DARK_POINTS, c1: 0, c2: 0 };
  const currentGap = 1 - points.impA / points.iscA;
  const c2 = (points.vmpV / points.vocV - 1) / Math.log(currentGap);
  const c1 = currentGap * Math.exp(-points.vmpV / (c2 * points.vocV));
  return { ...points, c1, c2 };
}

/** Kurva I-V modul pada iradiasi dan suhu sel tertentu. */
export function pvCurveAt(
  module: PvModuleElectrical,
  irradianceWm2: number,
  cellTempC: number,
): PvCurve {
  return pvCurve(pvPointsAt(module, irradianceWm2, cellTempC));
}

/** Arus modul pada tegangan terminal `voltageV`, dibatasi 0..Isc. */
export function pvCurrentA(curve: PvCurve, voltageV: number): number {
  if (curve.iscA <= 0) return 0;
  if (voltageV <= 0) return curve.iscA;
  const currentA = curve.iscA * (1 - curve.c1 * (Math.exp(voltageV / (curve.c2 * curve.vocV)) - 1));
  return clamp(currentA, 0, curve.iscA);
}

/** Tegangan modul pada arus `currentA` (kebalikan kurva); arus >= Isc memberi 0 V. */
export function pvVoltageV(curve: PvCurve, currentA: number): number {
  if (curve.iscA <= 0 || currentA >= curve.iscA) return 0;
  const current = Math.max(currentA, 0);
  return curve.c2 * curve.vocV * Math.log(1 + (1 - current / curve.iscA) / curve.c1);
}

/** Voc string pada suhu sel terendah, iradiasi STC (§3.3); dibandingkan dengan batas SCC/inverter. */
export function pvStringVocColdV(
  module: PvModuleElectrical,
  seriesCount: number,
  minCellTempC: number,
): number {
  return (
    seriesCount * module.vocV * (1 + module.tempCoeffVocPerC * (minCellTempC - STC_CELL_TEMP_C))
  );
}
