// Deret grafik 24 jam. Warna mengikuti deretnya (variabel CSS di sim-controls.css), dalam urutan
// tetap dan sudah lolos pemeriksaan buta warna untuk pasangan yang bersebelahan.
import { t } from '@/i18n';
import type { ChartSample } from '@/store';

export type SeriesId = keyof typeof t.chart.series;

export interface Series {
  id: SeriesId;
  label: string;
  /** Variabel CSS warna garis. */
  color: string;
  valueOf: (sample: ChartSample) => number | undefined;
  format: (value: number) => string;
}

export const PV: Series = {
  id: 'pv',
  label: t.chart.series.pv,
  color: 'var(--series-pv)',
  valueOf: (sample) => sample.pvPowerW,
  format: t.chart.watt,
};

export const LOAD: Series = {
  id: 'load',
  label: t.chart.series.load,
  color: 'var(--series-load)',
  valueOf: (sample) => sample.loadPowerW,
  format: t.chart.watt,
};

export const SOC: Series = {
  id: 'soc',
  label: t.chart.series.soc,
  color: 'var(--series-soc)',
  valueOf: (sample) => sample.socPct,
  format: t.chart.percent,
};

export const ALL_SERIES: readonly Series[] = [PV, LOAD, SOC];

/** Nilai sebuah deret pada cuplikan, sebagai teks; `—` bila tidak ada. */
export function valueText(series: Series, sample: ChartSample | undefined): string {
  const value = sample && series.valueOf(sample);
  return value === undefined ? t.chart.none : series.format(value);
}
