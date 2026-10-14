// Skenario bawaan: setiap berkas ./<id>.json di folder ini (docs/SKENARIO.md).
import type { CatalogItem } from '@/domain';
import type { LoadedScenario } from './schema';
import { validateScenario } from './validate';

export * from './schema';
export * from './validate';

const modules = import.meta.glob<unknown>('./*.json', { eager: true, import: 'default' });

/** Isi mentah berkas skenario, dengan kunci nama berkas tanpa `.json`. */
export const rawScenarioFiles: Record<string, unknown> = Object.fromEntries(
  Object.entries(modules).map(([path, content]) => [
    path.replace(/^\.\//, '').replace(/\.json$/, ''),
    content,
  ]),
);

const MODE_ORDER = ['guided', 'troubleshoot', 'assessment'];

/**
 * Memuat dan memvalidasi semua skenario bawaan, urut mode lalu judul. Melempar galat bila ada
 * berkas yang tidak sah atau nama berkasnya tidak sama dengan `id`.
 */
export function loadScenarios(catalog: readonly CatalogItem[]): LoadedScenario[] {
  return Object.entries(rawScenarioFiles)
    .map(([fileName, raw]) => {
      const { scenario, issues } = validateScenario(raw, catalog);
      if (!scenario) throw new Error(`Skenario ${fileName} tidak sah:\n${issues.join('\n')}`);
      if (scenario.id !== fileName)
        throw new Error(`Skenario ${fileName}: id "${scenario.id}" harus sama dengan nama berkas`);
      return scenario;
    })
    .sort(
      (a, b) =>
        MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode) || a.title.localeCompare(b.title),
    );
}
