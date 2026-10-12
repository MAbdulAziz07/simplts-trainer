// Riwayat grafik 24 jam: dicatat tiap simulasi maju, dikosongkan saat rangkaian lain dimuat atau
// percobaan direset.
// Pada 3600× satu hitungan bisa menempuh sampai 15 menit (0,25 s × 3600), jadi semua ruas 5 menit
// yang dilalui ikut diisi.
import { create } from 'zustand';
import { EMPTY_BINS, recordElapsed, sampleOf, type ChartBins } from './chart-history';
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
  if (sim.resetCount !== previous.resetCount) {
    useChartStore.getState().clear();
    return;
  }
  // Waktu yang mundur (rangkaian lain dimuat) tidak dicatat.
  if (sim.state.timeS <= previous.state.timeS) return;
  const { bins } = useChartStore.getState();
  // Lama langkah dihitung dari waktu simulasi, bukan dari jam: menggeser jam tidak mengisi ruas.
  const elapsedS = sim.state.timeS - previous.state.timeS;
  const next = recordElapsed(bins, sim.clockHour, elapsedS, sampleOf(sim.snapshot));
  if (next !== bins) useChartStore.setState({ bins: next });
});

useCircuitStore.subscribe((circuit, previous) => {
  if (circuit.loadCount !== previous.loadCount) useChartStore.getState().clear();
});
