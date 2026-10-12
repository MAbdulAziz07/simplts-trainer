// Keadaan simulasi. Satu-satunya tempat yang memanggil `stepSimulation` (docs/ARSITEKTUR.md §2):
// saat berjalan, tiap bingkai layar memajukan waktu; saat jeda, rangkaian hanya dihitung ulang
// bila rangkaian atau lingkungannya berubah, supaya alat ukur tetap membaca.
import { create } from 'zustand';
import {
  replaceWire,
  stepSimulation,
  type SimState,
  type Snapshot,
  type SolverEnvironment,
} from '@/domain';
import { cableItems, toPlacedComponents } from './catalog';
import { loadPowerSettings, type CircuitDoc } from './circuit-doc';
import { useCircuitStore } from './circuitStore';
import {
  DEFAULT_ENV,
  clockHourAt,
  environmentAt,
  withClockHour,
  type EnvSettings,
  type SimSpeed,
} from './sim-env';
import { startFrameLoop } from './sim-loop';
import {
  initialSimState,
  reconcileSimState,
  repairState,
  sameCircuit,
  switchesOpenedBySim,
  type CircuitParts,
} from './sim-reconcile';

/** Batas sub-langkah per hitungan, supaya satu bingkai tidak macet saat arus menuju trip. */
const MAX_SUBSTEPS_PER_TICK = 80;

/** Hasil satu hitungan rangkaian. */
interface Solved {
  state: SimState;
  snapshot: Snapshot;
  /** Lingkungan pada akhir hitungan; dipakai tampilan dan alat ukur. */
  environment: SolverEnvironment;
  /** Jam lokal desimal (10.5 = 10:30). */
  clockHour: number;
}

export interface SimStoreState extends Solved {
  running: boolean;
  speed: SimSpeed;
  settings: EnvSettings;
  /** Naik tiap "Reset percobaan"; riwayat grafik dan pemasangan kabel ikut dikosongkan. */
  resetCount: number;

  setRunning: (running: boolean) => void;
  setSpeed: (speed: SimSpeed) => void;
  setClockHour: (clockHour: number) => void;
  /** Mengubah awan, atau iradiasi/suhu manual (`undefined` = kembali mengikuti jam). */
  patchSettings: (patch: Partial<EnvSettings>) => void;
  /** Memajukan simulasi `realDtS` detik waktu nyata × kecepatan. */
  advance: (realDtS: number) => void;
  /** Tombol reset pada komponen: tindakannya mengikuti kondisi komponen. */
  repairComponent: (componentId: string) => void;
  /** Kabel rusak diganti baru. */
  repairWire: (wireId: string) => void;
  /**
   * Reset percobaan (docs/PRD.md §3.2): simulasi dijeda; komponen dan kabel rusak, tanda trip,
   * dosis termal, SoC, dan jam kembali ke awal. Susunan komponen, kabel, tuas, awan, dan setelan
   * manual dipertahankan; tuas MCB yang trip tetap OFF.
   */
  resetExperiment: () => void;
}

function partsOf(doc: CircuitDoc): CircuitParts {
  return {
    components: toPlacedComponents(doc),
    wires: doc.wires,
    closedSwitchIds: doc.closedSwitchIds,
  };
}

function solve(
  doc: CircuitDoc,
  state: SimState,
  settings: EnvSettings,
  dtS = 0,
  speed = 1,
): Solved {
  const result = stepSimulation({
    components: toPlacedComponents(doc),
    wires: doc.wires,
    cables: cableItems,
    environment: environmentAt(settings, state.timeS),
    state,
    dtS,
    speed,
    controls: { powerSettingWByLoadId: loadPowerSettings(doc) },
    maxSubsteps: MAX_SUBSTEPS_PER_TICK,
  });
  const { timeS } = result.state;
  return {
    state: result.state,
    snapshot: result.snapshot,
    environment: environmentAt(settings, timeS),
    clockHour: clockHourAt(settings, timeS),
  };
}

const circuitDoc = () => useCircuitStore.getState().doc;

/** Tuas MCB yang trip dipindah ke OFF di meja kerja. */
function syncSwitches(state: SimState): void {
  const opened = switchesOpenedBySim(state, circuitDoc().closedSwitchIds);
  if (opened.length > 0) useCircuitStore.getState().openSwitches(opened);
}

export const useSimStore = create<SimStoreState>()((set, get) => {
  /** Keadaan diganti dari luar langkah waktu (reset, ganti komponen): rangkaian dihitung ulang. */
  const apply = (state: SimState): void => {
    if (state === get().state) return;
    set(solve(circuitDoc(), state, get().settings));
    syncSwitches(state);
  };
  const applySettings = (settings: EnvSettings): void =>
    set({ settings, ...solve(circuitDoc(), get().state, settings) });

  return {
    running: false,
    speed: 1,
    settings: DEFAULT_ENV,
    resetCount: 0,
    ...solve(circuitDoc(), initialSimState(partsOf(circuitDoc())), DEFAULT_ENV),

    setRunning: (running) => set({ running }),
    setSpeed: (speed) => set({ speed }),
    setClockHour: (clockHour) =>
      applySettings(withClockHour(get().settings, get().state.timeS, clockHour)),
    patchSettings: (patch) => applySettings({ ...get().settings, ...patch }),

    advance: (realDtS) => {
      const { state, settings, speed } = get();
      const solved = solve(circuitDoc(), state, settings, realDtS, speed);
      set(solved);
      syncSwitches(solved.state);
    },

    repairComponent: (componentId) => {
      const condition = get().snapshot.components[componentId]?.condition;
      if (!condition) return;
      if (condition === 'tripped') {
        // MCB trip dipulihkan lewat tuasnya; `reconcileSimState` yang menghapus tanda trip.
        const circuit = useCircuitStore.getState();
        if (!circuit.doc.closedSwitchIds.includes(componentId)) circuit.toggleSwitch(componentId);
        return;
      }
      apply(repairState(get().state, componentId, condition));
    },
    repairWire: (wireId) => apply(replaceWire(get().state, wireId)),

    resetExperiment: () => {
      const doc = circuitDoc();
      const settings = { ...get().settings, startHour: DEFAULT_ENV.startHour };
      set({
        running: false,
        settings,
        resetCount: get().resetCount + 1,
        ...solve(doc, initialSimState(partsOf(doc)), settings),
      });
    },
  };
});

// Rangkaian berubah: keadaan simulasi disesuaikan. Rangkaian lain dimuat: mulai dari awal dalam
// keadaan jeda (docs/PRD.md §3.2). Menggeser atau memutar komponen tidak memicu hitungan.
useCircuitStore.subscribe((circuit, previous) => {
  const sim = useSimStore.getState();
  if (circuit.loadCount !== previous.loadCount) {
    const state = initialSimState(partsOf(circuit.doc));
    useSimStore.setState({ running: false, ...solve(circuit.doc, state, sim.settings) });
    return;
  }
  if (sameCircuit(circuit.doc, previous.doc)) return;
  const state = reconcileSimState(sim.state, partsOf(circuit.doc));
  useSimStore.setState(solve(circuit.doc, state, sim.settings));
  // Tuas MCB rusak yang di-ON-kan pengguna kembali ke OFF.
  syncSwitches(state);
});

// Putar/jeda menyalakan dan mematikan putaran bingkai.
let stopLoop: (() => void) | undefined;
useSimStore.subscribe((sim, previous) => {
  if (sim.running === previous.running) return;
  stopLoop?.();
  stopLoop = sim.running
    ? startFrameLoop((realDtS) => useSimStore.getState().advance(realDtS))
    : undefined;
});
