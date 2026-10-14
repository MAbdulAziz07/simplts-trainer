// Pencatat skenario: aksi meja kerja, kejadian simulasi, temuan bahaya, dan bacaan alat ukur
// masuk ke log, lalu langkah yang tampil diperiksa ulang (dikumpulkan per jeda singkat).
import type { StoreApi, UseBoundStore } from 'zustand';
import { benchActions, type MeterReading, type TerminalRef } from '@/domain';
import { useCircuitStore } from './circuitStore';
import { useFindingsStore } from './findingsStore';
import { useInstrumentStore, type InstrumentState } from './instrumentStore';
import {
  isRunActive,
  logAction,
  recordDangerFindings,
  recordEvents,
  recordQuantitySample,
  type ScenarioRun,
} from './scenario-run';
import type { ScenarioState } from './scenarioStore';
import { useSimStore } from './simStore';

/** Jeda paling lama antara perubahan dan pemeriksaan langkah. */
export const EVALUATE_DELAY_MS = 200;

const simS = () => useSimStore.getState().snapshot.timeS;
const refText = (ref: TerminalRef) => `${ref.componentId}.${ref.terminalId}`;
const readingText = (reading: MeterReading) =>
  reading.kind === 'value' ? reading.value.toFixed(2) : 'OL';

/** Titik ukur dan bacaan alat yang sedang terpasang, mis. `vdc bat.pos / bat.neg = 12.71`. */
export function measurementsOf(state: InstrumentState): { key: string; text: string }[] {
  const { probes, clampWireId, readings, meterFunction, clampMode, open } = state;
  const list: { key: string; text: string }[] = [];
  if (open.multimeter && probes.red && probes.black && readings.multimeter.kind === 'value') {
    const key = `${meterFunction} ${refText(probes.red)} / ${refText(probes.black)}`;
    list.push({ key, text: `${key} = ${readingText(readings.multimeter)}` });
  }
  if (open.clamp && clampWireId && readings.clamp.kind === 'value') {
    const key = `clamp-${clampMode} ${clampWireId}`;
    list.push({ key, text: `${key} = ${readingText(readings.clamp)}` });
  }
  return list;
}

/** Memasang semua langganan pencatat pada `store`; dipanggil sekali oleh scenarioStore. */
export function trackScenario(store: UseBoundStore<StoreApi<ScenarioState>>): void {
  let pending: ReturnType<typeof setTimeout> | undefined;
  const scheduleEvaluate = (): void => {
    if (pending !== undefined || !isRunActive(store.getState().run)) return;
    pending = setTimeout(() => {
      pending = undefined;
      store.getState().evaluate();
    }, EVALUATE_DELAY_MS);
  };
  const updateRun = (change: (run: ScenarioRun) => ScenarioRun): void => {
    const { run } = store.getState();
    if (!isRunActive(run)) return;
    const next = change(run);
    if (next !== run) store.setState({ run: next });
  };

  useCircuitStore.subscribe((circuit, previous) => {
    // Rangkaian baru dimuat (mulai skenario, buka berkas): bukan aksi peserta.
    if (circuit.doc !== previous.doc && circuit.loadCount === previous.loadCount) {
      const actions = benchActions(previous.doc, circuit.doc);
      updateRun((run) =>
        actions.reduce(
          (next, { action, detail }) => logAction(next, action, detail, simS(), Date.now()),
          run,
        ),
      );
    }
    scheduleEvaluate();
  });

  useSimStore.subscribe((sim, previous) => {
    if (sim.snapshot === previous.snapshot) return;
    updateRun((run) =>
      recordEvents(recordQuantitySample(run, sim.snapshot), sim.snapshot, Date.now()),
    );
    scheduleEvaluate();
  });

  useFindingsStore.subscribe((state, previous) => {
    if (state.findings === previous.findings) return;
    const codes = state.findings.filter((f) => f.severity === 'danger').map((f) => f.code);
    updateRun((run) => recordDangerFindings(run, codes, simS(), Date.now()));
    scheduleEvaluate();
  });

  // Bacaan dicatat sekali tiap alat ditempel ke titik atau kabel yang baru.
  let loggedKeys = new Set<string>();
  useInstrumentStore.subscribe((state, previous) => {
    if (state.readings === previous.readings) return;
    const measurements = measurementsOf(state);
    const fresh = measurements.filter(({ key }) => !loggedKeys.has(key));
    loggedKeys = new Set(measurements.map(({ key }) => key));
    if (fresh.length > 0) {
      updateRun((run) => ({
        ...fresh.reduce(
          (next, { text }) => logAction(next, 'measure', text, simS(), Date.now()),
          run,
        ),
        measured: true,
      }));
    }
    scheduleEvaluate();
  });
}
