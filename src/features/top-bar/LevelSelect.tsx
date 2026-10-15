import { GraduationCap, Sprout } from 'lucide-react';
import type { ConnectionLevel } from '@/domain';
import { t } from '@/i18n';
import { useCircuitStore } from '@/store';
import { SegmentedRadio, type SegmentedOption } from '@/ui';

const OPTIONS: readonly SegmentedOption<ConnectionLevel>[] = (
  [
    ['beginner', Sprout],
    ['expert', GraduationCap],
  ] as const
).map(([id, icon]) => ({ id, icon, label: t.levels[id], title: t.levelHints[id] }));

/** Tingkat validasi sambungan: Pemula menolak sambungan mustahil, Mahir mengizinkan semuanya. */
export function LevelSelect() {
  const level = useCircuitStore((state) => state.level);
  const setLevel = useCircuitStore((state) => state.setLevel);

  return (
    <SegmentedRadio label={t.levelLabel} options={OPTIONS} value={level} onChange={setLevel} />
  );
}
