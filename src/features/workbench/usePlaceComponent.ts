import { useReactFlow } from '@xyflow/react';
import { useCallback } from 'react';
import { findCatalogItem, useCircuitStore, type CircuitDoc } from '@/store';
import { itemSizePx } from '@/ui';
import { snapToGridPx } from './flow-types';
import { rotatedSizePx } from './nodes/geometry';
import { findFreeSpot, type BoxPx } from './placement';

export interface ClientPoint {
  x: number;
  y: number;
}

/** Penanda elemen meja kerja; dipakai untuk mengetahui apakah sebuah titik layar ada di meja. */
export const WORKBENCH_ATTRIBUTE = 'data-workbench';

function occupiedBoxes(doc: CircuitDoc): BoxPx[] {
  return doc.components.flatMap((part) => {
    const item = findCatalogItem(part.catalogId);
    if (!item) return [];
    return [{ xPx: part.xPx, yPx: part.yPx, ...rotatedSizePx(itemSizePx(item), part.rotationDeg) }];
  });
}

/**
 * Menaruh komponen katalog di meja kerja dengan pusatnya di titik layar yang diberikan, atau di
 * tengah meja bila tanpa titik. Mengembalikan `false` bila titiknya di luar meja.
 */
export function usePlaceComponent() {
  const { screenToFlowPosition } = useReactFlow();

  return useCallback(
    (catalogId: string, at?: ClientPoint): boolean => {
      const item = findCatalogItem(catalogId);
      const bench = document.querySelector(`[${WORKBENCH_ATTRIBUTE}]`)?.getBoundingClientRect();
      if (!item || !bench) return false;
      const inside =
        !at ||
        (at.x >= bench.left && at.x <= bench.right && at.y >= bench.top && at.y <= bench.bottom);
      if (!inside) return false;

      const center = screenToFlowPosition(
        at ?? { x: bench.left + bench.width / 2, y: bench.top + bench.height / 2 },
        { snapToGrid: false },
      );
      const size = itemSizePx(item);
      const wanted = {
        ...size,
        xPx: snapToGridPx(center.x - size.widthPx / 2),
        yPx: snapToGridPx(center.y - size.heightPx / 2),
      };
      const { doc, addComponent } = useCircuitStore.getState();
      // Diseret: tepat di tempat dilepas. Diketuk: di tempat kosong terdekat dari tengah meja.
      const spot = at ? wanted : findFreeSpot(wanted, occupiedBoxes(doc));
      return addComponent(catalogId, { xPx: spot.xPx, yPx: spot.yPx }) !== undefined;
    },
    [screenToFlowPosition],
  );
}
