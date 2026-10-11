import { useStore } from '@xyflow/react';
import { useEffect, useRef } from 'react';
import { useCircuitStore } from '@/store';
import { useFitWorkbench } from './useFitWorkbench';

/**
 * Memaskan tampilan sekali tiap rangkaian lain dimuat (simpanan otomatis, berkas, preset).
 * Menambah atau menggeser komponen tidak mengubah tampilan.
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

  return null;
}
