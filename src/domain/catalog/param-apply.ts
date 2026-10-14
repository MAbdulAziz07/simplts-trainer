// Menerapkan dan memeriksa ubahan parameter komponen (spesifikasi di ./params.ts).
import type { CatalogItem } from '../types';
import { PARAM_SPECS, type ComponentParams, type ParamSpec } from './params';

/** Batas atas ubahan = faktor ini × nilai default. [PERLU VERIFIKASI] */
export const PARAM_MAX_FACTOR = 10;

export const PARAM_ISSUE_CODES = [
  'unknown',
  'fixed',
  'not-number',
  'not-option',
  'not-positive',
  'too-large',
  'pv-vmp-above-voc',
  'pv-imp-above-isc',
  'load-max-below-min',
] as const;
export type ParamIssueCode = (typeof PARAM_ISSUE_CODES)[number];

export interface ParamIssue {
  key: string;
  code: ParamIssueCode;
}

export type ParamValue = number | string | readonly number[];

type Section = Record<string, unknown>;

const sectionsOf = (item: CatalogItem): Section[] => [
  item.electrical as unknown as Section,
  item.protection as unknown as Section,
];

const isParamValue = (value: unknown): value is ParamValue =>
  typeof value === 'number' || typeof value === 'string' || Array.isArray(value);

/** Nilai parameter pada item (default bila item dari katalog); `undefined` bila field tidak ada. */
export function paramValue(item: CatalogItem, spec: ParamSpec): ParamValue | undefined {
  for (const section of sectionsOf(item)) {
    const value = section[spec.field];
    if (isParamValue(value)) return value;
  }
  return undefined;
}

/** Parameter yang ada pada item; field opsional yang tidak dimiliki item dilewati. */
export function paramSpecsOf(item: CatalogItem): ParamSpec[] {
  return PARAM_SPECS[item.category].filter((spec) => paramValue(item, spec) !== undefined);
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Aturan keterkaitan agar model fisika tetap konsisten. [PERLU VERIFIKASI] */
function linkFields(item: CatalogItem, params: ComponentParams, electrical: Section): void {
  if (item.category === 'pv-module') {
    const base = item.electrical;
    const vmpV = electrical.vmpV as number;
    if ('pmax' in params) {
      // Model PV memakai Vmp/Imp/Voc/Isc: Pmax baru menskala Imp, dan Isc bila tidak diatur.
      const impA = (electrical.pmaxW as number) / vmpV;
      if (!('isc' in params)) electrical.iscA = round2((base.iscA * impA) / base.impA);
      electrical.impA = impA;
    } else if ('vmp' in params) {
      electrical.pmaxW = round2(vmpV * (electrical.impA as number));
    }
  }
  if (item.category === 'load-dc' || item.category === 'load-ac') {
    if ('maxPower' in params || 'nominalV' in params)
      electrical.resistanceAtMaxOhm =
        (electrical.ratedVoltageV as number) ** 2 / (electrical.maxPowerW as number);
  }
}

/** Item dengan ubahan diterapkan; tanpa ubahan item yang sama dikembalikan. */
export function applyParams(item: CatalogItem, params: ComponentParams | undefined): CatalogItem {
  if (!params || Object.keys(params).length === 0) return item;
  const [electrical, protection] = sectionsOf(item).map((section) => ({ ...section })) as [
    Section,
    Section,
  ];
  for (const spec of PARAM_SPECS[item.category]) {
    const value = params[spec.key];
    if (value === undefined || spec.kind === 'fixed') continue;
    for (const section of [electrical, protection])
      if (spec.field in section) section[spec.field] = value;
  }
  linkFields(item, params, electrical);
  return { ...item, electrical, protection } as unknown as CatalogItem;
}

function valueIssue(
  item: CatalogItem,
  key: string,
  value: number | string,
): ParamIssueCode | undefined {
  const spec = PARAM_SPECS[item.category].find((candidate) => candidate.key === key);
  const fallback = spec && paramValue(item, spec);
  if (!spec || fallback === undefined) return 'unknown';
  if (spec.kind === 'fixed') return 'fixed';
  if (spec.kind === 'choice')
    return spec.options.includes(String(value)) ? undefined : 'not-option';
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'not-number';
  if (value <= 0) return 'not-positive';
  if (typeof fallback === 'number' && value > fallback * PARAM_MAX_FACTOR) return 'too-large';
  return undefined;
}

/** Ketidaksesuaian antarparameter setelah ubahan diterapkan. */
function consistencyIssues(item: CatalogItem, params: ComponentParams): ParamIssue[] {
  const applied = applyParams(item, params);
  const pick = (...keys: string[]) => keys.find((key) => key in params) ?? keys[0] ?? '';
  if (applied.category === 'pv-module') {
    const { vmpV, vocV, impA, iscA } = applied.electrical;
    const issues: ParamIssue[] = [];
    if (vmpV >= vocV) issues.push({ key: pick('vmp', 'voc'), code: 'pv-vmp-above-voc' });
    if (impA >= iscA) issues.push({ key: pick('isc', 'pmax'), code: 'pv-imp-above-isc' });
    return issues;
  }
  if (applied.category === 'load-dc' || applied.category === 'load-ac') {
    const { maxPowerW, minPowerW } = applied.electrical;
    if (maxPowerW < minPowerW) return [{ key: 'maxPower', code: 'load-max-below-min' }];
  }
  return [];
}

/** Masalah pada ubahan untuk item katalog `item`; kosong = sah. */
export function paramIssues(item: CatalogItem, params: ComponentParams): ParamIssue[] {
  const issues = Object.entries(params).flatMap(([key, value]) => {
    const code = valueIssue(item, key, value);
    return code ? [{ key, code }] : [];
  });
  return issues.length > 0 ? issues : consistencyIssues(item, params);
}

/** Ubahan tanpa nilai yang sama dengan default; `undefined` bila tidak ada yang tersisa. */
export function normalizeParams(
  item: CatalogItem,
  params: ComponentParams,
): ComponentParams | undefined {
  const kept = Object.entries(params).filter(([key, value]) => {
    const spec = PARAM_SPECS[item.category].find((candidate) => candidate.key === key);
    return !spec || paramValue(item, spec) !== value;
  });
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}
