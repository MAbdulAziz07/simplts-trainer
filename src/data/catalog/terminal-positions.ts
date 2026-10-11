// Menulis posisi terminal ke teks berkas katalog tanpa mengubah format tulisan tangannya:
// hanya angka `xPct`/`yPct` terminal yang disebut yang diganti. Dipakai editor terminal (mode dev)
// lewat vite-plugins/terminal-editor.ts, jadi berkas ini tidak boleh meng-import alias `@/`.

export interface TerminalPosition {
  /** Id terminal di dalam item. */
  id: string;
  xPct: number;
  yPct: number;
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Persen 0–100 dengan satu angka desimal. */
export function roundPct(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
}

/** `true` bila teks berkas katalog itu memuat item ber-id `itemId`. */
export function hasCatalogItem(jsonText: string, itemId: string): boolean {
  return itemStart(jsonText, itemId) >= 0;
}

function itemStart(jsonText: string, itemId: string): number {
  return jsonText.search(new RegExp(`"id":\\s*"${escapeRegExp(itemId)}"\\s*,\\s*"category"`));
}

/**
 * Mengembalikan teks berkas dengan posisi terminal satu item diganti. Melempar galat bila item
 * atau terminalnya tidak ada, atau angka posisinya tidak sah.
 */
export function setTerminalPositions(
  jsonText: string,
  itemId: string,
  positions: readonly TerminalPosition[],
): string {
  const start = itemStart(jsonText, itemId);
  if (start < 0) throw new Error(`Item "${itemId}" tidak ada di berkas`);
  const listMatch = /"terminals":\s*\[/.exec(jsonText.slice(start));
  if (!listMatch) throw new Error(`Item "${itemId}" tidak punya daftar terminal`);
  const listStart = start + listMatch.index + listMatch[0].length;
  // Objek terminal tidak memuat larik, jadi `]` pertama menutup daftar terminal.
  const listEnd = jsonText.indexOf(']', listStart);

  let list = jsonText.slice(listStart, listEnd);
  for (const { id, xPct, yPct } of positions) {
    if (!Number.isFinite(xPct) || !Number.isFinite(yPct))
      throw new Error(`Posisi terminal "${id}" bukan angka`);
    const terminal = new RegExp(`\\{[^{}]*"id":\\s*"${escapeRegExp(id)}"[^{}]*\\}`).exec(list);
    if (!terminal) throw new Error(`Terminal "${id}" tidak ada di item "${itemId}"`);
    const updated = terminal[0]
      .replace(/("xPct":\s*)-?[\d.eE+-]+/, `$1${roundPct(xPct)}`)
      .replace(/("yPct":\s*)-?[\d.eE+-]+/, `$1${roundPct(yPct)}`);
    list =
      list.slice(0, terminal.index) + updated + list.slice(terminal.index + terminal[0].length);
  }
  return jsonText.slice(0, listStart) + list + jsonText.slice(listEnd);
}
