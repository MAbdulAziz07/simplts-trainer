import type { CatalogItem } from '@/domain';
import { validateCatalog } from './validate';

export * from './schema';
export * from './validate';

const modules = import.meta.glob<unknown>('./*.json', { eager: true, import: 'default' });

/** Isi mentah semua berkas katalog, dengan kunci nama berkas tanpa `.json`. */
export const rawCatalogFiles: Record<string, unknown> = Object.fromEntries(
  Object.entries(modules).map(([path, content]) => [
    path.replace(/^\.\//, '').replace(/\.json$/, ''),
    content,
  ]),
);

/** Memuat dan memvalidasi katalog; melempar galat bila ada berkas yang tidak sah. */
export function loadCatalog(): CatalogItem[] {
  const { items, issues } = validateCatalog(rawCatalogFiles);
  if (issues.length > 0) throw new Error(`Katalog tidak sah:\n${issues.join('\n')}`);
  return items;
}
