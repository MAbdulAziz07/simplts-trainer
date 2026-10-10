// Model jaringan PLN, versi kecil: jendela tegangan/frekuensi dan arah daya
// (docs/MODEL_FISIKA.md §6.1–6.2). Dipakai penuh mulai paket Rekomendasi.
import type { GridElectrical } from '../catalog/balance';

/** Jendela frekuensi ±1 Hz (IEC 61727). [PERLU VERIFIKASI] */
export const GRID_FREQUENCY_TOLERANCE_HZ = 1;

export interface GridVoltageWindow {
  minVoltageV: number;
  maxVoltageV: number;
}

/** Batas tegangan layanan dari toleransi katalog. */
export function gridVoltageWindow(grid: GridElectrical): GridVoltageWindow {
  return {
    minVoltageV: grid.nominalVoltageV * (1 - grid.voltageToleranceDownPct / 100),
    maxVoltageV: grid.nominalVoltageV * (1 + grid.voltageToleranceUpPct / 100),
  };
}

/** `true` bila tegangan dan frekuensi jaringan di dalam jendela; padam (0 V) = `false`. */
export function gridIsWithinWindow(
  grid: GridElectrical,
  voltageV: number,
  frequencyHz: number,
  frequencyToleranceHz = GRID_FREQUENCY_TOLERANCE_HZ,
): boolean {
  const { minVoltageV, maxVoltageV } = gridVoltageWindow(grid);
  return (
    voltageV >= minVoltageV &&
    voltageV <= maxVoltageV &&
    Math.abs(frequencyHz - grid.frequencyHz) <= frequencyToleranceHz
  );
}

/** Daya di titik sambung: Pgrid = Pload − Pac inverter; positif = impor, negatif = ekspor. */
export function gridNetPowerW(loadPowerW: number, inverterAcPowerW: number): number {
  return loadPowerW - inverterAcPowerW;
}
