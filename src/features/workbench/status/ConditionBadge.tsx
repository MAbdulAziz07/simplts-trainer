import {
  Ban,
  BatteryLow,
  BatteryWarning,
  Flame,
  Gauge,
  ShieldOff,
  TrendingDown,
  TriangleAlert,
  Unplug,
  Wrench,
  ZapOff,
  type LucideIcon,
} from 'lucide-react';
import type { CatalogItem, ComponentCondition } from '@/domain';
import { t } from '@/i18n';
import { REPAIRABLE_CONDITIONS, useSimStore } from '@/store';
import { BADGE_TONE } from './indicators';

type MarkedCondition = keyof typeof t.status.conditions;

const ICON: Record<MarkedCondition, LucideIcon> = {
  tripped: ZapOff,
  blown: Unplug,
  cutoff: ShieldOff,
  lvd: BatteryLow,
  hvd: BatteryWarning,
  overload: Gauge,
  fault: TriangleAlert,
  collapsed: TrendingDown,
  damaged: Flame,
  unsupported: Ban,
};

const isMarked = (condition: ComponentCondition): condition is MarkedCondition => condition in ICON;
const isRepairable = (condition: MarkedCondition): condition is keyof typeof t.status.repair =>
  condition in t.status.repair && REPAIRABLE_CONDITIONS.includes(condition);

/**
 * Tanda kondisi di pojok kanan atas node: ikon + teks singkat + warna (docs/UX.md §2.4). Komponen
 * rusak berasap. Kondisi yang bisa dipulihkan mendapat tombol reset; MCB trip dipulihkan lewat
 * tuasnya sendiri.
 */
export function ConditionBadge({ id, item }: { id: string; item: CatalogItem }) {
  const condition = useSimStore((state) => state.snapshot.components[id]?.condition);
  const repairComponent = useSimStore((state) => state.repairComponent);
  if (!condition || !isMarked(condition)) return null;
  const Icon = ICON[condition];
  const hint = t.status.conditionHints[condition];

  return (
    <>
      {condition === 'damaged' && (
        <span aria-hidden className="smoke">
          <i />
          <i />
          <i />
        </span>
      )}
      <span
        className="status-badge"
        data-condition={condition}
        data-tone={BADGE_TONE[condition]}
        title={hint}
      >
        <Icon aria-hidden size={14} />
        {t.status.conditions[condition]}
        <span className="sr-only">{hint}</span>
      </span>
      {isRepairable(condition) && (
        <button
          type="button"
          aria-label={t.status.repair[condition](item.name)}
          title={t.status.repair[condition](item.name)}
          onClick={() => repairComponent(id)}
          className="repair-button nodrag nopan"
        >
          <Wrench aria-hidden size={20} />
        </button>
      )}
    </>
  );
}
