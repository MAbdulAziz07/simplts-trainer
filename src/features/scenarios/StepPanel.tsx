import { ChevronDown, ChevronUp, CircleCheck, Flag, LogOut, RotateCcw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { t } from '@/i18n';
import { allFaultsFound, useScenarioStore, type ScenarioRun } from '@/store';
import { DiagnosisBox } from './DiagnosisBox';
import { HintBox } from './HintBox';
import { MODE_ICON, STEP_ICON } from './icons';

const text = t.scenarios;

function useElapsedS(startedAtMs: number): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (nowMs - startedAtMs) / 1000;
}

function IconButton(props: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
      className="hover:bg-app flex size-11 shrink-0 items-center justify-center rounded-lg"
    >
      {props.children}
    </button>
  );
}

/** Panel langkah ringkas: satu langkah tampil per kali, tercentang otomatis saat terpenuhi. */
export function StepPanel({ run }: { run: ScenarioRun }) {
  const [collapsed, setCollapsed] = useState(false);
  const store = useScenarioStore.getState;
  const { scenario, stepIndex } = run;
  const steps = scenario.steps;
  const step = steps[stepIndex];
  const elapsedS = useElapsedS(run.startedAtMs);
  const ModeIcon = MODE_ICON[scenario.mode];
  const isAllDone = step === undefined;
  const showDiagnosis = scenario.mode === 'troubleshoot' && !allFaultsFound(run);

  return (
    <section
      aria-label={text.panel}
      className="scenario-panel"
      data-collapsed={collapsed || undefined}
    >
      <header className="flex items-center gap-1">
        <ModeIcon aria-hidden size={20} className="text-brand ml-1 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col px-1">
          <span className="truncate text-sm font-semibold">{scenario.title}</span>
          <span className="text-ink-muted text-xs tabular-nums">
            {text.modes[scenario.mode]} · {text.elapsed(elapsedS)}
          </span>
        </div>
        <IconButton
          label={collapsed ? text.expand : text.collapse}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ChevronDown aria-hidden size={20} /> : <ChevronUp aria-hidden size={20} />}
        </IconButton>
      </header>

      <ol
        aria-label={text.stepOf(Math.min(stepIndex + 1, steps.length), steps.length)}
        className="flex gap-1 px-1"
      >
        {steps.map((candidate, index) => (
          <li
            key={candidate.id}
            className="scenario-dot"
            data-state={index < stepIndex ? 'done' : index === stepIndex ? 'current' : 'todo'}
          />
        ))}
      </ol>

      {!collapsed && (
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step?.id ?? 'done'}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-3 px-1"
            >
              {step ? (
                <>
                  {(() => {
                    const StepIcon = STEP_ICON[step.icon];
                    return <StepIcon aria-hidden size={28} className="text-brand shrink-0" />;
                  })()}
                  <div className="flex min-w-0 flex-col">
                    <span className="text-ink-muted text-xs">
                      {text.stepOf(stepIndex + 1, steps.length)}
                    </span>
                    <p className="text-base leading-snug font-semibold" data-step-id={step.id}>
                      {step.text}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <CircleCheck aria-hidden size={28} className="text-status-ok shrink-0" />
                  <p role="status" className="text-base font-semibold">
                    {text.allDone}
                  </p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
          {step && <HintBox scenario={scenario} step={step} used={run.hintsUsed[step.id] ?? 0} />}
          {showDiagnosis && <DiagnosisBox run={run} />}
        </div>
      )}

      <footer className="border-line flex items-center gap-1 border-t pt-1">
        <button
          type="button"
          onClick={() => store().finish()}
          className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold ${
            isAllDone ? 'bg-brand text-white' : 'hover:bg-app'
          }`}
        >
          <Flag aria-hidden size={18} />
          {text.finish}
        </button>
        <IconButton label={text.restart} onClick={() => store().restart()}>
          <RotateCcw aria-hidden size={20} />
        </IconButton>
        <IconButton label={text.exit} onClick={() => store().exit()}>
          <LogOut aria-hidden size={20} />
        </IconButton>
      </footer>
    </section>
  );
}
