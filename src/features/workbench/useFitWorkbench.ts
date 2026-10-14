import { getViewportForBounds, useReactFlow, useStoreApi } from '@xyflow/react';
import { useCallback } from 'react';
import { useCircuitStore } from '@/store';
import { FIT_TOOLBAR_WIDTH_PX, fitBounds } from './fit-bounds';
import { occupiedBoxes } from './placement';

const FIT_MAX_ZOOM = 1;
/** Lama animasi perpindahan tampilan. */
export const FIT_DURATION_MS = 200;

/**
 * Memaskan seluruh rangkaian ke meja kerja tanpa memperbesar melebihi 100%. Batasnya dihitung
 * dari komponen di store, jadi tidak menunggu kanvas selesai mengukur node.
 */
export function useFitWorkbench(): () => void {
  const { setViewport } = useReactFlow();
  const flowStore = useStoreApi();

  return useCallback(() => {
    const { width, height, minZoom } = flowStore.getState();
    const box = fitBounds(occupiedBoxes(useCircuitStore.getState().doc));
    if (!box || width === 0 || height === 0) return;
    const bounds = { x: box.xPx, y: box.yPx, width: box.widthPx, height: box.heightPx };
    const freeWidthPx = Math.max(1, width - FIT_TOOLBAR_WIDTH_PX);
    const viewport = getViewportForBounds(bounds, freeWidthPx, height, minZoom, FIT_MAX_ZOOM, 0);
    void setViewport(
      { ...viewport, x: viewport.x + FIT_TOOLBAR_WIDTH_PX },
      { duration: FIT_DURATION_MS },
    );
  }, [setViewport, flowStore]);
}
