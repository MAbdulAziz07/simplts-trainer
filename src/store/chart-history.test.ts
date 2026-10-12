import { beforeEach, describe, expect, it } from 'vitest';
import {
  CHART_BIN_COUNT,
  EMPTY_BINS,
  binCenterHour,
  binIndexOf,
  recordSample,
  type ChartSample,
} from './chart-history';
import { useChartStore } from './chartStore';
import { EMPTY_DOC } from './circuit-doc';
import { useCircuitStore } from './circuitStore';
import { docToProject } from './project-io';
import { DEFAULT_ENV } from './sim-env';
import { INITIAL_SOC_PCT } from './sim-reconcile';
import { useSimStore } from './simStore';

const SAMPLE: ChartSample = { pvPowerW: 80, loadPowerW: 60, socPct: 75 };

describe('binIndexOf dan binCenterHour', () => {
  it('24 jam dibagi 288 ruas 5 menit', () => {
    expect(CHART_BIN_COUNT).toBe(288);
    expect(binIndexOf(0)).toBe(0);
    expect(binIndexOf(10)).toBe(120);
    expect(binIndexOf(10 + 4.9 / 60)).toBe(120);
    expect(binIndexOf(10 + 5 / 60)).toBe(121);
    expect(binIndexOf(23.999)).toBe(287);
    expect(binIndexOf(24)).toBe(0);
    expect(binIndexOf(-0.01)).toBe(287);
  });

  it('tengah ruas kembali ke ruas yang sama', () => {
    expect(binCenterHour(0)).toBeCloseTo(2.5 / 60, 9);
    expect(binIndexOf(binCenterHour(200))).toBe(200);
  });
});

describe('recordSample', () => {
  it('mencatat di ruas jam itu tanpa mengubah larik asal', () => {
    const bins = recordSample(EMPTY_BINS, 10.02, SAMPLE);
    expect(bins[120]).toEqual(SAMPLE);
    expect(bins.filter(Boolean)).toHaveLength(1);
    expect(EMPTY_BINS[120]).toBeUndefined();
  });

  it('cuplikan yang sama mengembalikan larik yang sama; yang berbeda menimpa', () => {
    const bins = recordSample(EMPTY_BINS, 10, SAMPLE);
    expect(recordSample(bins, 10.01, { ...SAMPLE })).toBe(bins);
    const updated = recordSample(bins, 10.01, { ...SAMPLE, pvPowerW: 81 });
    expect(updated).not.toBe(bins);
    expect(updated[120]?.pvPowerW).toBe(81);
  });
});

describe('chartStore', () => {
  const sim = () => useSimStore.getState();
  const circuit = () => useCircuitStore.getState();

  beforeEach(() => {
    useCircuitStore.setState({ level: 'expert', gestureStart: undefined });
    circuit().loadProject(docToProject(EMPTY_DOC, 'min'));
    useSimStore.setState({ running: false, speed: 1 });
    sim().patchSettings(DEFAULT_ENV);
    useChartStore.getState().clear();
  });

  it('mencatat daya PV, daya beban, dan SoC tiap simulasi maju; tanpa ruas kosong pada 600×', () => {
    circuit().addComponent('bat-vrla-agm-12v-100ah', { xPx: 0, yPx: 0 });
    circuit().addComponent('load-dc-12v-200w', { xPx: 240, yPx: 0 });
    circuit().connect(
      { componentId: 'c1', terminalId: 'pos' },
      { componentId: 'c2', terminalId: 'a' },
    );
    circuit().connect(
      { componentId: 'c1', terminalId: 'neg' },
      { componentId: 'c2', terminalId: 'b' },
    );
    expect(useChartStore.getState().bins.filter(Boolean)).toHaveLength(0);

    sim().setSpeed(600);
    // 60 hitungan × 0,25 s × 600 = 2,5 jam simulasi mulai pukul 10:00.
    for (let i = 0; i < 60; i += 1) sim().advance(0.25);
    const { bins } = useChartStore.getState();
    const filled = bins.flatMap((sample, index) => (sample ? [index] : []));
    expect(filled[0]).toBe(120);
    expect(filled).toHaveLength(filled[filled.length - 1]! - 120 + 1);
    expect(filled.length).toBeGreaterThanOrEqual(30);

    const first = bins[120];
    const last = bins[filled[filled.length - 1]!];
    expect(first?.loadPowerW).toBeGreaterThan(150);
    expect(first?.pvPowerW).toBe(0);
    expect(first?.socPct).toBeLessThanOrEqual(INITIAL_SOC_PCT);
    expect(last?.socPct).toBeLessThan(first?.socPct ?? 0);
  });

  it('tanpa baterai SoC kosong; memuat rangkaian lain mengosongkan riwayat', () => {
    sim().advance(1);
    const recorded = useChartStore.getState().bins[120];
    expect(recorded).toEqual({ pvPowerW: 0, loadPowerW: 0 });
    circuit().loadProject(docToProject(EMPTY_DOC, 'min'));
    expect(useChartStore.getState().bins.filter(Boolean)).toHaveLength(0);
  });
});
