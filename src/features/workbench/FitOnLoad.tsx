import { useReactFlow, useStore, useStoreApi, type Viewport } from '@xyflow/react';
import { useEffect, useRef } from 'react';
import { useCircuitStore } from '@/store';
import { fitBounds, isFullyVisible } from './fit-bounds';
import { occupiedBoxes } from './placement';
import { FIT_DURATION_MS, useFitWorkbench } from './useFitWorkbench';

/** Lama menunggu lebar meja berubah setelah inspektur muncul atau hilang. */
const RESIZE_WAIT_MS = 500;

/**
 * Menjaga rangkaian tetap terlihat saat lebar meja berubah karena inspektur muncul atau hilang.
 * - Inspektur muncul (meja menyempit): bila semua komponen tadinya terlihat dan kini ada yang
 *   tertutup, tampilan dipaskan ulang. Bila tidak ada yang tertutup, tampilan dibiarkan, supaya
 *   komponen yang baru ditaruh atau dipilih tidak bergeser.
 * - Inspektur hilang (meja melebar): tampilan sebelum dipaskan ulang dikembalikan.
 * Tampilan yang sedang diperbesar ke satu bagian rangkaian tidak diubah. Bila komponen dipilih
 * sambil diseret, perubahan ditunda sampai penunjuk dilepas.
 */
function useRefitOnInspector(fit: () => void): void {
  const flowStore = useStoreApi();
  const { getViewport, setViewport } = useReactFlow();
  const width = useStore((state) => state.width);
  const hasInspector = useCircuitStore((state) => state.selectedComponentIds.length === 1);
  const lastWidth = useRef(width);
  const lastInspector = useRef(hasInspector);
  const awaitingResize = useRef(false);
  const pointerDown = useRef(false);
  /** Tampilan sebelum pemasan ulang otomatis; dikembalikan saat inspektur hilang. */
  const viewBeforeRefit = useRef<Viewport>(undefined);

  useEffect(() => {
    const onDown = (): void => {
      pointerDown.current = true;
    };
    const onUp = (): void => {
      pointerDown.current = false;
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
    };
  }, []);

  // Inspektur berganti keadaan: lebar meja menyusul berubah (kecuali di layar sempit, tempat
  // inspektur menjadi lembar bawah dan lebar meja tetap).
  useEffect(() => {
    if (lastInspector.current === hasInspector) return undefined;
    lastInspector.current = hasInspector;
    awaitingResize.current = true;
    const timer = setTimeout(() => {
      awaitingResize.current = false;
    }, RESIZE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [hasInspector]);

  useEffect(() => {
    const previousWidth = lastWidth.current;
    lastWidth.current = width;
    if (!awaitingResize.current || previousWidth === 0 || previousWidth === width) return;
    awaitingResize.current = false;

    const { height } = flowStore.getState();
    const bounds = fitBounds(occupiedBoxes(useCircuitStore.getState().doc));
    if (!bounds) return;
    const isVisible = (view: Viewport, widthPx: number): boolean =>
      isFullyVisible(bounds, { xPx: view.x, yPx: view.y, zoom: view.zoom }, widthPx, height);
    const current = getViewport();

    let change: (() => void) | undefined;
    if (width < previousWidth) {
      // Menyempit: hanya bertindak bila ada komponen yang tadinya terlihat dan kini tertutup.
      if (!isVisible(current, previousWidth) || isVisible(current, width)) return;
      change = () => {
        viewBeforeRefit.current = current;
        fit();
      };
    } else {
      const saved = viewBeforeRefit.current;
      viewBeforeRefit.current = undefined;
      // Melebar: kembali ke tampilan semula, kecuali pengguna sudah memperbesar ke satu bagian.
      if (!saved || !isVisible(current, previousWidth)) return;
      change = isVisible(saved, width)
        ? () => void setViewport(saved, { duration: FIT_DURATION_MS })
        : fit;
    }

    if (!pointerDown.current) {
      change();
      return;
    }
    const onRelease = (): void => {
      window.removeEventListener('pointerup', onRelease);
      window.removeEventListener('pointercancel', onRelease);
      change();
    };
    window.addEventListener('pointerup', onRelease);
    window.addEventListener('pointercancel', onRelease);
  }, [width, flowStore, fit, getViewport, setViewport]);
}

/**
 * Memaskan tampilan sekali tiap rangkaian lain dimuat (simpanan otomatis, berkas, preset), dan
 * menjaga rangkaian tetap terlihat saat inspektur muncul atau hilang. Menambah atau menggeser
 * komponen tidak mengubah tampilan.
 */
export function FitOnLoad() {
  const loadCount = useCircuitStore((state) => state.loadCount);
  const isCanvasReady = useStore((state) => state.panZoom !== null && state.width > 0);
  const fit = useFitWorkbench();
  const fittedCount = useRef(0);

  useEffect(() => {
    if (!isCanvasReady || fittedCount.current === loadCount) return;
    fittedCount.current = loadCount;
    fit();
  }, [loadCount, isCanvasReady, fit]);
  useRefitOnInspector(fit);

  return null;
}
