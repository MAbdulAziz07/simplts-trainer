// Riwayat grafik 24 jam: dicatat tiap simulasi maju, dikosongkan saat rangkaian lain dimuat.
// Satu hitungan simulasi paling jauh 150 s (0,25 s × 600), jadi tidak ada ruas 5 menit terlewat.
import { create } from 'zustand';
import { EMPTY_BINS, recordSample, sampleOf, type ChartBins } from './chart-history';
import { useCircuitStore } from './circuitStore';
import { useSimStore } from './simStore';

export interface ChartState {
  /** Grafik sedang dibuka. */
  open: boolean;
  bins: ChartBins;
  setOpen: (open: boolean) => void;
  clear: () => void;
}

export const useChartStore = create<ChartState>()((set) => ({
  open: false,
  bins: EMPTY_BINS,
  setOpen: (open) => set({ open }),
  clear: () => set({ bins: EMPTY_BINS }),
}));

useSimStore.subscribe((sim, previous) => {
  if (sim.state.timeS === previous.state.timeS) return;
  // Waktu mundur ke nol = simulasi diulang dari awal.
  if (sim.state.timeS < previous.state.timeS) return;
  const { bins } = useChartStore.getState();
  const next = recordSample(bins, sim.clockHour, sampleOf(sim.snapshot));
  if (next !== bins) useChartStore.setState({ bins: next });
});

useCircuitStore.subscribe((circuit, previous) => {
  if (circuit.loadCount !== previous.loadCount) useChartStore.getState().clear();
});
