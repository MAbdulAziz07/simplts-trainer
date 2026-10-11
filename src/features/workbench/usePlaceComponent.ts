import { useReactFlow } from '@xyflow/react';
import { useCallback } from 'react';
import { findCatalogItem, useCircuitStore } from '@/store';
import { itemSizePx } from '@/ui';
import { GRID_PX, snapToGridPx } from './flow-types';

export interface ClientPoint {
  x: number;
  y: number;
}

/** Penanda elemen meja kerja; dipakai untuk mengetahui apakah sebuah titik layar ada di meja. */
export const WORKBENCH_ATTRIBUTE = 'data-workbench';

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
      let xPx = snapToGridPx(center.x - size.widthPx / 2);
      let yPx = snapToGridPx(center.y - size.heightPx / 2);
      const { doc, addComponent } = useCircuitStore.getState();
      // Komponen baru tidak menutupi persis komponen yang sudah ada di titik itu.
      while (doc.components.some((part) => part.xPx === xPx && part.yPx === yPx)) {
        xPx += GRID_PX;
        yPx += GRID_PX;
      }
      return addComponent(catalogId, { xPx, yPx }) !== undefined;
    },
    [screenToFlowPosition],
  );
}
