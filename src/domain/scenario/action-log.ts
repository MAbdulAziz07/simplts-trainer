// Log aksi peserta bertanda waktu, dan aksi yang terbaca dari perubahan meja kerja.
import type { Wire } from '../circuit/types';

export const LOG_ACTIONS = [
  'start',
  'step-done',
  'hint',
  'component-add',
  'component-remove',
  'wire-connect',
  'wire-disconnect',
  'switch-on',
  'switch-off',
  'measure',
  'sim-event',
  'danger-finding',
  'diagnosis-right',
  'diagnosis-wrong',
  'finish',
] as const;
export type LogAction = (typeof LOG_ACTIONS)[number];

export interface LogEntry {
  /** Detik nyata sejak skenario dimulai. */
  realS: number;
  /** Waktu simulasi. */
  simS: number;
  action: LogAction;
  /** Keterangan singkat: id komponen/kabel, bacaan, dsb. */
  detail: string;
}

/** Bentuk meja kerja yang dibaca log; cocok dengan dokumen rangkaian di store. */
export interface BenchState {
  components: readonly { id: string; catalogId: string }[];
  wires: readonly Wire[];
  closedSwitchIds: readonly string[];
}

export type BenchAction = Pick<LogEntry, 'action' | 'detail'>;

const wireText = (wire: Wire) =>
  `${wire.from.componentId}.${wire.from.terminalId} → ${wire.to.componentId}.${wire.to.terminalId}`;

/** Aksi yang mengubah `previous` menjadi `next`: komponen, kabel, dan tuas. */
export function benchActions(previous: BenchState, next: BenchState): BenchAction[] {
  const actions: BenchAction[] = [];
  const diff = <T>(before: readonly T[], after: readonly T[], key: (item: T) => string) => {
    const beforeKeys = new Set(before.map(key));
    const afterKeys = new Set(after.map(key));
    return {
      added: after.filter((item) => !beforeKeys.has(key(item))),
      removed: before.filter((item) => !afterKeys.has(key(item))),
    };
  };
  if (previous.components !== next.components) {
    const { added, removed } = diff(previous.components, next.components, (c) => c.id);
    for (const c of added)
      actions.push({ action: 'component-add', detail: `${c.id} (${c.catalogId})` });
    for (const c of removed) actions.push({ action: 'component-remove', detail: c.id });
  }
  if (previous.wires !== next.wires) {
    const { added, removed } = diff(previous.wires, next.wires, (wire) => wire.id);
    for (const wire of removed) actions.push({ action: 'wire-disconnect', detail: wireText(wire) });
    for (const wire of added) actions.push({ action: 'wire-connect', detail: wireText(wire) });
  }
  if (previous.closedSwitchIds !== next.closedSwitchIds) {
    const { added, removed } = diff(previous.closedSwitchIds, next.closedSwitchIds, (id) => id);
    const known = new Set(next.components.map((c) => c.id));
    for (const id of added) actions.push({ action: 'switch-on', detail: id });
    for (const id of removed.filter((id) => known.has(id))) {
      actions.push({ action: 'switch-off', detail: id });
    }
  }
  return actions;
}

/** Satu sel CSV: diberi tanda kutip bila memuat pemisah, kutip, atau baris baru. */
export function csvCell(value: string | number, separator = ';'): string {
  const text = String(value);
  return /["\n\r]/.test(text) || text.includes(separator) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Tabel menjadi teks CSV; pemisah bawaan titik koma (Excel berlocale Indonesia). */
export function toCsv(rows: readonly (readonly (string | number)[])[], separator = ';'): string {
  return `${rows.map((row) => row.map((cell) => csvCell(cell, separator)).join(separator)).join('\r\n')}\r\n`;
}
