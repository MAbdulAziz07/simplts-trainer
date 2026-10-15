// Keadaan tata letak yang tidak ikut tersimpan di rangkaian.
import { create } from 'zustand';
import { useCircuitStore } from './circuitStore';

export interface UiState {
  /** Baki dilipat menjadi rel ikon (docs/UX.md §2.1). */
  trayCollapsed: boolean;
  setTrayCollapsed: (collapsed: boolean) => void;
  /**
   * Panel parameter (inspektur) dibuka lewat tombol di bilah atas, tidak otomatis saat komponen
   * dipilih. Tampil bila terbuka dan tepat satu komponen terpilih.
   */
  inspectorOpen: boolean;
  toggleInspector: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  trayCollapsed: false,
  setTrayCollapsed: (trayCollapsed) => set({ trayCollapsed }),
  inspectorOpen: false,
  toggleInspector: () => set((state) => ({ inspectorOpen: !state.inspectorOpen })),
}));

/** Inspektur tampil: panel parameter dibuka dan tepat satu komponen terpilih. */
export function useInspectorVisible(): boolean {
  const isOpen = useUiStore((state) => state.inspectorOpen);
  const hasSingle = useCircuitStore((state) => state.selectedComponentIds.length === 1);
  return isOpen && hasSingle;
}
