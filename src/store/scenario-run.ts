// Jalannya satu skenario sebagai objek biasa dan perubahannya sebagai fungsi murni: langkah yang
// selesai, petunjuk, jawaban gangguan, kerusakan, temuan bahaya, dan log aksi.
import {
  appendSample,
  diagnosisMatches,
  evaluateRule,
  MAX_HINTS,
  quantitiesOf,
  usesInstrument,
  type Fault,
  type FaultKind,
  type LogAction,
  type LogEntry,
  type QuantitySample,
  type RuleContext,
  type ScenarioProgress,
  type Snapshot,
} from '@/domain';
import type { LoadedScenario } from '@/data';

/** Jarak antarcuplikan riwayat besaran (detik simulasi). */
export const HISTORY_SAMPLE_S = 5;

export interface StepDone {
  stepId: string;
  realS: number;
  simS: number;
}

export interface ScenarioRun {
  scenario: LoadedScenario;
  /** Gangguan yang disuntikkan saat mulai. */
  faults: Fault[];
  /** Gangguan yang sudah ditunjuk dengan benar (dan diperbaiki). */
  foundFaults: Fault[];
  participant: string;
  startedAtMs: number;
  finishedAtMs?: number;
  /** Langkah yang sedang tampil; = jumlah langkah bila semua selesai. */
  stepIndex: number;
  completed: StepDone[];
  hintsUsed: Record<string, number>;
  wrongAnswers: number;
  /** Jawaban benar sudah didahului bacaan alat ukur. */
  answeredWithEvidence?: boolean;
  /** Ada bacaan alat ukur yang tercatat. */
  measured: boolean;
  damagedIds: string[];
  dangerFindingCodes: string[];
  log: LogEntry[];
  history: QuantitySample[];
}

export function createRun(
  scenario: LoadedScenario,
  faults: readonly Fault[],
  participant: string,
  nowMs: number,
): ScenarioRun {
  return {
    scenario,
    faults: [...faults],
    foundFaults: [],
    participant,
    startedAtMs: nowMs,
    stepIndex: 0,
    completed: [],
    hintsUsed: {},
    wrongAnswers: 0,
    measured: false,
    damagedIds: [],
    dangerFindingCodes: [],
    log: [{ realS: 0, simS: 0, action: 'start', detail: `${scenario.id} v${scenario.version}` }],
    history: [],
  };
}

const realSOf = (run: ScenarioRun, nowMs: number) =>
  Math.max(0, Math.round((nowMs - run.startedAtMs) / 100) / 10);

/** Menambah satu baris log. */
export function logAction(
  run: ScenarioRun,
  action: LogAction,
  detail: string,
  simS: number,
  nowMs: number,
): ScenarioRun {
  const entry: LogEntry = { realS: realSOf(run, nowMs), simS: Math.round(simS), action, detail };
  return { ...run, log: [...run.log, entry] };
}

export const isRunActive = (run: ScenarioRun | undefined): run is ScenarioRun =>
  run !== undefined && run.finishedAtMs === undefined;

/** Semua gangguan sudah ditunjuk (tanpa gangguan = belum). */
export const allFaultsFound = (run: ScenarioRun): boolean =>
  run.faults.length > 0 && run.foundFaults.length >= run.faults.length;

/**
 * Memeriksa langkah yang sedang tampil; langkah yang terpenuhi dicentang dan langkah berikutnya
 * langsung diperiksa juga.
 */
export function completeSteps(
  run: ScenarioRun,
  context: Omit<RuleContext, 'history' | 'faultFound'>,
  nowMs: number,
): ScenarioRun {
  if (!isRunActive(run)) return run;
  let next = run;
  const fullContext: RuleContext = {
    ...context,
    history: run.history,
    faultFound: allFaultsFound(run),
  };
  for (
    let step = next.scenario.steps[next.stepIndex];
    step;
    step = next.scenario.steps[next.stepIndex]
  ) {
    if (!evaluateRule(step.done, fullContext)) break;
    const simS = context.snapshot.timeS;
    next = {
      ...next,
      stepIndex: next.stepIndex + 1,
      completed: [...next.completed, { stepId: step.id, realS: realSOf(run, nowMs), simS }],
      measured: next.measured || usesInstrument(step.done),
    };
    next = logAction(next, 'step-done', step.id, simS, nowMs);
  }
  return next;
}

/** Membuka petunjuk berikutnya pada langkah yang tampil; Asesmen tanpa petunjuk. */
export function openHint(run: ScenarioRun, simS: number, nowMs: number): ScenarioRun {
  const step = run.scenario.steps[run.stepIndex];
  if (!isRunActive(run) || !step || run.scenario.mode === 'assessment') return run;
  const used = run.hintsUsed[step.id] ?? 0;
  if (used >= Math.min(MAX_HINTS, step.hints.length)) return run;
  const next = { ...run, hintsUsed: { ...run.hintsUsed, [step.id]: used + 1 } };
  return logAction(next, 'hint', `${step.id} #${used + 1}`, simS, nowMs);
}

export interface DiagnosisResult {
  run: ScenarioRun;
  /** Gangguan yang tertebak; kosong bila jawaban salah. */
  fault?: Fault;
}

/** Jawaban peserta: jenis gangguan dan kabel/komponen yang ditunjuk. */
export function diagnose(
  run: ScenarioRun,
  kind: FaultKind,
  locationId: string,
  simS: number,
  nowMs: number,
): DiagnosisResult {
  if (!isRunActive(run)) return { run };
  const detail = `${kind} @ ${locationId}`;
  const fault = run.faults.find(
    (candidate) =>
      !run.foundFaults.includes(candidate) && diagnosisMatches(candidate, kind, locationId),
  );
  if (!fault) {
    const wrong = { ...run, wrongAnswers: run.wrongAnswers + 1 };
    return { run: logAction(wrong, 'diagnosis-wrong', detail, simS, nowMs) };
  }
  const found = { ...run, foundFaults: [...run.foundFaults, fault] };
  const withEvidence = run.answeredWithEvidence ?? true;
  const next = { ...found, answeredWithEvidence: withEvidence && run.measured };
  return { run: logAction(next, 'diagnosis-right', detail, simS, nowMs), fault };
}

/** Bahan perhitungan skor. */
export function progressOf(run: ScenarioRun): ScenarioProgress {
  return {
    completedStepIds: run.completed.map((step) => step.stepId),
    hintsUsed: run.hintsUsed,
    diagnosis: allFaultsFound(run)
      ? { correct: true, withEvidence: run.answeredWithEvidence ?? false }
      : undefined,
    wrongAnswers: run.wrongAnswers,
    damageCount: run.damagedIds.length,
    dangerFindingCodes: run.dangerFindingCodes,
  };
}

/** Cuplikan riwayat besaran ditambahkan tiap `HISTORY_SAMPLE_S` detik simulasi atau saat mundur. */
export function recordQuantitySample(run: ScenarioRun, snapshot: Snapshot): ScenarioRun {
  const last = run.history.at(-1);
  if (last && snapshot.timeS >= last.timeS && snapshot.timeS - last.timeS < HISTORY_SAMPLE_S)
    return run;
  const sample = { timeS: snapshot.timeS, values: quantitiesOf(snapshot) };
  return { ...run, history: appendSample(run.history, sample) };
}

/** Kerusakan baru dari kejadian simulasi dicatat sekali per komponen atau kabel. */
export function recordEvents(run: ScenarioRun, snapshot: Snapshot, nowMs: number): ScenarioRun {
  let next = run;
  for (const event of snapshot.events) {
    const target = event.componentId ?? event.wireId ?? '';
    next = logAction(next, 'sim-event', `${event.kind} ${target}`.trim(), event.timeS, nowMs);
    if (event.kind === 'component-damaged' && target && !next.damagedIds.includes(target))
      next = { ...next, damagedIds: [...next.damagedIds, target] };
  }
  return next;
}

/** Temuan bahaya yang baru pertama kali muncul. */
export function recordDangerFindings(
  run: ScenarioRun,
  codes: readonly string[],
  simS: number,
  nowMs: number,
): ScenarioRun {
  let next = run;
  for (const code of new Set(codes)) {
    if (next.dangerFindingCodes.includes(code)) continue;
    next = { ...next, dangerFindingCodes: [...next.dangerFindingCodes, code] };
    next = logAction(next, 'danger-finding', code, simS, nowMs);
  }
  return next;
}

export function finishRun(run: ScenarioRun, simS: number, nowMs: number): ScenarioRun {
  if (!isRunActive(run)) return run;
  return { ...logAction(run, 'finish', '', simS, nowMs), finishedAtMs: nowMs };
}
