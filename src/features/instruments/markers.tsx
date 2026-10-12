import { ViewportPortal } from '@xyflow/react';
import { useEffect, useRef } from 'react';
import { t } from '@/i18n';
import { useInstrumentStore, type PlacingTool, type ProbeId } from '@/store';
import { beginPlacing, lastPointer } from './placing';

/** Probe (jarum + gagang berwarna) atau jepitan tang ampere; ujungnya di titik jangkar. */
export function ToolGlyph({ tool }: { tool: PlacingTool }) {
  if (tool === 'clamp') return <span aria-hidden className="clamp-glyph" />;
  return (
    <span aria-hidden className="probe-glyph" data-probe={tool}>
      <span className="probe-grip" />
      <span className="probe-needle" />
    </span>
  );
}

const PROBES: readonly ProbeId[] = ['red', 'black'];

/**
 * Probe yang menempel di sebuah terminal; digambar di dalam terminalnya sehingga ikut bergeser
 * dan ikut zoom. Gagangnya bisa diseret untuk memindahkan probe.
 */
export function ProbeMarker({ nodeId, terminalId }: { nodeId: string; terminalId: string }) {
  const attached = useInstrumentStore((state) =>
    PROBES.filter((probe) => {
      const ref = state.probes[probe];
      return ref?.componentId === nodeId && ref.terminalId === terminalId;
    }).join(','),
  );
  if (attached === '') return null;
  return (
    <>
      {(attached.split(',') as ProbeId[]).map((probe) => (
        <span
          key={probe}
          role="img"
          aria-label={t.instruments.tools[probe]}
          className="probe-marker nodrag nopan"
          data-probe={probe}
          onPointerDown={(event) => beginPlacing(probe, event)}
          // Terminal di bawahnya tidak ikut memulai kabel.
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <ToolGlyph tool={probe} />
        </span>
      ))}
    </>
  );
}

/** Jepitan tang ampere di tengah kabel (koordinat meja kerja), digambar di atas node. */
export function ClampMarker({ wireId, x, y }: { wireId: string; x: number; y: number }) {
  const isClamped = useInstrumentStore((state) => state.clampWireId === wireId);
  if (!isClamped) return null;
  return (
    <ViewportPortal>
      <span
        role="img"
        aria-label={t.instruments.tools.clamp}
        className="clamp-marker nodrag nopan"
        style={{ transform: `translate(${x}px, ${y}px)` }}
        onPointerDown={(event) => beginPlacing('clamp', event)}
      >
        <ToolGlyph tool="clamp" />
      </span>
    </ViewportPortal>
  );
}

/** Bayangan alat yang mengikuti penunjuk selama alat dibawa. */
export function PlacingGhost() {
  const placing = useInstrumentStore((state) => state.placing);
  const ghost = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!placing) return undefined;
    const moveTo = (x: number, y: number): void => {
      Object.assign(lastPointer, { x, y });
      if (ghost.current) ghost.current.style.transform = `translate(${x}px, ${y}px)`;
    };
    moveTo(lastPointer.x, lastPointer.y);
    const onMove = (event: PointerEvent): void => moveTo(event.clientX, event.clientY);
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [placing]);

  if (!placing) return null;
  return (
    <span ref={ghost} className="placing-ghost">
      <ToolGlyph tool={placing} />
    </span>
  );
}
