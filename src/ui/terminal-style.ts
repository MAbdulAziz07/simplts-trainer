// Warna dan bentuk terminal/kabel menurut fungsi penghantar (docs/UX.md §2.3–2.4).
// DC bulat, AC persegi sudut tumpul, PE persegi bergaris, sehingga terbaca tanpa warna.
import type { TerminalKind } from '@/domain';

export type TerminalShape = 'round' | 'square';

export interface TerminalStyle {
  /** Warna penghantar sebagai variabel CSS dari src/index.css. */
  color: string;
  /** Warna garis kedua; hanya PE (hijau-kuning). */
  stripeColor?: string;
  shape: TerminalShape;
  /** Tanda di dalam titik terminal, agar kutub terbaca tanpa warna. */
  glyph: string;
}

const STYLE_BY_KIND: Record<TerminalKind, TerminalStyle> = {
  'pv+': { color: 'var(--color-wire-dc-pos)', shape: 'round', glyph: '+' },
  'dc+': { color: 'var(--color-wire-dc-pos)', shape: 'round', glyph: '+' },
  'pv-': { color: 'var(--color-wire-dc-neg)', shape: 'round', glyph: '−' },
  'dc-': { color: 'var(--color-wire-dc-neg)', shape: 'round', glyph: '−' },
  acL: { color: 'var(--color-wire-ac-line)', shape: 'square', glyph: 'L' },
  acN: { color: 'var(--color-wire-ac-neutral)', shape: 'square', glyph: 'N' },
  pe: {
    color: 'var(--color-wire-pe)',
    stripeColor: 'var(--color-wire-pe-stripe)',
    shape: 'square',
    glyph: '⏚',
  },
  data: { color: 'var(--color-wire-data)', shape: 'square', glyph: 'D' },
};

export function terminalStyle(kind: TerminalKind): TerminalStyle {
  return STYLE_BY_KIND[kind];
}

/** Nilai CSS `background` untuk titik terminal. */
export function terminalBackground(kind: TerminalKind): string {
  const { color, stripeColor } = terminalStyle(kind);
  if (!stripeColor) return color;
  return `repeating-linear-gradient(135deg, ${color} 0 4px, ${stripeColor} 4px 8px)`;
}
