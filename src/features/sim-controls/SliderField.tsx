import type { LucideIcon } from 'lucide-react';
import { t } from '@/i18n';

interface SliderFieldProps {
  icon: LucideIcon;
  /** Nama besaran; menjadi nama aksesibel slider. */
  label: string;
  /** Nilai dengan satuannya, mis. `850 W/m²`. */
  valueText: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  /** Besaran yang bisa mengikuti jam: tombol "A" menyala saat otomatis. */
  auto?: { on: boolean; onEnable: () => void };
  /** Awal dan akhir satu seretan ibu jari slider, mis. untuk menjadikannya satu langkah undo. */
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
}

/** Satu besaran lingkungan: ikon, angka, slider, dan (bila ada) tombol kembali ke otomatis. */
export function SliderField(props: SliderFieldProps) {
  const { icon: Icon, label, valueText, auto } = props;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2" title={label}>
      <Icon aria-hidden size={20} className="text-ink-muted shrink-0" />
      {/* Nilai yang sama dibacakan lewat `aria-valuetext` slider. */}
      <span aria-hidden className="w-[76px] shrink-0 text-sm font-semibold tabular-nums">
        {valueText}
      </span>
      <input
        type="range"
        className="sim-range min-w-0 flex-1"
        aria-label={label}
        aria-valuetext={valueText}
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
        onPointerDown={props.onGestureStart}
        onPointerUp={props.onGestureEnd}
        onPointerCancel={props.onGestureEnd}
        onBlur={props.onGestureEnd}
      />
      {auto && (
        <button
          type="button"
          aria-label={t.sim.auto(label)}
          title={t.sim.auto(label)}
          aria-pressed={auto.on}
          onClick={auto.onEnable}
          className="flex size-11 shrink-0 items-center justify-center"
        >
          <span
            className={`flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold ${
              auto.on ? 'border-brand bg-brand text-white' : 'border-control text-control bg-card'
            }`}
          >
            {t.sim.autoMark}
          </span>
        </button>
      )}
    </div>
  );
}
