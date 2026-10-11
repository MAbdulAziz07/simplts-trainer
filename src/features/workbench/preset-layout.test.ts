// Ukuran komponen ada di lapisan ui, jadi tata letak preset (src/data) diuji dari lapisan fitur.
import { describe, expect, it } from 'vitest';
import { PACKAGE_IDS } from '@/domain';
import { loadPreset } from '@/data';
import { catalogItems, findCatalogItem } from '@/store';
import { itemSizePx } from '@/ui';
import { GRID_PX } from './flow-types';

/** Ruang untuk nama di atas komponen, jajaran terminal di bawahnya, dan tuas MCB di kanannya. */
const GAP_X_PX = 3 * GRID_PX;
const GAP_Y_PX = 3 * GRID_PX;

describe.each(PACKAGE_IDS)('tata letak preset %s', (packageId) => {
  const boxes = loadPreset(packageId, catalogItems).components.map((part) => ({
    id: part.id,
    xPx: part.xPx,
    yPx: part.yPx,
    ...itemSizePx(findCatalogItem(part.catalogId)!),
  }));

  it('komponen tidak saling menimpa dan berjarak cukup', () => {
    const crowded: string[] = [];
    boxes.forEach((a, index) => {
      for (const b of boxes.slice(index + 1)) {
        const apart =
          a.xPx >= b.xPx + b.widthPx + GAP_X_PX ||
          b.xPx >= a.xPx + a.widthPx + GAP_X_PX ||
          a.yPx >= b.yPx + b.heightPx + GAP_Y_PX ||
          b.yPx >= a.yPx + a.heightPx + GAP_Y_PX;
        if (!apart) crowded.push(`${a.id} ↔ ${b.id}`);
      }
    });
    expect(crowded).toEqual([]);
  });
});
