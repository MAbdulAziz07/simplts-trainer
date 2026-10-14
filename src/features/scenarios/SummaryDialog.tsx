import { Download, Printer, RotateCcw, X } from 'lucide-react';
import { useRef } from 'react';
import { t } from '@/i18n';
import { scoreOf, useScenarioStore, useToastStore, type ScenarioRun } from '@/store';
import {
  downloadText,
  durationSOf,
  faultLabel,
  formatDateTime,
  resultCsv,
  resultFileName,
} from './export';

const text = t.scenarios;
const summary = text.summary;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-0.5 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

/** Ringkasan nilai setelah "Selesai": skor rubrik, ekspor CSV, dan cetak lewat jendela cetak. */
export function SummaryDialog({ run }: { run: ScenarioRun }) {
  const score = scoreOf(run);
  const store = useScenarioStore.getState;
  const toast = useToastStore((state) => state.show);
  const { scenario } = run;
  const nowMs = run.finishedAtMs ?? run.startedAtMs;
  const stepText = new Map(scenario.steps.map((step) => [step.id, step.text]));
  const logRef = useRef<HTMLDetailsElement>(null);

  // Log aksi dibuka dulu supaya ikut tercetak.
  const print = () => {
    if (logRef.current) logRef.current.open = true;
    window.print();
  };

  const exportCsv = () => {
    downloadText(resultFileName(run), resultCsv(run, score, nowMs), 'text/csv;charset=utf-8');
    toast(text.exported);
  };

  return (
    <div className="scenario-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={summary.title}
        className="scenario-print border-line bg-card flex max-h-[90vh] w-[min(560px,calc(100vw-32px))] flex-col rounded-2xl border shadow-xl"
      >
        <header className="border-line flex items-center gap-2 border-b px-4 py-2">
          <h2 className="text-base font-semibold">{summary.title}</h2>
          <button
            type="button"
            aria-label={text.close}
            title={text.close}
            onClick={() => store().exit()}
            className="no-print hover:bg-app ml-auto flex size-11 items-center justify-center rounded-lg"
          >
            <X aria-hidden size={20} />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div className="flex items-center gap-4">
            <span className="text-4xl font-bold tabular-nums" data-testid="scenario-score-pct">
              {summary.pct(score.pct)}
            </span>
            <span className="flex flex-col">
              <span
                className={`text-sm font-semibold ${score.passed ? 'text-status-ok' : 'text-status-danger'}`}
              >
                {score.passed ? summary.passed : summary.failed}
              </span>
              <span className="text-ink-muted text-sm tabular-nums">
                {summary.score(score.score, score.max)}
              </span>
            </span>
          </div>
          <dl>
            <Row label={summary.participant} value={run.participant || '—'} />
            <Row label={summary.scenario} value={`${scenario.title} (v${scenario.version})`} />
            <Row label={summary.started} value={formatDateTime(run.startedAtMs)} />
            <Row label={summary.duration} value={text.elapsed(durationSOf(run, nowMs))} />
            {scenario.mode === 'troubleshoot' && (
              <>
                <Row label={summary.faultsInjected} value={run.faults.map(faultLabel).join(', ')} />
                <Row
                  label={summary.faultPoints}
                  value={`${score.faultEarned} / ${score.faultMax}`}
                />
                <Row
                  label={summary.wrongAnswers}
                  value={summary.penalty(score.wrongAnswerPenalty)}
                />
              </>
            )}
            <Row label={summary.damage} value={summary.penalty(score.damagePenalty)} />
            <Row label={summary.danger} value={summary.penalty(score.dangerPenalty)} />
          </dl>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-muted text-left text-xs">
                <th className="py-1 font-medium">{summary.step}</th>
                <th className="py-1 text-right font-medium">{summary.hints}</th>
                <th className="py-1 text-right font-medium">{summary.points}</th>
              </tr>
            </thead>
            <tbody>
              {score.steps.map((step) => (
                <tr key={step.stepId} className="border-line border-t">
                  <td className="py-1">
                    <span aria-hidden className="mr-1">
                      {step.done ? '✓' : '·'}
                    </span>
                    {stepText.get(step.stepId)}
                  </td>
                  <td className="py-1 text-right tabular-nums">{step.hints}</td>
                  <td className="py-1 text-right tabular-nums">
                    {step.earned}/{step.max}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <details ref={logRef}>
            <summary className="cursor-pointer text-sm font-medium">{summary.log}</summary>
            <table className="mt-1 w-full text-xs">
              <thead>
                <tr className="text-ink-muted text-left">
                  <th className="font-medium">{summary.time}</th>
                  <th className="font-medium">{summary.action}</th>
                  <th className="font-medium">{summary.detail}</th>
                </tr>
              </thead>
              <tbody>
                {run.log.map((entry, index) => (
                  <tr key={index} className="border-line border-t align-top">
                    <td className="pr-2 tabular-nums">{text.elapsed(entry.realS)}</td>
                    <td className="pr-2">{text.logActions[entry.action]}</td>
                    <td className="break-all">{entry.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
        <footer className="no-print border-line flex items-center gap-2 border-t px-4 py-3">
          <button
            type="button"
            onClick={() => store().restart()}
            className="hover:bg-app flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium"
          >
            <RotateCcw aria-hidden size={18} />
            {text.restart}
          </button>
          <button
            type="button"
            onClick={print}
            className="hover:bg-app ml-auto flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium"
          >
            <Printer aria-hidden size={18} />
            {summary.print}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="bg-brand flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white"
          >
            <Download aria-hidden size={18} />
            {summary.exportCsv}
          </button>
        </footer>
      </div>
    </div>
  );
}
