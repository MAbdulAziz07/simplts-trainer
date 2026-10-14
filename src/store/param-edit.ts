// Ubahan parameter komponen sebagai fungsi murni atas dokumen rangkaian (spesifikasi: PARAM_SPECS).
import { loadSnapPowerW, normalizeParams, paramIssues, type ParamIssue } from '@/domain';
import { effectiveItem, findCatalogItem } from './catalog';
import { setPartParams, setPartPower, type CircuitDoc } from './circuit-doc';

/**
 * Dokumen dengan satu parameter diubah; nilai sama dengan katalog menghapus ubahannya. Bila
 * ubahan tidak sah, dokumen yang sama dan masalahnya dikembalikan.
 */
export function withParam(
  doc: CircuitDoc,
  componentId: string,
  key: string,
  value: number | string,
): { doc: CircuitDoc; issues: ParamIssue[] } {
  const part = doc.components.find((candidate) => candidate.id === componentId);
  const item = part && findCatalogItem(part.catalogId);
  if (!part || !item) return { doc, issues: [] };
  const params = { ...part.params, [key]: value };
  const issues = paramIssues(item, params);
  if (issues.length > 0) return { doc, issues };
  return {
    doc: clampLoadPower(
      setPartParams(doc, componentId, normalizeParams(item, params)),
      componentId,
    ),
    issues: [],
  };
}

/** Kembali ke nilai katalog: satu parameter, atau semua bila `key` tidak diberikan. */
export function withoutParam(doc: CircuitDoc, componentId: string, key?: string): CircuitDoc {
  const part = doc.components.find((candidate) => candidate.id === componentId);
  const item = part && findCatalogItem(part.catalogId);
  if (!part?.params || !item) return doc;
  const rest = Object.fromEntries(Object.entries(part.params).filter(([name]) => name !== key));
  const next = setPartParams(
    doc,
    componentId,
    key === undefined ? undefined : normalizeParams(item, rest),
  );
  return clampLoadPower(next, componentId);
}

/** Setelan daya beban tetap di dalam rentang daya setelah parameternya berubah. */
function clampLoadPower(doc: CircuitDoc, componentId: string): CircuitDoc {
  const part = doc.components.find((candidate) => candidate.id === componentId);
  const item = part && effectiveItem(part);
  if (part?.powerSettingW === undefined) return doc;
  if (item?.category !== 'load-dc' && item?.category !== 'load-ac') return doc;
  return setPartPower(doc, componentId, loadSnapPowerW(item.electrical, part.powerSettingW));
}
