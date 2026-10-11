// Dokumen meja kerja ↔ berkas proyek, dan simpan otomatis ke penyimpanan lokal browser.
import {
  CONNECTION_LEVELS,
  type CatalogItem,
  type ConnectionLevel,
  type PackageId,
} from '@/domain';
import {
  PROJECT_APP_ID,
  PROJECT_FILE_EXTENSION,
  PROJECT_FORMAT_VERSION,
  validateProject,
  type ProjectFile,
  type ProjectValidation,
} from '@/data';
import type { CircuitDoc } from './circuit-doc';

export const AUTOSAVE_KEY = 'simplts.autosave.v1';

export function docToProject(doc: CircuitDoc, packageId: PackageId): ProjectFile {
  return {
    app: PROJECT_APP_ID,
    formatVersion: PROJECT_FORMAT_VERSION,
    packageId,
    components: doc.components,
    wires: doc.wires,
    closedSwitchIds: doc.closedSwitchIds,
  };
}

export function projectToDoc(project: ProjectFile): CircuitDoc {
  return {
    components: project.components,
    wires: project.wires,
    closedSwitchIds: project.closedSwitchIds,
  };
}

/** Isi berkas `.json` yang diunduh pengguna. */
export function serializeProject(doc: CircuitDoc, packageId: PackageId): string {
  return `${JSON.stringify(docToProject(doc, packageId), null, 2)}\n`;
}

/** Nama berkas unduhan, mis. `rangkaian-min-20261011-2130.simplts.json` (waktu setempat). */
export function projectFileName(packageId: PackageId, savedAt: Date): string {
  const two = (value: number): string => String(value).padStart(2, '0');
  const date = `${savedAt.getFullYear()}${two(savedAt.getMonth() + 1)}${two(savedAt.getDate())}`;
  const time = `${two(savedAt.getHours())}${two(savedAt.getMinutes())}`;
  return `rangkaian-${packageId}-${date}-${time}${PROJECT_FILE_EXTENSION}`;
}

/** Membaca teks berkas proyek; JSON rusak dilaporkan sebagai bukan proyek. */
export function parseProjectText(text: string, catalog: readonly CatalogItem[]): ProjectValidation {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { rejection: 'not-project', issues: ['berkas bukan JSON'] };
  }
  return validateProject(raw, catalog);
}

export interface Autosave {
  project: ProjectFile;
  level: ConnectionLevel;
}

type AutosaveStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Penyimpanan lokal browser; `undefined` di luar browser atau bila diblokir. */
export function browserStorage(): AutosaveStorage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function writeAutosave(storage: AutosaveStorage | undefined, autosave: Autosave): void {
  try {
    storage?.setItem(AUTOSAVE_KEY, JSON.stringify(autosave));
  } catch {
    // Penyimpanan penuh atau diblokir: pekerjaan tetap ada di memori dan bisa disimpan ke berkas.
  }
}

/** Simpanan terakhir; `undefined` bila tidak ada atau tidak lagi sah terhadap katalog. */
export function readAutosave(
  storage: AutosaveStorage | undefined,
  catalog: readonly CatalogItem[],
): Autosave | undefined {
  try {
    const raw: unknown = JSON.parse(storage?.getItem(AUTOSAVE_KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null) return undefined;
    const { project: rawProject, level } = raw as Record<string, unknown>;
    const { project } = validateProject(rawProject, catalog);
    if (!project) return undefined;
    const isLevel = CONNECTION_LEVELS.includes(level as ConnectionLevel);
    return { project, level: isLevel ? (level as ConnectionLevel) : 'beginner' };
  } catch {
    return undefined;
  }
}
