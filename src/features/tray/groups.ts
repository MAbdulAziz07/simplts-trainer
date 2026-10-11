// Kelompok kategori di baki, urut mengikuti aliran daya: sumber → pengatur → ... → beban.
import {
  Activity,
  BatteryFull,
  Lightbulb,
  Network,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import type { CatalogItem, ComponentCategory, PackageId } from '@/domain';
import type { t } from '@/i18n';

export type TrayGroupId = keyof typeof t.tray.groups;

interface TrayGroupSpec {
  id: TrayGroupId;
  icon: LucideIcon;
  categories: readonly ComponentCategory[];
}

// Kabel tidak ada di baki: kabel ditarik dari terminal ke terminal.
export const TRAY_GROUPS: readonly TrayGroupSpec[] = [
  { id: 'source', icon: Sun, categories: ['pv-module'] },
  { id: 'control', icon: SlidersHorizontal, categories: ['scc-pwm', 'scc-mppt'] },
  { id: 'storage', icon: BatteryFull, categories: ['battery', 'bms'] },
  {
    id: 'inverter',
    icon: Activity,
    categories: ['inverter-offgrid', 'inverter-gridtie', 'inverter-hybrid'],
  },
  {
    id: 'protection',
    icon: ShieldCheck,
    categories: ['mcb-dc', 'mcb-ac', 'fuse', 'spd', 'combiner'],
  },
  {
    id: 'distribution',
    icon: Network,
    categories: ['busbar', 'grounding', 'load-panel', 'kwh-meter', 'grid'],
  },
  { id: 'load', icon: Lightbulb, categories: ['load-dc', 'load-ac'] },
];

export interface TrayGroup extends TrayGroupSpec {
  items: CatalogItem[];
}

/** Isi baki untuk satu paket; kelompok tanpa item tidak disertakan (docs/UX.md §1 butir 7). */
export function trayGroups(catalog: readonly CatalogItem[], packageId: PackageId): TrayGroup[] {
  return TRAY_GROUPS.map((group) => ({
    ...group,
    items: group.categories.flatMap((category) =>
      catalog.filter((item) => item.category === category && item.packages.includes(packageId)),
    ),
  })).filter((group) => group.items.length > 0);
}
