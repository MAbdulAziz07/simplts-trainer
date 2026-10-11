// Pesan singkat yang hilang sendiri (docs/UX.md §2.1: toast di tengah bawah meja kerja).
import { create } from 'zustand';

export type ToastTone = 'info' | 'warning';

export interface Toast {
  /** Naik tiap pesan, agar pesan yang sama tetap dianggap baru. */
  id: number;
  text: string;
  tone: ToastTone;
}

interface ToastState {
  toast?: Toast;
  show: (text: string, tone?: ToastTone) => void;
  dismiss: () => void;
}

export const useToastStore = create<ToastState>()((set, get) => ({
  show: (text, tone = 'info') => set({ toast: { id: (get().toast?.id ?? 0) + 1, text, tone } }),
  dismiss: () => set({ toast: undefined }),
}));
