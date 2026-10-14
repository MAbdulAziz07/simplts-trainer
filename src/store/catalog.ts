// Katalog yang sudah tervalidasi, dimuat sekali untuk seluruh aplikasi.
import { applyParams, type CableItem, type CatalogItem, type PlacedComponent } from '@/domain';
import { loadCatalog } from '@/data';
import type { CircuitDoc, PlacedPart } from './circuit-doc';

export const catalogItems: readonly CatalogItem[] = loadCatalog();

const itemById = new Map(catalogItems.map((item) => [item.id, item]));

export function findCatalogItem(catalogId: string): CatalogItem | undefined {
  return itemById.get(catalogId);
}

export const cableItems: readonly CableItem[] = catalogItems.filter(
  (item): item is CableItem => item.category === 'cable',
);

// Kunci = objek `params` yang dipakai ulang saat komponen digeser, jadi item hasil ubahan tetap
// sama selama ubahannya sama.
const appliedByParams = new WeakMap<NonNullable<PlacedPart['params']>, Map<string, CatalogItem>>();

/** Item katalog dengan ubahan parameter komponen diterapkan; tanpa ubahan = item katalog. */
export function effectiveItem(
  part: Pick<PlacedPart, 'catalogId' | 'params'>,
): CatalogItem | undefined {
  const item = findCatalogItem(part.catalogId);
  if (!item || !part.params) return item;
  let byCatalogId = appliedByParams.get(part.params);
  if (!byCatalogId) appliedByParams.set(part.params, (byCatalogId = new Map()));
  let applied = byCatalogId.get(part.catalogId);
  if (!applied) byCatalogId.set(part.catalogId, (applied = applyParams(item, part.params)));
  return applied;
}

const placedByDoc = new WeakMap<CircuitDoc, PlacedComponent[]>();

/** Komponen meja kerja dengan item katalognya, bentuk yang dipakai fungsi domain. */
export function toPlacedComponents(doc: CircuitDoc): PlacedComponent[] {
  let placed = placedByDoc.get(doc);
  if (!placed) {
    placed = doc.components.flatMap((part) => {
      const item = effectiveItem(part);
      return item ? [{ id: part.id, item }] : [];
    });
    placedByDoc.set(doc, placed);
  }
  return placed;
}
