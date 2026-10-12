// Cuplikan untuk grafik 24 jam: daya PV, daya beban, dan SoC per ruas 5 menit jam simulasi.
// Fungsi murni: tiap perubahan mengembalikan larik baru, atau larik yang sama bila tidak berubah.
import type { Snapshot } from '@/domain';
import { HOURS_PER_DAY } from './sim-env';

/** Lebar satu ruas waktu grafik. */
export const CHART_BIN_MINUTES = 5;
/** Jumlah ruas dalam 24 jam. */
export const CHART_BIN_COUNT = (HOURS_PER_DAY * 60) / CHART_BIN_MINUTES;

export interface ChartSample {
  pvPowerW: number;
  loadPowerW: number;
  /** Rata-rata SoC semua baterai; kosong bila tidak ada baterai di meja. */
  socPct?: number;
}

/** Cuplikan per ruas, indeks 0 = 00:00–00:05; ruas yang belum pernah dilalui kosong. */
export type ChartBins = readonly (ChartSample | undefined)[];

export const EMPTY_BINS: ChartBins = Array.from({ length: CHART_BIN_COUNT }, () => undefined);

/** Ruas tempat jam desimal `clockHour` berada. */
export function binIndexOf(clockHour: number): number {
  const wrapped = ((clockHour % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
  return Math.min(Math.floor((wrapped * 60) / CHART_BIN_MINUTES), CHART_BIN_COUNT - 1);
}

/** Jam desimal di tengah ruas. */
export function binCenterHour(index: number): number {
  return ((index + 0.5) * CHART_BIN_MINUTES) / 60;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Cuplikan dari snapshot: daya dibulatkan ke 0,1 W dan SoC ke 0,1%. */
export function sampleOf(snapshot: Snapshot): ChartSample {
  const socs = Object.values(snapshot.components).flatMap((status) => status.socPct ?? []);
  const { pvW, loadW } = snapshot.operatingPoint.balance;
  return {
    pvPowerW: round1(Math.max(pvW, 0)),
    loadPowerW: round1(Math.max(loadW, 0)),
    ...(socs.length > 0 && {
      socPct: round1(socs.reduce((sum, socPct) => sum + socPct, 0) / socs.length),
    }),
  };
}

/** Mencatat cuplikan terbaru di ruas jam ini; cuplikan lama di ruas itu (kemarin) tertimpa. */
export function recordSample(bins: ChartBins, clockHour: number, sample: ChartSample): ChartBins {
  const index = binIndexOf(clockHour);
  const current = bins[index];
  const isSame =
    current !== undefined &&
    current.pvPowerW === sample.pvPowerW &&
    current.loadPowerW === sample.loadPowerW &&
    current.socPct === sample.socPct;
  if (isSame) return bins;
  const next = [...bins];
  next[index] = sample;
  return next;
}
