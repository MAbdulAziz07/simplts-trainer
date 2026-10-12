// Alat ukur di meja kerja: alat yang dibuka, fungsi yang dipilih, tempat probe dan tang ampere
// menempel, serta bacaan yang dicuplik dua kali per detik seperti alat nyata.
import { create } from 'zustand';
import type { ClampMode, MeterFunction, MeterReading, TerminalRef } from '@/domain';
import { useCircuitStore } from './circuitStore';
import {
  clampReading,
  hasTerminal,
  multimeterReading,
  solarReadingWm2,
  type MeasureContext,
  type ProbeRefs,
} from './instrument-readings';
import { useSimStore } from './simStore';

export const INSTRUMENT_IDS = ['multimeter', 'clamp', 'solar'] as const;
export type InstrumentId = (typeof INSTRUMENT_IDS)[number];
export type ProbeId = keyof ProbeRefs;
/** Alat yang bisa dibawa ke meja: probe ke terminal, tang ampere ke kabel. */
export type PlacingTool = ProbeId | 'clamp';

/** Jarak antarcuplikan bacaan: 2 kali per detik. */
export const SAMPLE_INTERVAL_MS = 500;

export interface InstrumentReadings {
  multimeter: MeterReading;
  clamp: MeterReading;
  solarWm2: number;
}

export interface InstrumentState {
  open: Record<InstrumentId, boolean>;
  meterFunction: MeterFunction;
  probes: ProbeRefs;
  clampMode: ClampMode;
  clampWireId?: string;
  /** Alat yang sedang dibawa menuju sasarannya (ketuk alat, lalu ketuk terminal atau kabel). */
  placing?: PlacingTool;
  readings: InstrumentReadings;

  toggle: (id: InstrumentId) => void;
  setMeterFunction: (fn: MeterFunction) => void;
  setClampMode: (mode: ClampMode) => void;
  setPlacing: (tool: PlacingTool | undefined) => void;
  /** Menempelkan probe ke terminal; `undefined` = melepasnya. */
  attachProbe: (probe: ProbeId, ref: TerminalRef | undefined) => void;
  /** Menjepitkan tang ampere ke kabel; `undefined` = melepasnya. */
  attachClamp: (wireId: string | undefined) => void;
  /** Mencuplik bacaan semua alat; probe dan jepitan yang sasarannya sudah dihapus dilepas. */
  sample: (random?: () => number) => void;
}

const ZERO: MeterReading = { kind: 'value', value: 0 };

function context(): MeasureContext {
  const { state, snapshot } = useSimStore.getState();
  return { doc: useCircuitStore.getState().doc, state, snapshot };
}

export const useInstrumentStore = create<InstrumentState>()((set, get) => {
  /** Perubahan setelan langsung terlihat di layar alat, tanpa menunggu cuplikan berikutnya. */
  const change = (patch: Partial<InstrumentState>): void => {
    set(patch);
    get().sample();
  };

  return {
    open: { multimeter: false, clamp: false, solar: false },
    meterFunction: 'vdc',
    probes: {},
    clampMode: 'dc',
    readings: { multimeter: ZERO, clamp: ZERO, solarWm2: 0 },

    toggle: (id) => {
      const open = { ...get().open, [id]: !get().open[id] };
      // Alat yang ditutup melepas probe atau jepitannya.
      const detached =
        id === 'multimeter' && !open.multimeter
          ? { probes: {} }
          : id === 'clamp' && !open.clamp
            ? { clampWireId: undefined }
            : {};
      change({ open, ...detached, placing: undefined });
    },
    setMeterFunction: (meterFunction) => change({ meterFunction }),
    setClampMode: (clampMode) => change({ clampMode }),
    setPlacing: (placing) => set({ placing }),
    attachProbe: (probe, ref) => change({ probes: { ...get().probes, [probe]: ref } }),
    attachClamp: (clampWireId) => change({ clampWireId }),

    sample: (random = Math.random) => {
      const measured = context();
      const current = get();
      const kept = (ref: TerminalRef | undefined) =>
        ref && hasTerminal(measured.snapshot, ref) ? ref : undefined;
      const probes: ProbeRefs = {
        red: kept(current.probes.red),
        black: kept(current.probes.black),
      };
      const isSame = probes.red === current.probes.red && probes.black === current.probes.black;
      const clampWireId = measured.doc.wires.some((wire) => wire.id === current.clampWireId)
        ? current.clampWireId
        : undefined;
      set({
        probes: isSame ? current.probes : probes,
        clampWireId,
        readings: {
          multimeter: multimeterReading(measured, current.meterFunction, probes, random),
          clamp: clampReading(measured, current.clampMode, clampWireId, random),
          solarWm2: solarReadingWm2(useSimStore.getState().environment.irradianceWm2, random),
        },
      });
    },
  };
});

// Selama ada alat yang terbuka, bacaannya diperbarui dua kali per detik (hanya di browser).
let timer: ReturnType<typeof setInterval> | undefined;
useInstrumentStore.subscribe((state, previous) => {
  if (state.open === previous.open || typeof window === 'undefined') return;
  const isAnyOpen = INSTRUMENT_IDS.some((id) => state.open[id]);
  if (isAnyOpen && timer === undefined) {
    timer = setInterval(() => useInstrumentStore.getState().sample(), SAMPLE_INTERVAL_MS);
  } else if (!isAnyOpen && timer !== undefined) {
    clearInterval(timer);
    timer = undefined;
  }
});
