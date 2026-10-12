import { Handle, Position, useNodeId } from '@xyflow/react';
import { Lock } from 'lucide-react';
import { ProbeMarker } from '@/features/instruments';
import { t } from '@/i18n';
import { TerminalDot, terminalStyle } from '@/ui';
import type { Side, TerminalSpot } from './geometry';

/**
 * Peran terminal selama sebuah kabel ditarik: asal, boleh dituju, ditolak aturan sambungan, atau
 * penuh (jumlah kabelnya sudah sebanyak `maxWires`).
 */
export type TerminalRole = 'idle' | 'origin' | 'allowed' | 'blocked' | 'full';

/** Area sentuh sebuah terminal pada tingkat zoom sekarang (lihat hit-area.ts). */
export interface TerminalHit {
  sidePx: number;
  clipPath: string;
}

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
  hit: TerminalHit;
  /** Node terpilih atau kabel sedang ditarik: label yang hanya mengulang tanda kutub ikut tampil. */
  emphasized: boolean;
}

/**
 * Satu terminal. Handle @xyflow/react dibuat sebesar titik di pusat terminal supaya ujung kabel
 * jatuh tepat di tengah; area sentuhnya (44 px di layar) adalah anak yang lebih besar di bawah
 * titiknya. Label selalu tampak (docs/UX.md §2.3), kecuali label yang sama persis dengan tanda di
 * dalam titik (+, −, L, N), yang baru muncul saat hover, node terpilih, atau kabel ditarik.
 */
export function TerminalHandle({ spot, role, hit, emphasized }: TerminalHandleProps) {
  const { terminal, side, dotPx } = spot;
  const nodeId = useNodeId();
  const repeatsGlyph = terminal.label === terminalStyle(terminal.kind).glyph;
  const isLabelShown = emphasized || !repeatsGlyph;

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
      <span
        className="terminal-hit"
        style={{ width: hit.sidePx, height: hit.sidePx, clipPath: hit.clipPath }}
      />
      <span className="terminal-dot-wrap">
        <TerminalDot kind={terminal.kind} sizePx={dotPx} />
        {role === 'full' && (
          <span className="terminal-lock">
            <Lock aria-hidden size={10} strokeWidth={3} />
            <span className="sr-only">{t.connectionRejections['terminal-full']}</span>
          </span>
        )}
      </span>
      <span
        className={`terminal-label ${LABEL_PLACEMENT[side]} ${
          isLabelShown ? 'opacity-100' : 'opacity-0 group-hover/terminal:opacity-100'
        }`}
        style={labelOffset(spot)}
      >
        {terminal.label}
      </span>
      {nodeId && <ProbeMarker nodeId={nodeId} terminalId={terminal.id} />}
    </Handle>
  );
}
