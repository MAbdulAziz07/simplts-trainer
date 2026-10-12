import { useState } from 'react';
import { t } from '@/i18n';
import { CHART_BIN_COUNT, CHART_BIN_MINUTES, formatClock, type ChartBins } from '@/store';
import { binAtX, linePaths, niceMax, xOfBin, yOfValue, type PlotBox } from './chart-geometry';
import { ALL_SERIES, LOAD, PV, SOC, valueText, type Series } from './series';

const WIDTH_PX = 560;
const HEIGHT_PX = 276;
const PLOT_LEFT_PX = 44;
const PLOT_WIDTH_PX = WIDTH_PX - PLOT_LEFT_PX - 14;
/** Dua bidang bertumpuk berbagi sumbu waktu: daya (W) di atas, SoC (%) di bawah. */
const POWER_BOX: PlotBox = { xPx: PLOT_LEFT_PX, yPx: 22, widthPx: PLOT_WIDTH_PX, heightPx: 118 };
const SOC_BOX: PlotBox = { xPx: PLOT_LEFT_PX, yPx: 176, widthPx: PLOT_WIDTH_PX, heightPx: 72 };
const SOC_MAX_PCT = 100;
const HOUR_TICKS = [0, 6, 12, 18, 24];
const TOOLTIP_GAP_PX = 10;

interface PlotProps {
  box: PlotBox;
  title: string;
  max: number;
  ticks: readonly number[];
}

/** Bidang gambar: garis bantu tipis, angka sumbu, dan judul satuan. */
function PlotFrame({ box, title, max, ticks }: PlotProps) {
  return (
    <g>
      <text x={box.xPx} y={box.yPx - 8} className="chart-title">
        {title}
      </text>
      {ticks.map((tick) => {
        const yPx = yOfValue(tick, max, box);
        return (
          <g key={tick}>
            <line
              x1={box.xPx}
              x2={box.xPx + box.widthPx}
              y1={yPx}
              y2={yPx}
              className="chart-grid"
            />
            <text x={box.xPx - 6} y={yPx + 4} textAnchor="end" className="chart-tick">
              {tick}
            </text>
          </g>
        );
      })}
    </g>
  );
}

interface SeriesLineProps {
  series: Series;
  bins: ChartBins;
  box: PlotBox;
  max: number;
  nowBin: number;
  hoverBin?: number;
}

/** Garis 2 px satu deret, dan titik bercincin di ruas yang sedang ditunjuk. */
function SeriesLine({ series, bins, box, max, nowBin, hoverBin }: SeriesLineProps) {
  const values = bins.map((sample) => sample && series.valueOf(sample));
  const hovered = hoverBin === undefined ? undefined : values[hoverBin];
  return (
    <g data-series={series.id}>
      {linePaths(values, max, box, nowBin).map((d) => (
        <path key={d} d={d} className="chart-line" stroke={series.color} />
      ))}
      {hoverBin !== undefined && hovered !== undefined && (
        <circle
          cx={xOfBin(hoverBin, CHART_BIN_COUNT, box)}
          cy={yOfValue(hovered, max, box)}
          r={4}
          fill={series.color}
          className="chart-dot"
        />
      )}
    </g>
  );
}

interface DayChartProps {
  bins: ChartBins;
  /** Ruas jam simulasi sekarang. */
  nowBin: number;
}

/**
 * Daya PV dan daya beban (satu sumbu W) serta SoC (sumbu % sendiri) terhadap jam simulasi.
 * Garis vertikal menandai jam sekarang; penunjuk atau panah kiri/kanan menampilkan nilai.
 */
export function DayChart({ bins, nowBin }: DayChartProps) {
  const [hoverBin, setHoverBin] = useState<number>();
  const powers = bins.flatMap((sample) => (sample ? [sample.pvPowerW, sample.loadPowerW] : []));
  const powerMax = niceMax(Math.max(0, ...powers));
  const bottomPx = SOC_BOX.yPx + SOC_BOX.heightPx;
  const markerX = (bin: number) => xOfBin(bin, CHART_BIN_COUNT, POWER_BOX);

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>): void => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const xPx = ((event.clientX - bounds.left) / bounds.width) * WIDTH_PX;
    setHoverBin(binAtX(xPx, CHART_BIN_COUNT, POWER_BOX));
  };
  const onKeyDown = (event: React.KeyboardEvent): void => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    setHoverBin((bin) => Math.min(Math.max((bin ?? nowBin) + step, 0), CHART_BIN_COUNT - 1));
  };
  const isLeftHalf = hoverBin !== undefined && hoverBin < CHART_BIN_COUNT / 2;

  return (
    <div className="relative" style={{ width: WIDTH_PX }}>
      <svg
        role="img"
        aria-label={`${t.chart.title}. ${t.chart.hint}`}
        tabIndex={0}
        width={WIDTH_PX}
        height={HEIGHT_PX}
        viewBox={`0 0 ${WIDTH_PX} ${HEIGHT_PX}`}
        className="day-chart-plot"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHoverBin(undefined)}
        onKeyDown={onKeyDown}
        onFocus={() => setHoverBin((bin) => bin ?? nowBin)}
        onBlur={() => setHoverBin(undefined)}
      >
        <PlotFrame
          box={POWER_BOX}
          title={t.chart.power}
          max={powerMax}
          ticks={[0, powerMax / 2, powerMax]}
        />
        <PlotFrame box={SOC_BOX} title={t.chart.soc} max={SOC_MAX_PCT} ticks={[0, 50, 100]} />
        {HOUR_TICKS.map((hour) => (
          <text
            key={hour}
            x={PLOT_LEFT_PX + (hour / 24) * PLOT_WIDTH_PX}
            y={bottomPx + 18}
            textAnchor="middle"
            className="chart-tick"
          >
            {hour === 24 ? '24:00' : formatClock(hour)}
          </text>
        ))}
        <line
          x1={markerX(nowBin)}
          x2={markerX(nowBin)}
          y1={POWER_BOX.yPx}
          y2={bottomPx}
          className="chart-now"
          data-now-bin={nowBin}
        />
        {[PV, LOAD].map((series) => (
          <SeriesLine
            key={series.id}
            series={series}
            bins={bins}
            box={POWER_BOX}
            max={powerMax}
            nowBin={nowBin}
            hoverBin={hoverBin}
          />
        ))}
        <SeriesLine
          series={SOC}
          bins={bins}
          box={SOC_BOX}
          max={SOC_MAX_PCT}
          nowBin={nowBin}
          hoverBin={hoverBin}
        />
        {hoverBin !== undefined && (
          <line
            x1={markerX(hoverBin)}
            x2={markerX(hoverBin)}
            y1={POWER_BOX.yPx}
            y2={bottomPx}
            className="chart-crosshair"
          />
        )}
      </svg>
      {hoverBin !== undefined && (
        <div
          role="tooltip"
          className="chart-tooltip"
          style={{
            left: markerX(hoverBin),
            transform: isLeftHalf
              ? `translateX(${TOOLTIP_GAP_PX}px)`
              : `translateX(calc(-100% - ${TOOLTIP_GAP_PX}px))`,
          }}
        >
          <div className="chart-tooltip-time">
            {formatClock((hoverBin * CHART_BIN_MINUTES) / 60)}
          </div>
          {ALL_SERIES.map((series) => (
            <div key={series.id} className="chart-tooltip-row">
              <span aria-hidden className="chart-key" style={{ background: series.color }} />
              <strong>{valueText(series, bins[hoverBin])}</strong>
              <span>{series.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
