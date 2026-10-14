// Hasil skenario sebagai tabel CSV (ringkasan, langkah, log aksi) untuk dikumpulkan instruktur.
import { toCsv, type Fault, type ScoreResult } from '@/domain';
import { t } from '@/i18n';
import type { ScenarioRun } from '@/store';

const text = t.scenarios;
/** Tanda urutan bita UTF-8 di awal berkas. */
const BOM = String.fromCharCode(0xfeff);
const decimal = (value: number, digits = 1) =>
  value.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: digits });

/** `2026-10-15 09:05:03` waktu lokal. */
export function formatDateTime(ms: number): string {
  const date = new Date(ms);
  const two = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ` +
    `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`
  );
}

export const faultLabel = (fault: Fault) => text.faultTarget(text.faults[fault.kind], fault.target);

/** Lama skenario dalam detik nyata; skenario yang belum selesai dihitung sampai `nowMs`. */
export const durationSOf = (run: ScenarioRun, nowMs: number) =>
  ((run.finishedAtMs ?? nowMs) - run.startedAtMs) / 1000;

export function resultRows(run: ScenarioRun, score: ScoreResult, nowMs: number): string[][] {
  const { scenario } = run;
  const csv = text.csv;
  const summary = text.summary;
  const lastSimS = run.log.at(-1)?.simS ?? 0;
  const stepText = new Map(scenario.steps.map((step) => [step.id, step.text]));
  const doneById = new Map(run.completed.map((step) => [step.stepId, step]));
  return [
    [csv.section.summary],
    [csv.field, csv.value],
    [summary.participant, run.participant],
    [summary.scenario, `${scenario.title} (${scenario.id})`],
    [csv.version, String(scenario.version)],
    [csv.mode, text.modes[scenario.mode]],
    [summary.started, formatDateTime(run.startedAtMs)],
    [csv.finished, run.finishedAtMs === undefined ? '' : formatDateTime(run.finishedAtMs)],
    [summary.duration, text.elapsed(durationSOf(run, nowMs))],
    [summary.simTime, text.elapsed(lastSimS)],
    [summary.points, `${decimal(score.score)} / ${decimal(score.max)}`],
    [csv.scorePct, String(score.pct)],
    [csv.result, score.passed ? summary.passed : summary.failed],
    ...(scenario.mode === 'troubleshoot'
      ? [
          [summary.faultsInjected, run.faults.map(faultLabel).join(', ')],
          [summary.fault, `${run.foundFaults.length}/${run.faults.length}`],
          [summary.wrongAnswers, String(run.wrongAnswers)],
        ]
      : []),
    [summary.damage, String(run.damagedIds.length)],
    [summary.danger, run.dangerFindingCodes.join(', ')],
    [],
    [csv.section.steps],
    [summary.step, summary.hints, summary.points, summary.done, csv.realS, csv.simS],
    ...score.steps.map((step) => {
      const done = doneById.get(step.stepId);
      return [
        stepText.get(step.stepId) ?? step.stepId,
        String(step.hints),
        `${decimal(step.earned)} / ${decimal(step.max)}`,
        step.done ? summary.done : summary.notDone,
        done ? decimal(done.realS) : '',
        done ? decimal(done.simS, 0) : '',
      ];
    }),
    [],
    [csv.section.log],
    [csv.realS, csv.simS, summary.action, summary.detail],
    ...run.log.map((entry) => [
      decimal(entry.realS),
      decimal(entry.simS, 0),
      text.logActions[entry.action],
      entry.detail,
    ]),
  ];
}

/** Teks CSV berpemisah titik koma, diawali BOM agar Excel membaca UTF-8. */
export function resultCsv(run: ScenarioRun, score: ScoreResult, nowMs: number): string {
  return `${BOM}${toCsv(resultRows(run, score, nowMs))}`;
}

/** Nama berkas hasil: `hasil-<id>-<tanggal>-<jam>.csv`. */
export function resultFileName(run: ScenarioRun): string {
  const stamp = formatDateTime(run.finishedAtMs ?? run.startedAtMs)
    .replace(/[: ]/g, '')
    .replace(/-/g, '');
  return text.csv.fileName(run.scenario.id, stamp);
}

export function downloadText(fileName: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
