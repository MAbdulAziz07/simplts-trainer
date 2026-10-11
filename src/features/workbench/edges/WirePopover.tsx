import { Minus, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Wire } from '@/domain';
import { t } from '@/i18n';
import {
  WIRE_AREAS_MM2,
  WIRE_LENGTH_MAX_M,
  WIRE_LENGTH_MIN_M,
  WIRE_LENGTH_STEP_M,
  cableAreasMm2,
  cableItems,
  useCircuitStore,
} from '@/store';

const CHIP = 'h-11 rounded-lg border text-sm font-medium disabled:opacity-30';
const chipClass = (isActive: boolean): string =>
  `${CHIP} ${isActive ? 'border-brand bg-brand text-white' : 'border-line bg-white'}`;
const ICON_BUTTON =
  'border-line flex size-11 items-center justify-center rounded-lg border bg-white';

/** Kotak angka panjang; nilai baru dikirim saat Enter atau saat fokus pindah. */
function LengthInput({ lengthM, onCommit }: { lengthM: number; onCommit: (m: number) => void }) {
  const shown = lengthM.toLocaleString('id-ID');
  const [text, setText] = useState(shown);
  const commit = () => {
    const value = Number(text.replace(',', '.'));
    if (Number.isFinite(value) && value > 0) onCommit(value);
    else setText(shown);
  };
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={t.wire.length}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
      className="border-line h-11 w-16 rounded-lg border bg-white text-center text-base tabular-nums"
    />
  );
}

/** Pilihan satu kabel: jenis, penampang (mm²), dan panjang satu penghantar (m). */
export function WirePopover({ wire }: { wire: Wire }) {
  const updateWire = useCircuitStore((state) => state.updateWire);
  const removeSelected = useCircuitStore((state) => state.removeSelected);
  const cable = cableItems.find((item) => item.id === wire.cableId);
  const available = cable ? cableAreasMm2(cable) : [];
  const setLength = (lengthM: number) => updateWire(wire.id, { lengthM });

  return (
    <div
      role="dialog"
      aria-label={t.wire.properties(wire.id)}
      className="border-line bg-card flex w-[300px] flex-col gap-2 rounded-xl border p-2 shadow-lg"
    >
      <div role="radiogroup" aria-label={t.wire.cableType} className="grid grid-cols-2 gap-1">
        {cableItems.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={item.id === wire.cableId}
            onClick={() => updateWire(wire.id, { cableId: item.id })}
            className={`${chipClass(item.id === wire.cableId)} px-1 text-xs`}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div role="radiogroup" aria-label={t.wire.area} className="grid grid-cols-4 gap-1">
        {WIRE_AREAS_MM2.map((areaMm2) => (
          <button
            key={areaMm2}
            type="button"
            role="radio"
            aria-checked={areaMm2 === wire.areaMm2}
            aria-label={t.wire.areaOption(areaMm2)}
            disabled={!available.includes(areaMm2)}
            onClick={() => updateWire(wire.id, { areaMm2 })}
            className={chipClass(areaMm2 === wire.areaMm2)}
          >
            {areaMm2.toLocaleString('id-ID')}
          </button>
        ))}
        <span className="text-ink-muted flex items-center justify-center text-xs">mm²</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={t.wire.shorter}
          disabled={wire.lengthM <= WIRE_LENGTH_MIN_M}
          onClick={() => setLength(wire.lengthM - WIRE_LENGTH_STEP_M)}
          className={`${ICON_BUTTON} disabled:opacity-30`}
        >
          <Minus aria-hidden size={18} />
        </button>
        <LengthInput key={wire.lengthM} lengthM={wire.lengthM} onCommit={setLength} />
        <button
          type="button"
          aria-label={t.wire.longer}
          disabled={wire.lengthM >= WIRE_LENGTH_MAX_M}
          onClick={() => setLength(wire.lengthM + WIRE_LENGTH_STEP_M)}
          className={`${ICON_BUTTON} disabled:opacity-30`}
        >
          <Plus aria-hidden size={18} />
        </button>
        <span className="text-ink-muted text-sm">{t.wire.lengthUnit}</span>
        <button
          type="button"
          aria-label={t.wire.remove}
          title={t.wire.remove}
          onClick={removeSelected}
          className={`${ICON_BUTTON} text-status-danger ml-auto`}
        >
          <Trash2 aria-hidden size={18} />
        </button>
      </div>
    </div>
  );
}
