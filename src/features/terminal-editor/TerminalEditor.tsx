import { ArrowLeft, Check } from 'lucide-react';
import { useState } from 'react';
import { t } from '@/i18n';
import { catalogItems } from '@/store';
import { ComponentPicture } from '@/ui';
import { ItemEditor } from './ItemEditor';
import { draftFromItem, placedCount } from './positions';

// Kabel tidak punya terminal, jadi tidak ada yang ditandai.
const ITEMS = catalogItems.filter((item) => item.terminals.length > 0);

/** Item terpilih disimpan di hash URL: menyimpan ke katalog memuat ulang halaman. */
const itemIdFromHash = (): string => decodeURIComponent(window.location.hash.slice(1));

/**
 * Halaman pengembang `/dev/terminal-editor`: menandai posisi terminal pada gambar komponen dan
 * menyimpannya ke src/data/catalog/*.json. Hanya dimuat saat `import.meta.env.DEV`.
 */
export function TerminalEditor() {
  const [itemId, setItemId] = useState(itemIdFromHash);
  const item = ITEMS.find((candidate) => candidate.id === itemId) ?? ITEMS[0];

  const select = (id: string) => {
    window.history.replaceState(null, '', `#${encodeURIComponent(id)}`);
    setItemId(id);
  };

  return (
    <div className="grid h-full grid-cols-[264px_minmax(0,1fr)_304px] grid-rows-[56px_minmax(0,1fr)]">
      <header className="border-line bg-card col-span-3 flex items-center gap-3 border-b px-4">
        <a href="/" aria-label={t.terminalEditor.backToApp} title={t.terminalEditor.backToApp}>
          <span className="flex size-11 items-center justify-center">
            <ArrowLeft aria-hidden size={20} />
          </span>
        </a>
        <h1 className="text-base font-semibold">{t.terminalEditor.title}</h1>
        <span className="bg-app text-ink-muted rounded px-2 py-0.5 text-xs">
          {t.terminalEditor.devOnly}
        </span>
      </header>

      <nav
        aria-label={t.terminalEditor.items}
        className="border-line bg-card overflow-y-auto border-r p-2"
      >
        <ul className="flex flex-col gap-1">
          {ITEMS.map((candidate) => {
            const placed = placedCount(draftFromItem(candidate));
            const total = candidate.terminals.length;
            return (
              <li key={candidate.id}>
                <button
                  type="button"
                  aria-current={candidate === item}
                  onClick={() => select(candidate.id)}
                  className={`flex h-12 w-full items-center gap-2 rounded-lg border px-2 text-left text-sm ${
                    candidate === item ? 'border-brand bg-app' : 'border-transparent'
                  }`}
                >
                  <span className="block size-9 shrink-0">
                    <ComponentPicture item={candidate} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{candidate.name}</span>
                  <span
                    className={`flex items-center gap-0.5 text-xs tabular-nums ${
                      placed === total ? 'text-status-ok' : 'text-ink-muted'
                    }`}
                  >
                    {placed === total && <Check aria-hidden size={14} />}
                    {t.terminalEditor.progress(placed, total)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {item && <ItemEditor key={item.id} item={item} />}
    </div>
  );
}
