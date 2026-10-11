// Riwayat undo/redo sebagai dua tumpukan keadaan; fungsi murni.

export interface History<T> {
  /** Keadaan sebelum tiap perubahan, terlama di depan. */
  past: T[];
  /** Keadaan yang dibatalkan, terdekat di depan. */
  future: T[];
}

export const HISTORY_LIMIT = 100;

export function emptyHistory<T>(): History<T> {
  return { past: [], future: [] };
}

/** Mencatat keadaan sebelum sebuah perubahan; perubahan baru menghapus cabang redo. */
export function record<T>(history: History<T>, previous: T): History<T> {
  return { past: [...history.past, previous].slice(-HISTORY_LIMIT), future: [] };
}

export interface HistoryStep<T> {
  history: History<T>;
  current: T;
}

export function undo<T>(history: History<T>, current: T): HistoryStep<T> | undefined {
  const previous = history.past.at(-1);
  if (previous === undefined) return undefined;
  return {
    current: previous,
    history: { past: history.past.slice(0, -1), future: [current, ...history.future] },
  };
}

export function redo<T>(history: History<T>, current: T): HistoryStep<T> | undefined {
  const [next, ...future] = history.future;
  if (next === undefined) return undefined;
  return { current: next, history: { past: [...history.past, current], future } };
}
