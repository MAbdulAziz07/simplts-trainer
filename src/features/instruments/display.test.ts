import { describe, expect, it } from 'vitest';
import type { MeterReading } from '@/domain';
import { clampDisplay, multimeterDisplay, solarDisplay } from './display';

const value = (amount: number): MeterReading => ({ kind: 'value', value: amount });
const OL: MeterReading = { kind: 'overload' };

describe('multimeterDisplay', () => {
  it('tegangan: desimal koma, satuan V, tanda DC atau AC', () => {
    expect(multimeterDisplay(value(12.734), 'vdc')).toEqual({
      text: '12,73',
      unit: 'V',
      mark: 'DC',
    });
    expect(multimeterDisplay(value(-12.734), 'vdc').text).toBe('-12,73');
    expect(multimeterDisplay(value(219.6), 'vac')).toEqual({ text: '220', unit: 'V', mark: 'AC' });
  });

  it('ohm: Ω, kΩ, dan OL', () => {
    expect(multimeterDisplay(value(0.92), 'ohm')).toEqual({ text: '0,9', unit: 'Ω', mark: '' });
    expect(multimeterDisplay(value(4700), 'ohm')).toEqual({ text: '4,70', unit: 'kΩ', mark: '' });
    expect(multimeterDisplay(OL, 'ohm')).toEqual({ text: 'OL', unit: 'Ω', mark: '' });
    expect(multimeterDisplay(OL, 'vdc').text).toBe('OL');
  });
});

describe('clampDisplay dan solarDisplay', () => {
  it('arus bertanda dengan satuan A', () => {
    expect(clampDisplay(value(-5.912), 'dc')).toEqual({ text: '-5,91', unit: 'A', mark: 'DC' });
    expect(clampDisplay(value(2.3), 'ac')).toEqual({ text: '2,30', unit: 'A', mark: 'AC' });
    expect(clampDisplay(OL, 'dc').text).toBe('OL');
  });

  it('iradiasi dibulatkan ke W/m²', () => {
    expect(solarDisplay(812.6)).toEqual({ text: '813', unit: 'W/m²', mark: '' });
  });
});
