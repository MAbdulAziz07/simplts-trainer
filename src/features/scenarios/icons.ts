// Ikon lucide untuk langkah, jenis gangguan, dan mode skenario.
import {
  BatteryFull,
  BatteryWarning,
  Cable,
  CircleCheck,
  ClipboardCheck,
  Clock,
  CloudSun,
  Gauge,
  Lightbulb,
  ListChecks,
  Plug,
  PlugZap,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  ToggleLeft,
  ToggleRight,
  Unplug,
  UtilityPole,
  Wrench,
  Zap,
  ZapOff,
  type LucideIcon,
} from 'lucide-react';
import type { FaultKind, ScenarioMode, StepIcon } from '@/domain';

export const STEP_ICON: Record<StepIcon, LucideIcon> = {
  cable: Cable,
  plug: Plug,
  battery: BatteryFull,
  sun: Sun,
  gauge: Gauge,
  toggle: ToggleRight,
  lightbulb: Lightbulb,
  search: Search,
  shield: ShieldCheck,
  clock: Clock,
  wrench: Wrench,
  zap: Zap,
  check: CircleCheck,
};

export const FAULT_ICON: Record<FaultKind, LucideIcon> = {
  'wire-open': Unplug,
  'fuse-blown': ZapOff,
  'mc4-loose': PlugZap,
  'pv-shaded': CloudSun,
  'battery-weak-cell': BatteryWarning,
  'scc-setting-wrong': SlidersHorizontal,
  'mcb-wrong-rating': ToggleLeft,
  'grid-outage': UtilityPole,
};

export const MODE_ICON: Record<ScenarioMode, LucideIcon> = {
  guided: ListChecks,
  troubleshoot: Search,
  assessment: ClipboardCheck,
};
