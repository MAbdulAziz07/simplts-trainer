// Memeriksa berkas skenario: bentuk (zod), lalu rujukan ke katalog, rangkaian awal, dan gangguan.
import { FAULT_TARGETS, type CatalogItem, type ScenarioRule } from '@/domain';
import { validateProject } from '../project';
import { scenarioFileSchema, type LoadedScenario, type ScenarioFile } from './schema';

export interface ScenarioValidation {
  /** Hanya ada bila berkas sah. */
  scenario?: LoadedScenario;
  /** Satu baris per masalah: `jalur: pesan`. */
  issues: string[];
}

function rulesOf(rule: ScenarioRule): ScenarioRule[] {
  return rule.kind === 'all' || rule.kind === 'any'
    ? [rule, ...rule.rules.flatMap(rulesOf)]
    : [rule];
}

function referenceIssues(file: ScenarioFile, catalog: readonly CatalogItem[]): string[] {
  const issues: string[] = [];
  const stepIds = file.steps.map((step) => step.id);
  for (const id of new Set(stepIds.filter((id, i) => stepIds.indexOf(id) !== i)))
    issues.push(`steps.${id}: id dipakai lebih dari sekali`);

  const usesFaultFound = file.steps.some((step) =>
    rulesOf(step.done).some((rule) => rule.kind === 'fault-found'),
  );
  if (usesFaultFound && file.mode !== 'troubleshoot')
    issues.push('steps: aturan fault-found hanya untuk mode troubleshoot');

  const circuit = file.initialCircuit;
  if (!circuit) {
    if (file.mode === 'troubleshoot') issues.push('initialCircuit: wajib untuk mode troubleshoot');
    if (file.faults.length > 0) issues.push('faults: butuh initialCircuit');
    return issues;
  }

  const project = validateProject(circuit, catalog);
  issues.push(...project.issues.map((issue) => `initialCircuit.${issue}`));
  if (circuit.packageId !== file.package)
    issues.push(`initialCircuit.packageId: ${circuit.packageId}, skenario untuk ${file.package}`);

  const itemById = new Map(catalog.map((item) => [item.id, item]));
  file.faults.forEach((fault, index) => {
    const targets = FAULT_TARGETS[fault.kind];
    const path = `faults.${index}`;
    if (targets === 'wire') {
      if (!circuit.wires.some((wire) => wire.id === fault.target))
        issues.push(`${path}: kabel ${fault.target} tidak ada di initialCircuit`);
      return;
    }
    const component = circuit.components.find((candidate) => candidate.id === fault.target);
    const category = component && itemById.get(component.catalogId)?.category;
    if (!category || !targets.includes(category))
      issues.push(`${path}: ${fault.kind} butuh komponen ${targets.join('/')}, ${fault.target}`);
  });
  return issues;
}

/** @param raw hasil `JSON.parse` sebuah berkas skenario. */
export function validateScenario(
  raw: unknown,
  catalog: readonly CatalogItem[],
): ScenarioValidation {
  const result = scenarioFileSchema.safeParse(raw);
  if (!result.success) {
    return {
      issues: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    };
  }
  const issues = referenceIssues(result.data, catalog);
  if (issues.length > 0) return { issues };
  const scenario: LoadedScenario = { ...result.data };
  delete (scenario as Partial<ScenarioFile>).formatVersion;
  return { scenario, issues };
}

/** Teks berkas skenario yang dibuka peserta; JSON rusak menjadi satu masalah. */
export function parseScenarioText(
  text: string,
  catalog: readonly CatalogItem[],
): ScenarioValidation {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { issues: ['berkas: bukan JSON yang sah'] };
  }
  return validateScenario(raw, catalog);
}
