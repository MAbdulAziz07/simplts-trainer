// Memeriksa berkas proyek: bentuk (zod), versi format, lalu rujukan ke katalog dan antarbagian.
import type { CatalogItem } from '@/domain';
import {
  PROJECT_APP_ID,
  PROJECT_FORMAT_VERSION,
  projectFileSchema,
  type ProjectFile,
} from './schema';

/** `not-project`: bukan berkas SimPLTS; `unsupported-version`: versi format lain. */
export type ProjectRejection = 'not-project' | 'unsupported-version' | 'invalid';

export interface ProjectValidation {
  /** Hanya ada bila berkas sah. */
  project?: ProjectFile;
  rejection?: ProjectRejection;
  /** Satu baris per masalah: `jalur: pesan`. */
  issues: string[];
}

const duplicates = (values: string[]): string[] => [
  ...new Set(values.filter((value, i) => values.indexOf(value) !== i)),
];

function referenceIssues(project: ProjectFile, catalog: readonly CatalogItem[]): string[] {
  const issues: string[] = [];
  const itemById = new Map(catalog.map((item) => [item.id, item]));
  const terminalsByComponent = new Map<string, Set<string>>();

  for (const id of duplicates(project.components.map((component) => component.id)))
    issues.push(`components.${id}: id dipakai lebih dari sekali`);
  for (const id of duplicates(project.wires.map((wire) => wire.id)))
    issues.push(`wires.${id}: id dipakai lebih dari sekali`);

  for (const component of project.components) {
    const item = itemById.get(component.catalogId);
    if (!item || item.category === 'cable')
      issues.push(`components.${component.id}: "${component.catalogId}" bukan komponen katalog`);
    terminalsByComponent.set(component.id, new Set(item?.terminals.map((terminal) => terminal.id)));
    const isLoad = item?.category === 'load-dc' || item?.category === 'load-ac';
    if (component.powerSettingW !== undefined && !isLoad)
      issues.push(`components.${component.id}: powerSettingW hanya untuk beban`);
  }

  for (const wire of project.wires) {
    for (const ref of [wire.from, wire.to])
      if (!terminalsByComponent.get(ref.componentId)?.has(ref.terminalId))
        issues.push(`wires.${wire.id}: terminal ${ref.componentId}.${ref.terminalId} tidak ada`);
    if (itemById.get(wire.cableId)?.category !== 'cable')
      issues.push(`wires.${wire.id}: "${wire.cableId}" bukan kabel katalog`);
  }

  for (const id of project.closedSwitchIds)
    if (!terminalsByComponent.has(id)) issues.push(`closedSwitchIds: komponen ${id} tidak ada`);
  return issues;
}

/** @param raw hasil `JSON.parse` sebuah berkas proyek atau preset. */
export function validateProject(raw: unknown, catalog: readonly CatalogItem[]): ProjectValidation {
  const header = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  if (header.app !== PROJECT_APP_ID)
    return { rejection: 'not-project', issues: ['app: bukan berkas proyek SimPLTS'] };
  if (header.formatVersion !== PROJECT_FORMAT_VERSION)
    return {
      rejection: 'unsupported-version',
      issues: [
        `formatVersion: ${String(header.formatVersion)}, didukung ${PROJECT_FORMAT_VERSION}`,
      ],
    };

  const result = projectFileSchema.safeParse(raw);
  if (!result.success)
    return {
      rejection: 'invalid',
      issues: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    };

  const issues = referenceIssues(result.data, catalog);
  return issues.length > 0 ? { rejection: 'invalid', issues } : { project: result.data, issues };
}
