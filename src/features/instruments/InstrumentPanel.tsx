import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '@/i18n';
import { useInstrumentStore, type InstrumentId, type PlacingTool } from '@/store';
import { componentImage } from '@/ui';
import type { LcdDisplay } from './display';
import { beginPlacing } from './placing';

const INSTRUMENT_IMAGE: Record<InstrumentId, string> = {
  multimeter: 'src/assets/components/instrument-multimeter.webp',
  clamp: 'src/assets/components/instrument-clamp-meter.webp',
  solar: 'src/assets/components/instrument-solar-meter.webp',
};

export function InstrumentPicture({ id, className }: { id: InstrumentId; className: string }) {
  const image = componentImage(INSTRUMENT_IMAGE[id]);
  return image ? (
    <img src={image.url} alt="" draggable={false} className={`object-contain ${className}`} />
  ) : null;
}

/** Layar LCD alat: tanda DC/AC, angka besar tabular, dan satuan (docs/UX.md §2.5). */
function MeterLcd({ label, display }: { label: string; display: LcdDisplay }) {
  return (
    <div role="group" aria-label={label} className="meter-lcd">
      <span className="meter-mark">{display.mark}</span>
      <span className="meter-digits">{display.text}</span>
      <span className="meter-unit">{display.unit}</span>
    </div>
  );
}

interface InstrumentPanelProps {
  id: InstrumentId;
  display: LcdDisplay;
  children?: ReactNode;
}

/** Bingkai sebuah alat ukur: gambar, nama, tombol tutup, layar, lalu kendalinya. */
export function InstrumentPanel({ id, display, children }: InstrumentPanelProps) {
  const toggle = useInstrumentStore((state) => state.toggle);
  const name = t.instruments.names[id];
  return (
    <section aria-label={name} className="instrument-panel" data-instrument={id}>
      <header className="flex items-center gap-2">
        <InstrumentPicture id={id} className="size-8" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</h2>
        <button
          type="button"
          aria-label={t.instruments.close(name)}
          title={t.instruments.close(name)}
          onClick={() => toggle(id)}
          className="hover:bg-app -m-1 flex size-11 items-center justify-center rounded-lg"
        >
          <X aria-hidden size={20} />
        </button>
      </header>
      <MeterLcd label={t.instruments.reading(name)} display={display} />
      {children}
    </section>
  );
}

interface OptionGroupProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T;
  text: Record<T, string>;
  hints: Record<T, string>;
  onChange: (value: T) => void;
}

/** Pilihan fungsi/mode alat: tombol 44 px, satu yang aktif. */
export function OptionGroup<T extends string>(props: OptionGroupProps<T>) {
  return (
    <div role="radiogroup" aria-label={props.label} className="bg-app flex rounded-lg p-1">
      {props.options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === props.value}
          aria-label={props.hints[option]}
          title={props.hints[option]}
          onClick={() => props.onChange(option)}
          className={`h-11 min-w-11 flex-1 rounded-md px-2 text-base font-bold ${
            option === props.value ? 'bg-brand text-white' : 'text-ink-muted hover:text-ink'
          }`}
        >
          {props.text[option]}
        </button>
      ))}
    </div>
  );
}

interface ToolChipProps {
  tool: PlacingTool;
  /** Nama sasaran tempat alat menempel; kosong bila masih di panel. */
  target?: string;
}

/**
 * Probe atau jepitan di panel alat: diseret ke terminal/kabel, atau diketuk lalu sasarannya
 * diketuk. Menampilkan tempatnya menempel.
 */
export function ToolChip({ tool, target }: ToolChipProps) {
  const isPlacing = useInstrumentStore((state) => state.placing === tool);
  const label = target
    ? t.instruments.toolAt(t.instruments.tools[tool], target)
    : t.instruments.toolParked[tool];
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={isPlacing}
      data-tool={tool}
      onPointerDown={(event) => beginPlacing(tool, event)}
      className="tool-chip"
    >
      <span
        aria-hidden
        className="tool-chip-icon"
        data-away={Boolean(target) || isPlacing || undefined}
      />
      <span className="truncate">{target ?? t.instruments.parked}</span>
    </button>
  );
}
