import { CircleHelp, Trash2, Zap } from 'lucide-react';
import { useState } from 'react';
import type { CatalogItem } from '@/domain';
import { SliderField } from '@/features/sim-controls';
import { t } from '@/i18n';
import { findCatalogItem, useCircuitStore } from '@/store';
import { ComponentPicture } from '@/ui';
import { ratingsOf } from './ratings';
import './inspector.css';

type LoadItem = Extract<CatalogItem, { category: 'load-dc' | 'load-ac' }>;

const isLoad = (item: CatalogItem): item is LoadItem =>
  item.category === 'load-dc' || item.category === 'load-ac';

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
    <section className="flex flex-col gap-1">
      <h3 className="text-ink-muted text-xs font-semibold">{t.status.loadPower}</h3>
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
    </section>
  );
}

/** Paling banyak empat rating utama: tanda besaran, angka 20 px, dan satuan (UX.md §1 butir 8). */
function Ratings({ item }: { item: CatalogItem }) {
  return (
    <dl aria-label={t.inspector.ratings} className="grid grid-cols-2 gap-2">
      {ratingsOf(item).map(({ key, text, unit }) => (
        <div key={key} className="rating" title={t.inspector.rating[key].name}>
          <dt>
            <abbr title={t.inspector.rating[key].name}>{t.inspector.rating[key].symbol}</abbr>
          </dt>
          <dd>
            {text}
            {unit && <span className="rating-unit">{unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Isi inspektur untuk satu komponen; `key` di pemanggil menutup penjelasan saat pilihan berganti. */
function InspectorBody({ id, item }: { id: string; item: CatalogItem }) {
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <>
      <div className="flex items-start gap-2">
        <div className="size-24 shrink-0">
          <ComponentPicture item={item} />
        </div>
        <h2 className="min-w-0 flex-1 self-center text-base leading-tight font-semibold">
          {item.name}
        </h2>
        <button
          type="button"
          aria-label={t.inspector.help(item.name)}
          title={t.inspector.help(item.name)}
          aria-expanded={helpOpen}
          onClick={() => setHelpOpen((isOpen) => !isOpen)}
          className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${
            helpOpen ? 'bg-brand text-white' : 'hover:bg-app text-ink-muted'
          }`}
        >
          <CircleHelp aria-hidden size={22} />
        </button>
      </div>
      {helpOpen && (
        <p className="text-ink-muted text-sm leading-snug">
          {t.inspector.explanations[item.category]}
        </p>
      )}
      <Ratings item={item} />
      {isLoad(item) && <LoadPowerControl id={id} item={item} />}
      <button
        type="button"
        aria-label={t.inspector.remove(item.name)}
        title={t.inspector.removeHint}
        onClick={() => useCircuitStore.getState().removeSelected()}
        className="text-status-danger hover:bg-app mt-auto flex size-11 items-center justify-center self-end rounded-lg"
      >
        <Trash2 aria-hidden size={22} />
      </button>
    </>
  );
}

/**
 * Inspeksi komponen terpilih: gambar, nama, rating utama, penjelasan lewat "?", pengatur daya
 * untuk beban, dan tombol hapus. Hanya muncul saat tepat satu komponen terpilih; di lebar layar
 * di bawah 1024 px menjadi lembar bawah (docs/UX.md §2.1).
 */
export function Inspector() {
  const selectedId = useCircuitStore((state) =>
    state.selectedComponentIds.length === 1 ? state.selectedComponentIds[0] : undefined,
  );
  const catalogId = useCircuitStore(
    (state) => state.doc.components.find((part) => part.id === selectedId)?.catalogId,
  );
  const item = catalogId === undefined ? undefined : findCatalogItem(catalogId);
  if (selectedId === undefined || !item) return null;

  return (
    <aside aria-label={t.areas.inspector} className="inspector border-line bg-card">
      <InspectorBody key={selectedId} id={selectedId} item={item} />
    </aside>
  );
}
