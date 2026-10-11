// Preset tiap paket: komponen sudah tertata di meja, belum dirangkai, semua MCB OFF
// (docs/PRD.md §2: preset menyediakan daftar komponen; peserta tetap merangkai sendiri).
import type { CatalogItem, PackageId } from '@/domain';
import { validateProject, type ProjectFile } from '../project';

const modules = import.meta.glob<unknown>('./*.json', { eager: true, import: 'default' });

/** Isi mentah berkas preset, dengan kunci id paket (`min`, `rek`, `best`). */
export const rawPresetFiles: Record<string, unknown> = Object.fromEntries(
  Object.entries(modules).map(([path, content]) => [
    path.replace(/^\.\//, '').replace(/\.json$/, ''),
    content,
  ]),
);

/** Memuat dan memvalidasi preset satu paket; melempar galat bila berkasnya tidak sah. */
export function loadPreset(packageId: PackageId, catalog: readonly CatalogItem[]): ProjectFile {
  const { project, issues } = validateProject(rawPresetFiles[packageId], catalog);
  if (!project) throw new Error(`Preset ${packageId} tidak sah:\n${issues.join('\n')}`);
  return project;
}
