// Model kWh meter ekspor-impor, versi kecil: akumulasi energi, pembacaan, pulsa
// (docs/MODEL_FISIKA.md §10.2). Dipakai penuh mulai paket Rekomendasi.
import type { KwhMeterElectrical } from '../catalog/balance';

const SECONDS_PER_HOUR = 3600;
const WH_PER_KWH = 1000;
// Menahan galat pembulatan biner sebelum dibulatkan ke bawah (mis. 0.15/0.01 = 14.999…).
const QUANTIZE_EPSILON = 1e-9;

/** Energi sebenarnya yang sudah lewat meter. */
export interface KwhMeterEnergy {
  importWh: number;
  exportWh: number;
}

/**
 * Energi setelah `dtS` pada daya `gridPowerW` (+ impor, − ekspor).
 * `reversed` = CT terbalik atau L IN/L OUT tertukar: impor dan ekspor tertukar.
 */
export function kwhMeterAccumulate(
  energy: KwhMeterEnergy,
  gridPowerW: number,
  dtS: number,
  reversed = false,
): KwhMeterEnergy {
  const powerW = reversed ? -gridPowerW : gridPowerW;
  const hours = dtS / SECONDS_PER_HOUR;
  return {
    importWh: energy.importWh + Math.max(powerW, 0) * hours,
    exportWh: energy.exportWh + Math.max(-powerW, 0) * hours,
  };
}

/** `true` bila tegangan di dalam jendela ukur; di luar itu meter tidak membaca. */
export function kwhMeterCanMeasure(meter: KwhMeterElectrical, voltageV: number): boolean {
  return voltageV >= meter.voltageMinV && voltageV <= meter.voltageMaxV;
}

/**
 * Angka tampilan (kWh): (1 + εg)·E dibulatkan ke bawah ke resolusi tampilan, berputar di
 * batas tampilan. `gainErrorPct` = galat tetap unit, dibatasi ±`gainErrorMaxPct`.
 */
export function kwhMeterReadingKwh(
  meter: KwhMeterElectrical,
  energyWh: number,
  gainErrorPct = 0,
): number {
  const gainPct = Math.min(Math.max(gainErrorPct, -meter.gainErrorMaxPct), meter.gainErrorMaxPct);
  const measuredKwh = (Math.max(energyWh, 0) * (1 + gainPct / 100)) / WH_PER_KWH;
  const resolutionKwh = meter.displayResolutionKwh;
  const steps = Math.floor(measuredKwh / resolutionKwh + QUANTIZE_EPSILON);
  const rolloverSteps = Math.round(meter.displayMaxKwh / resolutionKwh) + 1;
  return (steps % rolloverSteps) * resolutionKwh;
}

/** Jumlah pulsa keluaran yang sudah dikirim untuk energi `energyWh`. */
export function kwhMeterPulseCount(meter: KwhMeterElectrical, energyWh: number): number {
  const energyKwh = Math.max(energyWh, 0) / WH_PER_KWH;
  return Math.floor(energyKwh / meter.pulseKwhPerPulse + QUANTIZE_EPSILON);
}
