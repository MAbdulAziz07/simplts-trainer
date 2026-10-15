import type { LucideIcon } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';
import { nextRadioIndex } from './radio-keys';

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  title?: string;
}

interface SegmentedRadioProps<T extends string> {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (id: T) => void;
}

/**
 * Kelompok radio bersegmen di bilah atas. Satu titik Tab (pilihan aktif); panah dan Home/End
 * memindah pilihan. Tiap segmen setinggi 44 px (target sentuh, docs/UX.md).
 */
export function SegmentedRadio<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedRadioProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent, index: number): void => {
    const next = nextRadioIndex(event.key, index, options.length);
    const option = next === undefined ? undefined : options[next];
    if (next === undefined || !option) return;
    event.preventDefault();
    onChange(option.id);
    buttons.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className="bg-app flex rounded-lg p-1">
      {options.map((option, index) => {
        const isOn = option.id === value;
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={isOn}
            tabIndex={isOn ? 0 : -1}
            title={option.title}
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`flex h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium ${
              isOn ? 'bg-brand text-white' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {Icon && <Icon aria-hidden size={16} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
