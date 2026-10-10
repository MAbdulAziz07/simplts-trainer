// Skema zod katalog komponen, sesuai docs/KATALOG.md. Tipe hasilnya: src/domain/types.ts.
import { z } from 'zod';
import {
  CATALOG_SCHEMA_VERSION,
  type CatalogFile,
  type CatalogItem,
  type ComponentCategory,
} from '@/domain';
import * as balance from './schema/balance';
import * as inverters from './schema/inverters';
import * as protection from './schema/protection';
import * as sources from './schema/sources';
import * as storage from './schema/storage';

export const VERIFY_MARK = '[PERLU VERIFIKASI]';

/** Kategori yang boleh ada di tiap berkas (KATALOG §1). */
export const CATALOG_FILE_CATEGORIES = {
  'pv-modules': ['pv-module'],
  'charge-controllers': ['scc-pwm', 'scc-mppt'],
  batteries: ['battery'],
  bms: ['bms'],
  inverters: ['inverter-offgrid', 'inverter-gridtie', 'inverter-hybrid'],
  'protection-mcb': ['mcb-dc', 'mcb-ac'],
  'protection-other': ['fuse', 'spd', 'combiner'],
  cables: ['cable'],
  meters: ['kwh-meter'],
  distribution: ['busbar', 'grounding', 'load-panel'],
  loads: ['load-dc', 'load-ac'],
  grid: ['grid'],
} as const satisfies Record<string, readonly ComponentCategory[]>;

export type CatalogFileName = keyof typeof CATALOG_FILE_CATEGORIES;

const hasPath = (root: unknown, path: string): boolean => {
  let node = root;
  for (const key of path.split('.')) {
    if (typeof node !== 'object' || node === null || !Object.hasOwn(node, key)) return false;
    node = (node as Record<string, unknown>)[key];
  }
  return true;
};

const duplicates = (values: string[]): string[] => [
  ...new Set(values.filter((value, i) => values.indexOf(value) !== i)),
];

const itemUnion = z.discriminatedUnion('category', [
  sources.pvModuleSchema,
  sources.sccPwmSchema,
  sources.sccMpptSchema,
  storage.batterySchema,
  storage.bmsSchema,
  inverters.inverterOffgridSchema,
  inverters.inverterGridtieSchema,
  inverters.inverterHybridSchema,
  protection.mcbDcSchema,
  protection.mcbAcSchema,
  protection.fuseSchema,
  protection.spdSchema,
  protection.combinerSchema,
  balance.cableSchema,
  balance.kwhMeterSchema,
  balance.busbarSchema,
  balance.groundingSchema,
  balance.loadPanelSchema,
  balance.loadDcSchema,
  balance.loadAcSchema,
  balance.gridSchema,
]);

/** Tipe hasil skema sebelum dicocokkan ke tipe domain; dipakai uji kesetaraan tipe. */
export type ParsedCatalogItem = z.output<typeof itemUnion>;

// Aturan lintas-field satu item (KATALOG §3, §5, dan §6).
export const catalogItemSchema: z.ZodType<CatalogItem> = itemUnion.check((ctx) => {
  const item = ctx.value;
  const issue = (path: PropertyKey[], message: string) =>
    ctx.issues.push({ code: 'custom', input: item, path, message });

  for (const id of duplicates(item.packages)) issue(['packages'], `Paket ganda: ${id}`);
  for (const id of duplicates(item.terminals.map((terminal) => terminal.id)))
    issue(['terminals'], `Id terminal ganda: ${id}`);

  // Kabel menyambung terminal, bukan diseret ke meja.
  if (item.category === 'cable' && item.terminals.length > 0)
    issue(['terminals'], 'Kabel tidak punya terminal');
  if (item.category !== 'cable' && item.terminals.length === 0)
    issue(['terminals'], 'Komponen meja kerja wajib punya terminal');

  // Field bernama sama di `protection` adalah salinan rating `electrical` (KATALOG §6).
  const electrical: Record<string, unknown> = item.electrical;
  for (const [key, value] of Object.entries(item.protection))
    if (Object.hasOwn(electrical, key) && JSON.stringify(value) !== JSON.stringify(electrical[key]))
      issue(['protection', key], `Harus sama dengan electrical.${key}`);
  if (item.category === 'scc-mppt' && item.protection.vocMaxV !== item.electrical.pvVocMaxV)
    issue(['protection', 'vocMaxV'], 'Harus sama dengan electrical.pvVocMaxV');
  if (item.category === 'inverter-gridtie' && item.electrical.mpptMaxV > item.protection.dcVocMaxV)
    issue(['electrical', 'mpptMaxV'], 'Tidak boleh melampaui protection.dcVocMaxV');

  const { coverage, verify } = item.datasheet;
  for (const path of verify)
    if (!hasPath(item, path)) issue(['datasheet', 'verify'], `Jalur tidak ada di item: ${path}`);
  for (const path of duplicates(verify)) issue(['datasheet', 'verify'], `Jalur ganda: ${path}`);

  if (coverage === 'full' && verify.length > 0)
    issue(['datasheet', 'verify'], 'coverage "full" tidak boleh punya isi verify');
  if (coverage === 'generic') {
    const all = (['electrical', 'protection'] as const).flatMap((section) =>
      Object.keys(item[section]).map((key) => `${section}.${key}`),
    );
    for (const path of all)
      if (!verify.includes(path))
        issue(['datasheet', 'verify'], `Item generik wajib memuat ${path}`);
  }
  if ((coverage !== 'full' || verify.length > 0) && !item.notes?.includes(VERIFY_MARK))
    issue(['notes'], `notes wajib memuat ${VERIFY_MARK}`);
});

const fileNames = Object.keys(CATALOG_FILE_CATEGORIES) as [CatalogFileName, ...CatalogFileName[]];

export const catalogFileSchema: z.ZodType<CatalogFile> = z
  .strictObject({
    schemaVersion: z.literal(CATALOG_SCHEMA_VERSION),
    file: z.enum(fileNames),
    items: z.array(catalogItemSchema).min(1),
  })
  .check((ctx) => {
    const allowed: readonly ComponentCategory[] = CATALOG_FILE_CATEGORIES[ctx.value.file];
    ctx.value.items.forEach((item, i) => {
      if (!allowed.includes(item.category))
        ctx.issues.push({
          code: 'custom',
          input: item.category,
          path: ['items', i, 'category'],
          message: `Kategori ${item.category} tidak termasuk berkas ${ctx.value.file}`,
        });
    });
  });
