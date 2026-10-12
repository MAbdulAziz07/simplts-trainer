// Bacaan alat ukur → teks layar LCD: angka berdesimal koma, satuan, dan tanda DC/AC.
import {
  meterDigits,
  ohmDigits,
  type ClampMode,
  type MeterFunction,
  type MeterReading,
} from '@/domain';
import { t } from '@/i18n';

export interface LcdDisplay {
  /** Angka, atau `OL` di luar batas ukur. */
  text: string;
  unit: string;
  /** Tanda `DC`/`AC`; kosong untuk ohm dan iradiasi. */
  mark: string;
}

const comma = (digits: string) => digits.replace('.', ',');

export function multimeterDisplay(reading: MeterReading, fn: MeterFunction): LcdDisplay {
  const mark = t.instruments.marks[fn];
  if (fn !== 'ohm') {
    const text =
      reading.kind === 'overload' ? t.instruments.overload : comma(meterDigits(reading.value).text);
    return { text, unit: t.instruments.units.volt, mark };
  }
  if (reading.kind === 'overload') {
    return { text: t.instruments.overload, unit: t.instruments.units.ohm, mark };
  }
  const { text, scale } = ohmDigits(reading.value);
  return { text: comma(text), unit: `${scale}${t.instruments.units.ohm}`, mark };
}

export function clampDisplay(reading: MeterReading, mode: ClampMode): LcdDisplay {
  const text =
    reading.kind === 'overload' ? t.instruments.overload : comma(meterDigits(reading.value).text);
  return { text, unit: t.instruments.units.ampere, mark: t.instruments.marks[mode] };
}

export function solarDisplay(irradianceWm2: number): LcdDisplay {
  return {
    text: String(Math.round(irradianceWm2)),
    unit: t.instruments.units.irradiance,
    mark: '',
  };
}
