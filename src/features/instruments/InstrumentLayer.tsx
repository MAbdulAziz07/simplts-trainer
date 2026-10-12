import { Panel } from '@xyflow/react';
import { useEffect } from 'react';
import { t } from '@/i18n';
import { INSTRUMENT_IDS, useInstrumentStore, type InstrumentId } from '@/store';
import { InstrumentPicture } from './InstrumentPanel';
import { PlacingGhost } from './markers';
import { ClampPanel, MultimeterPanel, SolarPanel } from './panels';
import { INSTRUMENT_UI_ATTRIBUTE, dropTool, targetAt, type PointPx } from './placing';
import './instruments.css';

const PANELS: Record<InstrumentId, () => React.JSX.Element> = {
  multimeter: MultimeterPanel,
  clamp: ClampPanel,
  solar: SolarPanel,
};

/** Kejadian yang mendahului `click`; ditahan agar terminal tidak ikut memulai kabel. */
const PRESS_EVENTS = ['pointerdown', 'mousedown', 'touchstart'] as const;

/**
 * Selama sebuah alat dibawa lewat ketukan: ketukan pada terminal (probe) atau kabel (jepitan)
 * menempelkannya dan tidak diteruskan ke meja kerja; Esc membatalkan.
 */
function usePlacingTaps(): void {
  const placing = useInstrumentStore((state) => state.placing);
  useEffect(() => {
    if (!placing) return undefined;
    const { setPlacing } = useInstrumentStore.getState();
    /** Titik layar sebuah kejadian tekan; sentuhan memakai jari pertamanya. */
    const pointOf = (event: Event): PointPx | undefined => {
      const source = 'touches' in event ? (event as TouchEvent).touches[0] : (event as MouseEvent);
      return source ? { x: source.clientX, y: source.clientY } : undefined;
    };
    const onPress = (event: Event): void => {
      const point = pointOf(event);
      if (point && targetAt(placing, point) !== undefined) event.stopPropagation();
    };
    const onClick = (event: MouseEvent): void => {
      if (!dropTool(placing, { x: event.clientX, y: event.clientY })) return;
      event.stopPropagation();
      event.preventDefault();
      setPlacing(undefined);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setPlacing(undefined);
    };
    for (const type of PRESS_EVENTS) window.addEventListener(type, onPress, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey);
    return () => {
      for (const type of PRESS_EVENTS) window.removeEventListener(type, onPress, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [placing]);
}

/**
 * Alat ukur di meja kerja: tombol pembuka di kanan atas dan panel alat yang terbuka di kanan
 * bawah. Ukurannya tidak ikut zoom, jadi angkanya selalu terbaca (docs/PRD.md §1).
 */
export function InstrumentLayer() {
  const open = useInstrumentStore((state) => state.open);
  const toggle = useInstrumentStore((state) => state.toggle);
  usePlacingTaps();
  const ui = { [INSTRUMENT_UI_ATTRIBUTE]: '' };

  return (
    <>
      <Panel position="top-right">
        <div
          role="toolbar"
          aria-label={t.instruments.toolbar}
          aria-orientation="vertical"
          className="border-line bg-card flex flex-col rounded-xl border p-1 shadow-sm"
          {...ui}
        >
          {INSTRUMENT_IDS.map((id) => {
            const name = t.instruments.names[id];
            const label = open[id] ? t.instruments.close(name) : t.instruments.open(name);
            return (
              <button
                key={id}
                type="button"
                aria-label={label}
                title={label}
                aria-pressed={open[id]}
                onClick={() => toggle(id)}
                className={`flex size-11 items-center justify-center rounded-lg ${
                  open[id] ? 'bg-brand/15 ring-brand ring-2' : 'hover:bg-app'
                }`}
              >
                <InstrumentPicture id={id} className="size-9" />
              </button>
            );
          })}
        </div>
      </Panel>
      <Panel position="bottom-right">
        <div className="flex items-end gap-2" {...ui}>
          {INSTRUMENT_IDS.filter((id) => open[id]).map((id) => {
            const InstrumentView = PANELS[id];
            return <InstrumentView key={id} />;
          })}
        </div>
      </Panel>
      <PlacingGhost />
    </>
  );
}
