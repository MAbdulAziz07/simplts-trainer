import { useEffect } from 'react';
import { useCircuitStore } from '@/store';
import { isTypingTarget, shortcutAction, type ShortcutAction } from './shortcuts';

function run(action: ShortcutAction): void {
  const store = useCircuitStore.getState();
  switch (action) {
    case 'undo':
      return store.undo();
    case 'redo':
      return store.redo();
    case 'remove':
      return store.removeSelected();
    case 'rotate':
      return store.rotateSelected();
    case 'select-all':
      return store.select(
        store.doc.components.map((part) => part.id),
        store.doc.wires.map((wire) => wire.id),
      );
    case 'clear-selection':
      return store.select([], []);
  }
}

/** Memasang pintasan keyboard meja kerja selama komponen pemanggil terpasang. */
export function useWorkbenchShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const action = shortcutAction(event);
      if (!action) return;
      // Esc tetap diteruskan agar kanvas bisa membatalkan kabel yang sedang ditarik.
      if (action !== 'clear-selection') event.preventDefault();
      run(action);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
