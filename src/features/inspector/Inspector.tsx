import { Zap } from 'lucide-react';
import type { CatalogItem } from '@/domain';
import { SliderField } from '@/features/sim-controls';
import { t } from '@/i18n';
import { findCatalogItem, useCircuitStore } from '@/store';
import { ComponentPicture } from '@/ui';

type LoadItem = Extract<CatalogItem, { category: 'load-dc' | 'load-ac' }>;

const isLoad = (item: CatalogItem | undefined): item is LoadItem =>
  item?.category === 'load-dc' || item?.category === 'load-ac';

/**
 * Pengatur daya beban (docs/PRD.md F8): slider dari daya terkecil sampai terbesar dengan langkah
 * katalog. Satu seretan menjadi satu langkah undo; ukurannya tidak ikut zoom meja.
 */
function LoadPowerControl({ id, item }: { id: string; item: LoadItem }) {
  const settingW = useCircuitStore(
    (state) => state.doc.components.find((part) => part.id === id)?.powerSettingW,
  );
  const { minPowerW, maxPowerW, stepW } = item.electrical;
  const powerW = settingW ?? maxPowerW;
  const store = useCircuitStore.getState;
  return (
    <SliderField
      icon={Zap}
      label={t.status.loadPowerSetting(item.name)}
      valueText={t.status.loadPowerValue(powerW)}
      min={minPowerW}
      max={maxPowerW}
      step={stepW}
      value={powerW}
      onChange={(value) => store().setLoadPower(id, value)}
      onGestureStart={() => store().beginGesture()}
      onGestureEnd={() => store().endGesture()}
    />
  );
}

/**
 * Inspeksi komponen terpilih. Sekarang baru berisi pengatur daya untuk satu beban terpilih;
 * komponen lain belum punya isi (docs/UX.md §2.1).
 */
export function Inspector() {
  const selectedId = useCircuitStore((state) =>
    state.selectedComponentIds.length === 1 ? state.selectedComponentIds[0] : undefined,
  );
  const catalogId = useCircuitStore(
    (state) => state.doc.components.find((part) => part.id === selectedId)?.catalogId,
  );
  const item = catalogId === undefined ? undefined : findCatalogItem(catalogId);

  return (
    <aside aria-label={t.areas.inspector} className="border-line bg-card overflow-y-auto border-l">
      {selectedId !== undefined && isLoad(item) && (
        <div className="flex flex-col gap-3 p-4">
          <div className="mx-auto h-28 w-28">
            <ComponentPicture item={item} />
          </div>
          <h2 className="text-center text-base font-semibold">{item.name}</h2>
          <h3 className="text-ink-muted text-xs font-semibold">{t.status.loadPower}</h3>
          <LoadPowerControl id={selectedId} item={item} />
        </div>
      )}
    </aside>
  );
}
