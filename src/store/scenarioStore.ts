// Skenario yang sedang dijalankan: memuat rangkaian awal, memasang gangguan tersembunyi, memeriksa
// langkah setiap meja kerja, simulasi, atau alat ukur berubah, dan mencatat log aksi.
import { create } from 'zustand';
import {
  faultCandidates,
  pickFaults,
  referencesOf,
  scoreScenario,
  type Fault,
  type FaultKind,
  type ScoreResult,
} from '@/domain';
import { loadPreset, loadScenarios, type LoadedScenario } from '@/data';
import { catalogItems, toPlacedComponents } from './catalog';
import { useCircuitStore } from './circuitStore';
import { useFaultStore } from './faultStore';
import { useFindingsStore } from './findingsStore';
import { useInstrumentStore } from './instrumentStore';
import { projectToDoc } from './project-io';
import {
  completeSteps,
  createRun,
  diagnose,
  finishRun,
  isRunActive,
  openHint,
  progressOf,
  type ScenarioRun,
} from './scenario-run';
import { trackScenario } from './scenario-tracking';
import { DEFAULT_ENV } from './sim-env';
import { useSimStore } from './simStore';

export const scenarioList: readonly LoadedScenario[] = loadScenarios(catalogItems);

export interface StartOptions {
  participant?: string;
  /** Gangguan pilihan instruktur; kosong pada mode Cari Gangguan = diacak. */
  faults?: readonly Fault[];
  random?: () => number;
}

export interface ScenarioState {
  run?: ScenarioRun;
  /** Hasil jawaban gangguan terakhir; untuk umpan balik singkat. */
  lastDiagnosis?: 'right' | 'wrong';
  /** Skenario yang dibuka dari berkas selama sesi ini. */
  openedScenarios: LoadedScenario[];

  /** Menambah skenario dari berkas; id yang sama menggantikan yang lama. */
  addScenario: (scenario: LoadedScenario) => void;
  start: (scenario: LoadedScenario, options?: StartOptions) => void;
  /** Mulai ulang skenario yang sama dengan gangguan yang sama. */
  restart: () => void;
  openHint: () => void;
  diagnose: (kind: FaultKind, locationId: string) => void;
  finish: () => void;
  exit: () => void;
  /** Memeriksa langkah yang sedang tampil sekarang juga. */
  evaluate: () => void;
}

/** Pilihan gangguan untuk instruktur: daftar di skenario, atau semua yang cocok dengan rangkaian. */
export function faultChoicesOf(scenario: LoadedScenario): Fault[] {
  if (scenario.faults.length > 0) return scenario.faults;
  if (!scenario.initialCircuit) return [];
  const doc = projectToDoc(scenario.initialCircuit);
  return faultCandidates(toPlacedComponents(doc), doc.wires);
}

export function scoreOf(run: ScenarioRun): ScoreResult {
  return scoreScenario(run.scenario, progressOf(run));
}

const simS = () => useSimStore.getState().snapshot.timeS;

function ruleContext() {
  const { doc } = useCircuitStore.getState();
  const sim = useSimStore.getState();
  const instruments = useInstrumentStore.getState();
  const components = toPlacedComponents(doc);
  return {
    components,
    wires: doc.wires,
    closedSwitchIds: doc.closedSwitchIds,
    snapshot: sim.snapshot,
    findings: useFindingsStore.getState().findings,
    multimeter: {
      open: instruments.open.multimeter,
      fn: instruments.meterFunction,
      red: instruments.probes.red,
      black: instruments.probes.black,
      reading: instruments.readings.multimeter,
    },
    clamp: {
      open: instruments.open.clamp,
      mode: instruments.clampMode,
      wireId: instruments.clampWireId,
      reading: instruments.readings.clamp,
    },
    references: referencesOf(components, sim.environment, sim.snapshot),
  };
}

export const useScenarioStore = create<ScenarioState>()((set, get) => {
  /** Mengubah jalannya skenario yang aktif; tanpa skenario aktif tidak ada yang berubah. */
  const update = (change: (run: ScenarioRun) => ScenarioRun): void => {
    const { run } = get();
    if (!isRunActive(run)) return;
    const next = change(run);
    if (next !== run) set({ run: next });
  };

  return {
    openedScenarios: [],
    addScenario: (scenario) =>
      set({
        openedScenarios: [
          ...get().openedScenarios.filter((other) => other.id !== scenario.id),
          scenario,
        ],
      }),

    start: (scenario, options = {}) => {
      const faults =
        scenario.mode !== 'troubleshoot'
          ? []
          : options.faults && options.faults.length > 0
            ? [...options.faults]
            : pickFaults(
                faultChoicesOf(scenario),
                scenario.faultCount,
                options.random ?? Math.random,
              );
      // Gangguan dipasang lebih dulu supaya hitungan pertama rangkaian baru sudah memakainya.
      set({ run: undefined, lastDiagnosis: undefined });
      useFaultStore.getState().setFaults(faults);
      const project = scenario.initialCircuit ?? loadPreset(scenario.package, catalogItems);
      useCircuitStore.getState().loadProject(project);
      const env = scenario.environment ?? {};
      useSimStore.getState().patchSettings({
        startHour: env.startHour ?? DEFAULT_ENV.startHour,
        cloudCoverPct: env.cloudCoverPct ?? DEFAULT_ENV.cloudCoverPct,
        manualIrradianceWm2: env.irradianceWm2,
      });
      set({ run: createRun(scenario, faults, options.participant?.trim() ?? '', Date.now()) });
      get().evaluate();
    },

    restart: () => {
      const { run } = get();
      if (run) get().start(run.scenario, { participant: run.participant, faults: run.faults });
    },

    openHint: () => update((run) => openHint(run, simS(), Date.now())),

    diagnose: (kind, locationId) => {
      const { run } = get();
      if (!isRunActive(run)) return;
      const result = diagnose(run, kind, locationId, simS(), Date.now());
      set({ run: result.run, lastDiagnosis: result.fault ? 'right' : 'wrong' });
      // Gangguan yang tertebak diperbaiki: dicabut dari simulasi.
      if (result.fault) {
        const remaining = useFaultStore.getState().faults.filter((f) => f !== result.fault);
        useFaultStore.getState().setFaults(remaining);
        get().evaluate();
      }
    },

    finish: () => update((run) => finishRun(run, simS(), Date.now())),

    exit: () => {
      set({ run: undefined, lastDiagnosis: undefined });
      useFaultStore.getState().setFaults([]);
    },

    evaluate: () => update((run) => completeSteps(run, ruleContext(), Date.now())),
  };
});

trackScenario(useScenarioStore);
