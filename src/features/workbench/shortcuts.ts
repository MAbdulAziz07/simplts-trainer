// Pintasan keyboard meja kerja → nama aksi. Fungsi murni agar bisa diuji tanpa browser.

export type ShortcutAction =
  'undo' | 'redo' | 'remove' | 'rotate' | 'select-all' | 'clear-selection';

export interface KeyStroke {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** Aksi untuk satu tekanan tombol; `undefined` bila bukan pintasan. Ctrl dan ⌘ setara. */
export function shortcutAction(stroke: KeyStroke): ShortcutAction | undefined {
  if (stroke.altKey) return undefined;
  const key = stroke.key.toLowerCase();
  if (stroke.ctrlKey || stroke.metaKey) {
    if (key === 'z') return stroke.shiftKey ? 'redo' : 'undo';
    if (key === 'y' && !stroke.shiftKey) return 'redo';
    if (key === 'a' && !stroke.shiftKey) return 'select-all';
    return undefined;
  }
  if (key === 'delete' || key === 'backspace') return 'remove';
  if (key === 'r' && !stroke.shiftKey) return 'rotate';
  if (key === 'escape') return 'clear-selection';
  return undefined;
}

/** Pintasan tidak berlaku selama pengguna mengetik di kotak isian. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
