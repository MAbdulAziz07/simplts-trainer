// Tipe katalog komponen; arti setiap field ada di docs/KATALOG.md.
// Skema zod yang memvalidasi berkas JSON terhadap tipe ini: src/data/catalog/schema.ts.
import type * as balance from './catalog/balance';
import type * as inverters from './catalog/inverters';
import type * as protection from './catalog/protection';
import type { NoProtection } from './catalog/shared';
import type * as sources from './catalog/sources';
import type * as storage from './catalog/storage';

export const CATALOG_SCHEMA_VERSION = 1;

export const COMPONENT_CATEGORIES = [
  'pv-module',
  'scc-pwm',
  'scc-mppt',
  'battery',
  'bms',
  'inverter-offgrid',
  'inverter-gridtie',
  'inverter-hybrid',
  'mcb-dc',
  'mcb-ac',
  'fuse',
  'spd',
  'combiner',
  'cable',
  'kwh-meter',
  'busbar',
  'grounding',
  'load-panel',
  'load-dc',
  'load-ac',
  'grid',
] as const;
export type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number];

/** Paket alat: Minimum, Rekomendasi, Terbaik. */
export const PACKAGE_IDS = ['min', 'rek', 'best'] as const;
export type PackageId = (typeof PACKAGE_IDS)[number];

export const TERMINAL_KINDS = ['pv+', 'pv-', 'dc+', 'dc-', 'acL', 'acN', 'pe', 'data'] as const;
export type TerminalKind = (typeof TERMINAL_KINDS)[number];

export interface Terminal {
  id: string;
  label: string;
  kind: TerminalKind;
  /** Posisi pusat terminal terhadap gambar, 0–100. */
  xPct: number;
  yPct: number;
  maxWires: number;
}

export const DATASHEET_COVERAGES = ['full', 'partial', 'generic'] as const;
export type DatasheetCoverage = (typeof DATASHEET_COVERAGES)[number];

export interface Datasheet {
  source: string;
  coverage: DatasheetCoverage;
  /** Jalur field yang tidak berasal dari datasheet, mis. `electrical.vocV`. */
  verify: string[];
}

export interface CatalogItemBase<C extends ComponentCategory, E, P> {
  id: string;
  category: C;
  name: string;
  packages: PackageId[];
  electrical: E;
  terminals: Terminal[];
  protection: P;
  image: string;
  datasheet: Datasheet;
  notes?: string;
}

type Item<C extends ComponentCategory, E, P = NoProtection> = CatalogItemBase<C, E, P>;

export type PvModuleItem = Item<
  'pv-module',
  sources.PvModuleElectrical,
  sources.PvModuleProtection
>;
export type SccPwmItem = Item<'scc-pwm', sources.SccPwmElectrical, sources.SccPwmProtection>;
export type SccMpptItem = Item<'scc-mppt', sources.SccMpptElectrical, sources.SccMpptProtection>;
export type BatteryItem = Item<'battery', storage.BatteryElectrical, storage.BatteryProtection>;
export type BmsItem = Item<'bms', storage.BmsElectrical, storage.BmsProtection>;
export type InverterOffgridItem = Item<
  'inverter-offgrid',
  inverters.InverterOffgridElectrical,
  inverters.InverterOffgridProtection
>;
export type InverterGridtieItem = Item<
  'inverter-gridtie',
  inverters.InverterGridtieElectrical,
  inverters.InverterGridtieProtection
>;
export type InverterHybridItem = Item<
  'inverter-hybrid',
  inverters.InverterHybridElectrical,
  inverters.InverterHybridProtection
>;
export type McbDcItem = Item<'mcb-dc', protection.McbDcElectrical, protection.McbDcProtection>;
export type McbAcItem = Item<'mcb-ac', protection.McbAcElectrical, protection.McbAcProtection>;
export type FuseItem = Item<'fuse', protection.FuseElectrical, protection.FuseProtection>;
export type SpdItem = Item<'spd', protection.SpdElectrical, protection.SpdProtection>;
export type CombinerItem = Item<
  'combiner',
  protection.CombinerElectrical,
  protection.CombinerProtection
>;
export type CableItem = Item<'cable', balance.CableElectrical, balance.CableProtection>;
export type KwhMeterItem = Item<
  'kwh-meter',
  balance.KwhMeterElectrical,
  balance.KwhMeterProtection
>;
export type BusbarItem = Item<'busbar', balance.BusbarElectrical, balance.BusbarProtection>;
export type GroundingItem = Item<'grounding', balance.GroundingElectrical>;
export type LoadPanelItem = Item<
  'load-panel',
  balance.LoadPanelElectrical,
  balance.LoadPanelProtection
>;
export type LoadDcItem = Item<'load-dc', balance.LoadElectrical>;
export type LoadAcItem = Item<'load-ac', balance.LoadElectrical>;
export type GridItem = Item<'grid', balance.GridElectrical>;

export type CatalogItem =
  | PvModuleItem
  | SccPwmItem
  | SccMpptItem
  | BatteryItem
  | BmsItem
  | InverterOffgridItem
  | InverterGridtieItem
  | InverterHybridItem
  | McbDcItem
  | McbAcItem
  | FuseItem
  | SpdItem
  | CombinerItem
  | CableItem
  | KwhMeterItem
  | BusbarItem
  | GroundingItem
  | LoadPanelItem
  | LoadDcItem
  | LoadAcItem
  | GridItem;

/** Item katalog untuk satu kategori, mis. `CatalogItemOf<'battery'>`. */
export type CatalogItemOf<C extends ComponentCategory> = Extract<CatalogItem, { category: C }>;

export interface CatalogFile {
  schemaVersion: typeof CATALOG_SCHEMA_VERSION;
  file: string;
  items: CatalogItem[];
}
