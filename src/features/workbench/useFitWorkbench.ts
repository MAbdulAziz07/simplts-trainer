import { getViewportForBounds, useReactFlow, useStoreApi } from '@xyflow/react';
import { useCallback } from 'react';
import { useCircuitStore, useScenarioStore } from '@/store';
import { fitBounds, fitLeftInsetPx } from './fit-bounds';
import { occupiedBoxes } from './placement';

const FIT_MAX_ZOOM = 1;

/** `true` selama panel langkah skenario tampil di kiri atas meja. */
export const hasScenarioPanel = (): boolean => {
  const { run } = useScenarioStore.getState();
  return run !== undefined && run.finishedAtMs === undefined;
};
/** Lama animasi perpindahan tampilan. */
export const FIT_DURATION_MS = 200;

/**
 * Memaskan seluruh rangkaian ke meja kerja tanpa memperbesar melebihi 100%. Batasnya dihitung
 * dari komponen di store, jadi tidak menunggu kanvas selesai mengukur node. Selama skenario
 * berjalan, rangkaian dipaskan di kanan panel langkah.
 */
export function useFitWorkbench(): () => void {
  const { setViewport } = useReactFlow();
  const flowStore = useStoreApi();

  return useCallback(() => {
    const { width, height, minZoom } = flowStore.getState();
    const box = fitBounds(occupiedBoxes(useCircuitStore.getState().doc));
    if (!box || width === 0 || height === 0) return;
    const bounds = { x: box.xPx, y: box.yPx, width: box.widthPx, height: box.heightPx };
    const insetPx = fitLeftInsetPx(width, hasScenarioPanel());
    const freeWidthPx = Math.max(1, width - insetPx);
    const viewport = getViewportForBounds(bounds, freeWidthPx, height, minZoom, FIT_MAX_ZOOM, 0);
    void setViewport({ ...viewport, x: viewport.x + insetPx }, { duration: FIT_DURATION_MS });
  }, [setViewport, flowStore]);
}
