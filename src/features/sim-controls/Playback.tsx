import { Pause, Play } from 'lucide-react';
import { t } from '@/i18n';
import { SIM_SPEEDS, useSimStore } from '@/store';

/** Putar/jeda 48 px dan pilihan kecepatan (docs/UX.md §2.1). */
export function Playback() {
  const running = useSimStore((state) => state.running);
  const speed = useSimStore((state) => state.speed);
  const setRunning = useSimStore((state) => state.setRunning);
  const setSpeed = useSimStore((state) => state.setSpeed);
  const label = running ? t.sim.pause : t.sim.play;

  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-pressed={running}
        onClick={() => setRunning(!running)}
        className={`flex size-12 shrink-0 items-center justify-center rounded-full ${
          running ? 'border-brand text-brand border-2 bg-white' : 'bg-brand text-white'
        }`}
      >
        {running ? <Pause aria-hidden size={24} /> : <Play aria-hidden size={24} />}
      </button>
      <div
        role="radiogroup"
        aria-label={t.sim.speed}
        className="bg-app flex shrink-0 rounded-lg p-1"
      >
        {SIM_SPEEDS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === speed}
            title={t.sim.speedHint(option)}
            onClick={() => setSpeed(option)}
            className={`h-11 min-w-11 rounded-md px-2 text-sm font-semibold tabular-nums ${
              option === speed ? 'bg-brand text-white' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t.sim.speedOption(option)}
          </button>
        ))}
      </div>
    </>
  );
}
