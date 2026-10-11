import { Eraser, Save, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CatalogItem } from '@/domain';
import { t } from '@/i18n';
import { catalogItems } from '@/store';
import { TerminalDot } from '@/ui';
import {
  draftFromItem,
  isSameDraft,
  savePositions,
  siblingItems,
  type PointPct,
  type PositionDraft,
} from './positions';
import { TerminalCanvas } from './TerminalCanvas';

const BUTTON =
  'flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium disabled:opacity-40';

/** Editor satu item: gambar di tengah, daftar terminal dan tombol simpan di kanan. */
export function ItemEditor({ item }: { item: CatalogItem }) {
  const initial = useMemo(() => draftFromItem(item), [item]);
  const siblings = useMemo(() => siblingItems(item, catalogItems), [item]);
  const [draft, setDraft] = useState<PositionDraft>(initial);
  const [activeId, setActiveId] = useState(
    () => (item.terminals.find((terminal) => !initial[terminal.id]) ?? item.terminals[0])?.id,
  );
  const [applyToSiblings, setApplyToSiblings] = useState(true);
  const [status, setStatus] = useState('');
  const isDirty = !isSameDraft(draft, initial);

  const place = (terminalId: string, point: PointPct) => {
    const wasPlaced = Boolean(draft[terminalId]);
    const next = { ...draft, [terminalId]: point };
    setDraft(next);
    setStatus('');
    // Setelah menaruh terminal baru, lanjut ke terminal berikutnya yang belum ditandai.
    if (!wasPlaced)
      setActiveId(item.terminals.find((terminal) => !next[terminal.id])?.id ?? terminalId);
  };

  const save = async () => {
    const itemIds = [item.id, ...(applyToSiblings ? siblings.map((sibling) => sibling.id) : [])];
    try {
      const saved = await savePositions(itemIds, draft);
      setStatus(t.terminalEditor.saved(saved.length));
    } catch (error) {
      setStatus(
        t.terminalEditor.saveFailed(error instanceof Error ? error.message : String(error)),
      );
    }
  };

  return (
    <>
      <section className="bg-bench flex min-w-0 flex-col items-center gap-4 overflow-auto p-6">
        <p className="text-ink-muted text-sm">{t.terminalEditor.hint}</p>
        <TerminalCanvas
          item={item}
          draft={draft}
          activeId={activeId}
          onSelect={setActiveId}
          onPlace={place}
        />
      </section>

      <aside className="border-line bg-card flex flex-col gap-3 overflow-y-auto border-l p-3">
        <h2 className="text-base font-semibold">{item.name}</h2>
        <p className="text-ink-muted -mt-2 text-xs">{item.id}</p>
        <ul
          role="radiogroup"
          aria-label={t.terminalEditor.terminals}
          className="flex flex-col gap-1"
        >
          {item.terminals.map((terminal) => {
            const point = draft[terminal.id];
            return (
              <li key={terminal.id} className="flex items-center gap-1">
                <button
                  type="button"
                  role="radio"
                  aria-checked={terminal.id === activeId}
                  onClick={() => setActiveId(terminal.id)}
                  className={`flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border px-2 text-left text-sm ${
                    terminal.id === activeId ? 'border-brand bg-app' : 'border-transparent'
                  }`}
                >
                  <TerminalDot kind={terminal.kind} sizePx={18} className="shrink-0" />
                  <span className="font-semibold">{terminal.label}</span>
                  <span className="text-ink-muted ml-auto text-xs tabular-nums">
                    {point ? `${point.xPct} · ${point.yPct}` : t.terminalEditor.unplaced}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={t.terminalEditor.clear(terminal.label)}
                  title={t.terminalEditor.clear(terminal.label)}
                  disabled={!point}
                  onClick={() => setDraft({ ...draft, [terminal.id]: undefined })}
                  className="text-ink-muted flex size-11 items-center justify-center rounded-lg disabled:opacity-30"
                >
                  <Eraser aria-hidden size={18} />
                </button>
              </li>
            );
          })}
        </ul>

        {siblings.length > 0 && (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-5"
              checked={applyToSiblings}
              onChange={(event) => setApplyToSiblings(event.target.checked)}
            />
            {t.terminalEditor.applyToSiblings(siblings.length)}
          </label>
        )}

        <button
          type="button"
          disabled={!isDirty}
          onClick={save}
          className={`${BUTTON} bg-brand text-white`}
        >
          <Save aria-hidden size={18} />
          {t.terminalEditor.save}
        </button>
        <button
          type="button"
          disabled={!isDirty}
          onClick={() => setDraft(initial)}
          className={`${BUTTON} border-line border`}
        >
          <Undo2 aria-hidden size={18} />
          {t.terminalEditor.reset}
        </button>
        <p role="status" className="text-ink-muted min-h-5 text-sm">
          {status || (isDirty ? t.terminalEditor.dirty : '')}
        </p>
      </aside>
    </>
  );
}
