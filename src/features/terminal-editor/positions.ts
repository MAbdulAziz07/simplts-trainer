// Draf posisi terminal di editor dan pengirimannya ke server pengembangan.
import type { CatalogItem } from '@/domain';

export interface PointPct {
  xPct: number;
  yPct: number;
}

/** Posisi per id terminal; `undefined` = belum ditandai (di katalog ditulis 0, 0). */
export type PositionDraft = Record<string, PointPct | undefined>;

// Sama dengan TERMINAL_POSITIONS_ENDPOINT di vite-plugins/terminal-editor.ts.
const ENDPOINT = '/__dev/terminal-positions';

const isSet = (point: PointPct): boolean => point.xPct !== 0 || point.yPct !== 0;

export function draftFromItem(item: Pick<CatalogItem, 'terminals'>): PositionDraft {
  return Object.fromEntries(
    item.terminals.map(({ id, xPct, yPct }) => [
      id,
      isSet({ xPct, yPct }) ? { xPct, yPct } : undefined,
    ]),
  );
}

export function isSameDraft(a: PositionDraft, b: PositionDraft): boolean {
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...ids].every((id) => a[id]?.xPct === b[id]?.xPct && a[id]?.yPct === b[id]?.yPct);
}

export function placedCount(draft: PositionDraft): number {
  return Object.values(draft).filter(Boolean).length;
}

/**
 * Item lain yang gambarnya sama dan id terminalnya sama persis (mis. ketujuh panel surya), jadi
 * posisi terminalnya bisa disalin begitu saja.
 */
export function siblingItems(item: CatalogItem, catalog: readonly CatalogItem[]): CatalogItem[] {
  const signature = (candidate: CatalogItem): string =>
    candidate.terminals.map((terminal) => terminal.id).join(',');
  return catalog.filter(
    (candidate) =>
      candidate.id !== item.id &&
      candidate.image === item.image &&
      signature(candidate) === signature(item),
  );
}

/** Menulis draf ke berkas katalog lewat server pengembangan; mengembalikan id item tersimpan. */
export async function savePositions(
  itemIds: readonly string[],
  draft: PositionDraft,
): Promise<string[]> {
  const terminals = Object.entries(draft).map(([id, point]) => ({
    id,
    xPct: point?.xPct ?? 0,
    yPct: point?.yPct ?? 0,
  }));
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: itemIds.map((itemId) => ({ itemId, terminals })) }),
  });
  const body = (await response.json()) as { saved?: string[]; error?: string };
  if (!response.ok || !body.saved) throw new Error(body.error ?? `HTTP ${response.status}`);
  return body.saved;
}
