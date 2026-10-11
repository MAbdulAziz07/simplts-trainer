// Katalog yang sudah tervalidasi, dimuat sekali untuk seluruh aplikasi.
import type { CableItem, CatalogItem, PlacedComponent } from '@/domain';
import { loadCatalog } from '@/data';
import type { CircuitDoc } from './circuit-doc';

export const catalogItems: readonly CatalogItem[] = loadCatalog();

const itemById = new Map(catalogItems.map((item) => [item.id, item]));

export function findCatalogItem(catalogId: string): CatalogItem | undefined {
  return itemById.get(catalogId);
}

export const cableItems: readonly CableItem[] = catalogItems.filter(
  (item): item is CableItem => item.category === 'cable',
);

const placedByDoc = new WeakMap<CircuitDoc, PlacedComponent[]>();

/** Komponen meja kerja dengan item katalognya, bentuk yang dipakai fungsi domain. */
export function toPlacedComponents(doc: CircuitDoc): PlacedComponent[] {
  let placed = placedByDoc.get(doc);
  if (!placed) {
    placed = doc.components.flatMap((part) => {
      const item = findCatalogItem(part.catalogId);
      return item ? [{ id: part.id, item }] : [];
    });
    placedByDoc.set(doc, placed);
  }
  return placed;
}
