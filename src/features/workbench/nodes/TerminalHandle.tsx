import { Handle, Position } from '@xyflow/react';
import { t } from '@/i18n';
import { terminalBackground, terminalStyle } from '@/ui';
import type { Side, TerminalSpot } from './geometry';

/** Peran terminal selama sebuah kabel ditarik. */
export type TerminalRole = 'idle' | 'origin' | 'allowed' | 'blocked';

const POSITION_BY_SIDE: Record<Side, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

const LABEL_PLACEMENT: Record<Side, string> = {
  top: 'left-1/2 -translate-x-1/2',
  bottom: 'left-1/2 -translate-x-1/2',
  left: 'top-1/2 -translate-y-1/2',
  right: 'top-1/2 -translate-y-1/2',
};
const LABEL_GAP_PX = 4;
const LABEL_ROW_PX = 20;

/** Jarak label dari pusat terminal, ke arah luar sisi node. */
function labelOffset({ side, hitPx, labelRow }: TerminalSpot) {
  const distancePx = hitPx / 2 + LABEL_GAP_PX + labelRow * LABEL_ROW_PX;
  const edge = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[side];
  return { [edge]: distancePx };
}

interface TerminalHandleProps {
  spot: TerminalSpot;
  role: TerminalRole;
  /** Label selalu tampak (node terpilih atau kabel sedang ditarik); selain itu hanya saat hover. */
  showLabel: boolean;
}

/**
 * Satu terminal. Handle @xyflow/react dibuat sebesar titik di pusat terminal supaya ujung kabel
 * jatuh tepat di tengah; area sentuhnya adalah anak yang lebih besar.
 */
export function TerminalHandle({ spot, role, showLabel }: TerminalHandleProps) {
  const { terminal, side, dotPx, hitPx } = spot;
  const { shape, glyph } = terminalStyle(terminal.kind);
  const isPe = terminal.kind === 'pe';

  return (
    <Handle
      id={terminal.id}
      type="source"
      position={POSITION_BY_SIDE[side]}
      aria-label={t.workbench.terminal(terminal.label)}
      className="terminal group/terminal"
      data-role={role}
      data-kind={terminal.kind}
      style={{ left: spot.xPx, top: spot.yPx }}
    >
      <span className="terminal-hit" style={{ width: hitPx, height: hitPx }}>
        <span
          className={`terminal-dot ${shape === 'round' ? 'rounded-full' : 'rounded-[5px]'}`}
          style={{
            width: dotPx,
            height: dotPx,
            background: terminalBackground(terminal.kind),
            fontSize: Math.max(10, dotPx - 10),
          }}
        >
          <span className={isPe ? 'terminal-glyph-pe' : undefined}>{glyph}</span>
        </span>
      </span>
      <span
        className={`terminal-label ${LABEL_PLACEMENT[side]} ${
          showLabel ? 'opacity-100' : 'opacity-0 group-hover/terminal:opacity-100'
        }`}
        style={labelOffset(spot)}
      >
        {terminal.label}
      </span>
    </Handle>
  );
}
