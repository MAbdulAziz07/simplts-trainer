import type { TerminalKind } from '@/domain';
import { terminalBackground, terminalStyle } from './terminal-style';

interface TerminalDotProps {
  kind: TerminalKind;
  /** Garis tengah titik. */
  sizePx: number;
  className?: string;
}

const MIN_GLYPH_PX = 10;

/** Titik terminal: warna dan bentuk menurut jenis penghantar, dengan tanda kutub di dalamnya. */
export function TerminalDot({ kind, sizePx, className = '' }: TerminalDotProps) {
  const { shape, glyph } = terminalStyle(kind);
  const isStriped = kind === 'pe';
  return (
    <span
      className={`terminal-dot ${shape === 'round' ? 'rounded-full' : 'rounded-[5px]'} ${className}`}
      style={{
        width: sizePx,
        height: sizePx,
        background: terminalBackground(kind),
        fontSize: Math.max(MIN_GLYPH_PX, sizePx - 10),
      }}
    >
      <span className={isStriped ? 'terminal-glyph-striped' : undefined}>{glyph}</span>
    </span>
  );
}
