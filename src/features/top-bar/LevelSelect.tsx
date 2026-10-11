import { GraduationCap, Sprout } from 'lucide-react';
import type { ConnectionLevel } from '@/domain';
import { t } from '@/i18n';
import { useCircuitStore } from '@/store';

const LEVELS: readonly { id: ConnectionLevel; icon: typeof Sprout }[] = [
  { id: 'beginner', icon: Sprout },
  { id: 'expert', icon: GraduationCap },
];

/** Tingkat validasi sambungan: Pemula menolak sambungan mustahil, Mahir mengizinkan semuanya. */
export function LevelSelect() {
  const level = useCircuitStore((state) => state.level);
  const setLevel = useCircuitStore((state) => state.setLevel);

  return (
    <div role="radiogroup" aria-label={t.levelLabel} className="bg-app flex rounded-lg p-1">
      {LEVELS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.id === level}
          title={t.levelHints[option.id]}
          onClick={() => setLevel(option.id)}
          className={`flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium ${
            option.id === level ? 'bg-brand text-white' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <option.icon aria-hidden size={16} />
          {t.levels[option.id]}
        </button>
      ))}
    </div>
  );
}
