import { useReactFlow } from '@xyflow/react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { usePlaceComponent } from '@/features/workbench';
import { t } from '@/i18n';
import { catalogItems, findCatalogItem, useCircuitStore, useUiStore } from '@/store';
import { ComponentPicture, itemSizePx } from '@/ui';
import { trayGroups } from './groups';
import { useTrayDrag, type TrayDrag } from './useTrayDrag';

/** Bayangan komponen yang mengikuti pointer selama diseret, seukuran hasilnya di meja. */
function DragGhost({ drag }: { drag: TrayDrag }) {
  const { getZoom } = useReactFlow();
  const item = findCatalogItem(drag.catalogId);
  if (!item) return null;
  const size = itemSizePx(item);
  const zoom = getZoom();
  return createPortal(
    <div
      className="pointer-events-none fixed z-50 opacity-80"
      style={{
        left: drag.x,
        top: drag.y,
        width: size.widthPx * zoom,
        height: size.heightPx * zoom,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <ComponentPicture item={item} />
    </div>,
    document.body,
  );
}

// docs/UX.md §2.1: ubin 92x92 px dua kolom, sela 8 px, tepi 12 px, judul kategori 44 px. Baki bisa
// dilipat menjadi rel ikon 64 px; ikon kelompok di rel membukanya lagi.
export function Tray() {
  const packageId = useCircuitStore((state) => state.packageId);
  const groups = useMemo(() => trayGroups(catalogItems, packageId), [packageId]);
  const place = usePlaceComponent();
  const { drag, tileHandlers } = useTrayDrag({ onDrop: place, onTap: (id) => place(id) });
  const collapsed = useUiStore((state) => state.trayCollapsed);
  const setCollapsed = useUiStore((state) => state.setTrayCollapsed);

  if (collapsed)
    return (
      <aside
        aria-label={t.areas.tray}
        className="border-line bg-card flex flex-col items-center gap-1 overflow-y-auto border-r py-1"
      >
        <button
          type="button"
          aria-label={t.tray.expand}
          title={t.tray.expand}
          aria-expanded={false}
          onClick={() => setCollapsed(false)}
          className="hover:bg-app flex size-11 shrink-0 items-center justify-center rounded-lg"
        >
          <PanelLeftOpen aria-hidden size={20} />
        </button>
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            aria-label={t.tray.groups[group.id]}
            title={t.tray.groups[group.id]}
            onClick={() => setCollapsed(false)}
            className="text-ink-muted hover:bg-app flex size-11 shrink-0 items-center justify-center rounded-lg"
          >
            <group.icon aria-hidden size={20} />
          </button>
        ))}
      </aside>
    );

  return (
    <aside aria-label={t.areas.tray} className="border-line bg-card overflow-y-auto border-r">
      <div className="flex justify-end px-1 pt-1">
        <button
          type="button"
          aria-label={t.tray.collapse}
          title={t.tray.collapse}
          aria-expanded
          onClick={() => setCollapsed(true)}
          className="hover:bg-app text-ink-muted flex size-11 items-center justify-center rounded-lg"
        >
          <PanelLeftClose aria-hidden size={20} />
        </button>
      </div>
      {groups.map((group) => (
        <section key={group.id} aria-label={t.tray.groups[group.id]} className="px-3 pb-2">
          <h2 className="text-ink-muted flex h-11 items-center gap-2 text-xs font-semibold tracking-wide uppercase">
            <group.icon aria-hidden size={16} />
            {t.tray.groups[group.id]}
          </h2>
          <ul className="grid grid-cols-2 gap-2">
            {group.entries.map(({ item, family }) => (
              <li key={family ?? item.id}>
                <button
                  type="button"
                  aria-label={t.tray.add(family ? t.variant.families[family] : item.name)}
                  title={family ? t.variant.families[family] : item.name}
                  data-catalog-id={item.id}
                  className="border-line hover:border-brand focus-visible:outline-brand flex size-[92px] cursor-grab touch-pan-y flex-col items-center gap-1 rounded-lg border bg-white p-1.5 select-none focus-visible:outline-2 active:cursor-grabbing"
                  {...tileHandlers(item.id)}
                >
                  <span className="block min-h-0 w-full flex-1">
                    <ComponentPicture item={item} />
                  </span>
                  <span className="line-clamp-2 w-full text-center text-xs leading-[14px] font-medium">
                    {family ? t.variant.families[family] : item.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {drag && <DragGhost drag={drag} />}
    </aside>
  );
}
