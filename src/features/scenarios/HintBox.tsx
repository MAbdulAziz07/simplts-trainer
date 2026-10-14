import { CircleHelp } from 'lucide-react';
import { hintPenaltyOf, type ScenarioStep } from '@/domain';
import type { LoadedScenario } from '@/data';
import { t } from '@/i18n';
import { useScenarioStore } from '@/store';

const text = t.scenarios;

interface HintBoxProps {
  scenario: LoadedScenario;
  step: ScenarioStep;
  used: number;
}

/** Petunjuk bertingkat: petunjuk 1 samar, petunjuk 2 jelas; tiap petunjuk memotong nilai langkah. */
export function HintBox({ scenario, step, used }: HintBoxProps) {
  const openHint = useScenarioStore((state) => state.openHint);
  if (scenario.mode === 'assessment') {
    return <p className="text-ink-muted text-xs">{text.hintsOff}</p>;
  }
  const available = Math.min(step.hints.length, 2);
  const nextPenalty =
    hintPenaltyOf(scenario.rubric, used + 1) - hintPenaltyOf(scenario.rubric, used);
  return (
    <div className="flex flex-col gap-1.5">
      {step.hints.slice(0, used).map((hint, index) => (
        <p
          key={index}
          className="rounded-lg bg-amber-50 px-2 py-1.5 text-sm text-amber-900"
          aria-label={text.hintLevel(index + 1)}
        >
          <span className="mr-1 font-semibold">{index + 1}.</span>
          {hint}
        </p>
      ))}
      {used < available && (
        <button
          type="button"
          onClick={openHint}
          title={text.hintNext(used + 1, nextPenalty)}
          className="hover:bg-app flex h-11 items-center gap-2 self-start rounded-lg px-2 text-sm font-medium"
        >
          <CircleHelp aria-hidden size={20} className="text-status-warning" />
          {text.hintNext(used + 1, nextPenalty)}
        </button>
      )}
    </div>
  );
}
