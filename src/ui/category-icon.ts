// Ikon tiap kategori komponen; dipakai kotak pengganti gambar dan judul kategori di baki.
import {
  Activity,
  ArrowDownToLine,
  BatteryFull,
  Cable,
  Combine,
  Cpu,
  Gauge,
  GripHorizontal,
  Lightbulb,
  PanelTop,
  ShieldAlert,
  SlidersHorizontal,
  Sun,
  ToggleRight,
  UtilityPole,
  Zap,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';
import { createElement } from 'react';
import type { ComponentCategory } from '@/domain';

const ICON_BY_CATEGORY: Record<ComponentCategory, LucideIcon> = {
  'pv-module': Sun,
  'scc-pwm': SlidersHorizontal,
  'scc-mppt': SlidersHorizontal,
  battery: BatteryFull,
  bms: Cpu,
  'inverter-offgrid': Activity,
  'inverter-gridtie': Activity,
  'inverter-hybrid': Activity,
  'mcb-dc': ToggleRight,
  'mcb-ac': ToggleRight,
  fuse: Zap,
  spd: ShieldAlert,
  combiner: Combine,
  cable: Cable,
  'kwh-meter': Gauge,
  busbar: GripHorizontal,
  grounding: ArrowDownToLine,
  'load-panel': PanelTop,
  'load-dc': Lightbulb,
  'load-ac': Lightbulb,
  grid: UtilityPole,
};

/** Ikon kategori; menerima props ikon lucide (`size`, `className`, ...). */
export function CategoryIcon({
  category,
  ...props
}: LucideProps & { category: ComponentCategory }) {
  return createElement(ICON_BY_CATEGORY[category], props);
}
