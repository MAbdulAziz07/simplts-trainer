import { ChartLine, X } from 'lucide-react';
import { t } from '@/i18n';
import {
  CHART_BIN_COUNT,
  CHART_BIN_MINUTES,
  binIndexOf,
  formatClock,
  useChartStore,
  useSimStore,
  type ChartBins,
} from '@/store';
import { DayChart } from './DayChart';
import { ALL_SERIES, valueText } from './series';

const BINS_PER_HOUR = 60 / CHART_BIN_MINUTES;

/** Tombol 44 px di bilah simulasi yang membuka dan menutup grafik. */
export function ChartButton() {
  const open = useChartStore((state) => state.open);
  const setOpen = useChartStore((state) => state.setOpen);
  return (
    <button
      type="button"
      aria-label={t.chart.open}
      title={t.chart.open}
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${
        open ? 'bg-brand text-white' : 'hover:bg-app'
      }`}
    >
      <ChartLine aria-hidden size={22} />
    </button>
  );
}

/** Tabel cuplikan tiap jam untuk pembaca layar: nilai yang sama dengan grafik, tanpa penunjuk. */
function HourlyTable({ bins }: { bins: ChartBins }) {
  const hours = Array.from({ length: CHART_BIN_COUNT / BINS_PER_HOUR }, (_, hour) => hour);
  return (
    <table className="sr-only">
      <caption>{t.chart.table}</caption>
      <thead>
        <tr>
          <th scope="col">{t.chart.hour}</th>
          {ALL_SERIES.map((series) => (
            <th key={series.id} scope="col">
              {series.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {hours.map((hour) => (
          <tr key={hour}>
            <th scope="row">{formatClock(hour)}</th>
            {ALL_SERIES.map((series) => (
              <td key={series.id}>{valueText(series, bins[hour * BINS_PER_HOUR])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Grafik ringkas yang dibuka bila perlu, mengambang di atas bilah simulasi. Legenda memuat nilai
 * saat ini, sehingga tiap deret terbaca tanpa bergantung pada warna atau penunjuk.
 */
export function ChartPanel() {
  const open = useChartStore((state) => state.open);
  const bins = useChartStore((state) => state.bins);
  const setOpen = useChartStore((state) => state.setOpen);
  const nowBin = useSimStore((state) => binIndexOf(state.clockHour));
  if (!open) return null;
  const isEmpty = bins.every((sample) => sample === undefined);

  return (
    <section aria-label={t.chart.title} className="day-chart">
      <header className="flex items-center gap-4">
        <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
          {ALL_SERIES.map((series) => (
            <li key={series.id} className="chart-legend" data-series={series.id}>
              <span aria-hidden className="chart-key" style={{ background: series.color }} />
              <span>{series.label}</span>
              <strong>{valueText(series, bins[nowBin])}</strong>
            </li>
          ))}
        </ul>
        <button
          type="button"
          aria-label={t.chart.close}
          title={t.chart.close}
          onClick={() => setOpen(false)}
          className="hover:bg-app -m-1 flex size-11 shrink-0 items-center justify-center rounded-lg"
        >
          <X aria-hidden size={20} />
        </button>
      </header>
      <DayChart bins={bins} nowBin={nowBin} />
      {isEmpty && <p className="chart-empty">{t.chart.empty}</p>}
      <HourlyTable bins={bins} />
    </section>
  );
}
