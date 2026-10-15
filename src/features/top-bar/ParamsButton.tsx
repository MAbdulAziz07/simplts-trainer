import { SlidersHorizontal } from 'lucide-react';
import { t } from '@/i18n';
import { useCircuitStore, useUiStore } from '@/store';

/**
 * Tombol "Parameter": membuka/menutup panel inspeksi. Panel tidak lagi terbuka otomatis saat
 * komponen dipilih; tombol menyala selama panel dibuka.
 */
export function ParamsButton() {
  const isOpen = useUiStore((state) => state.inspectorOpen);
  const hasSingle = useCircuitStore((state) => state.selectedComponentIds.length === 1);
  return (
    <button
      type="button"
      title={hasSingle ? t.file.paramsHint : t.file.paramsHintNone}
      aria-pressed={isOpen}
      aria-controls="inspector-panel"
      onClick={() => useUiStore.getState().toggleInspector()}
      className={`flex h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs leading-none font-medium ${
        isOpen ? 'bg-brand/15 text-brand' : 'hover:bg-app'
      }`}
    >
      <SlidersHorizontal aria-hidden size={18} />
      {t.file.params}
    </button>
  );
}
