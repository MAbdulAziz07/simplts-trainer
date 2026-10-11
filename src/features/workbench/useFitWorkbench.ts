import { getViewportForBounds, useReactFlow, useStoreApi } from '@xyflow/react';
import { useCallback } from 'react';
import { useCircuitStore } from '@/store';
import { GRID_PX } from './flow-types';
import { occupiedBoxes } from './placement';

/** Ruang di luar kotak komponen: nama di atas, tuas MCB di kanan, jajaran terminal di bawah. */
const MARGIN_PX = { left: GRID_PX, top: 2 * GRID_PX, right: 3 * GRID_PX, bottom: 3 * GRID_PX };
/** Lebar layar yang ditempati bilah alat di tepi kiri meja; tidak ikut zoom. */
const TOOLBAR_WIDTH_PX = 80;
const FIT_MAX_ZOOM = 1;
const FIT_DURATION_MS = 200;

/**
 * Memaskan seluruh rangkaian ke meja kerja tanpa memperbesar melebihi 100%. Batasnya dihitung
 * dari komponen di store, jadi tidak menunggu kanvas selesai mengukur node.
 */
export function useFitWorkbench(): () => void {
  const { setViewport } = useReactFlow();
  const flowStore = useStoreApi();

  return useCallback(() => {
    const { width, height, minZoom } = flowStore.getState();
    const boxes = occupiedBoxes(useCircuitStore.getState().doc);
    if (boxes.length === 0 || width === 0 || height === 0) return;
    const left = Math.min(...boxes.map((box) => box.xPx)) - MARGIN_PX.left;
    const top = Math.min(...boxes.map((box) => box.yPx)) - MARGIN_PX.top;
    const right = Math.max(...boxes.map((box) => box.xPx + box.widthPx)) + MARGIN_PX.right;
    const bottom = Math.max(...boxes.map((box) => box.yPx + box.heightPx)) + MARGIN_PX.bottom;
    const bounds = { x: left, y: top, width: right - left, height: bottom - top };
    const freeWidthPx = Math.max(1, width - TOOLBAR_WIDTH_PX);
    const viewport = getViewportForBounds(bounds, freeWidthPx, height, minZoom, FIT_MAX_ZOOM, 0);
    void setViewport(
      { ...viewport, x: viewport.x + TOOLBAR_WIDTH_PX },
      { duration: FIT_DURATION_MS },
    );
  }, [setViewport, flowStore]);
}
