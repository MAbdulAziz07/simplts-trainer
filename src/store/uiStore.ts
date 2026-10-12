// Keadaan tata letak yang tidak ikut tersimpan di rangkaian.
import { create } from 'zustand';

export interface UiState {
  /** Baki dilipat menjadi rel ikon (docs/UX.md §2.1). */
  trayCollapsed: boolean;
  setTrayCollapsed: (collapsed: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  trayCollapsed: false,
  setTrayCollapsed: (trayCollapsed) => set({ trayCollapsed }),
}));
