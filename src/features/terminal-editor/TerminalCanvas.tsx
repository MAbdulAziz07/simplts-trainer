import { useRef, type PointerEvent } from 'react';
import type { CatalogItem } from '@/domain';
import { ComponentPicture, TerminalDot, itemSizePx } from '@/ui';
import type { PointPct, PositionDraft } from './positions';

/** Sisi terpanjang gambar di editor; lebih besar daripada di meja kerja agar mudah dibidik. */
const CANVAS_LONG_SIDE_PX = 520;
const MARKER_PX = 22;

interface TerminalCanvasProps {
  item: CatalogItem;
  draft: PositionDraft;
  activeId: string | undefined;
  onSelect: (terminalId: string) => void;
  onPlace: (terminalId: string, point: PointPct) => void;
}

/** Gambar komponen: klik menaruh terminal aktif, titik yang sudah ada bisa diseret. */
export function TerminalCanvas({ item, draft, activeId, onSelect, onPlace }: TerminalCanvasProps) {
  const box = useRef<HTMLDivElement>(null);
  const size = itemSizePx(item);
  const scale = CANVAS_LONG_SIDE_PX / Math.max(size.widthPx, size.heightPx);

  const pointAt = (event: PointerEvent): PointPct | undefined => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return undefined;
    const pct = (value: number) => Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
    return {
      xPct: pct(((event.clientX - rect.left) / rect.width) * 100),
      yPct: pct(((event.clientY - rect.top) / rect.height) * 100),
    };
  };
  const place = (terminalId: string | undefined, event: PointerEvent) => {
    const point = pointAt(event);
    if (terminalId && point) onPlace(terminalId, point);
  };

  return (
    <div
      ref={box}
      data-testid="terminal-canvas"
      className="outline-line relative cursor-crosshair touch-none outline-1 outline-dashed"
      style={{ width: size.widthPx * scale, height: size.heightPx * scale }}
      onPointerDown={(event) => place(activeId, event)}
    >
      <ComponentPicture item={item} />
      {item.terminals.map((terminal) => {
        const point = draft[terminal.id];
        if (!point) return null;
        const isActive = terminal.id === activeId;
        return (
          <button
            key={terminal.id}
            type="button"
            aria-label={terminal.label}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none"
            style={{ left: `${point.xPct}%`, top: `${point.yPct}%` }}
            onPointerDown={(event) => {
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              onSelect(terminal.id);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) place(terminal.id, event);
            }}
          >
            <TerminalDot
              kind={terminal.kind}
              sizePx={MARKER_PX}
              className={isActive ? 'outline-brand outline-2 outline-offset-4' : ''}
            />
            {/* Label hanya untuk terminal aktif dan tidak menangkap klik, agar tidak menutupi
                terminal di sebelahnya. */}
            {isActive && (
              <span className="border-line pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded border bg-white px-1 text-xs font-bold whitespace-nowrap">
                {terminal.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
