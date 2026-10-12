import { describe, expect, it } from 'vitest';
import { buildNetlist } from '../circuit/graph';
import { place, ref, wire } from '../circuit/validate-fixtures';
import {
  LEAD_RESISTANCE_OHM,
  meterDigits,
  ohmDigits,
  probeVoltage,
  readClamp,
  readMultimeter,
  supplyKindOf,
} from './multimeter';
import type { ProbePoint } from './multimeter';

const point = (voltageV: number, supply: ProbePoint['supply'] = 'dc'): ProbePoint => ({
  voltageV,
  floating: false,
  supply,
});
/** Derau di tengah rentang: bacaan tanpa simpangan. */
const MID = () => 0.5;
const HIGH = () => 1;
const LOW = () => 0;

describe('supplyKindOf', () => {
  const netlist = buildNetlist(
    [place('bat1', 'battery'), place('inv1', 'inverter-offgrid'), place('lamp1', 'load-ac')],
    [wire('bat1.pos', 'inv1.dc-pos'), wire('inv1.ac-l', 'lamp1.a')],
  );

  it('kutub DC = dc, fasa/netral = ac, PE dan terminal tak dikenal = none', () => {
    expect(supplyKindOf(netlist, ref('bat1.pos'))).toBe('dc');
    expect(supplyKindOf(netlist, ref('bat1.neg'))).toBe('dc');
    expect(supplyKindOf(netlist, ref('lamp1.a'))).toBe('ac');
    expect(supplyKindOf(netlist, ref('inv1.ac-n'))).toBe('ac');
    expect(supplyKindOf(netlist, ref('inv1.pe'))).toBe('none');
    expect(supplyKindOf(netlist, ref('hilang.x'))).toBe('none');
    expect(supplyKindOf(netlist, undefined)).toBe('none');
  });
});

describe('probeVoltage', () => {
  it('DC: merah − hitam, negatif bila probe terbalik', () => {
    expect(probeVoltage(point(12.7), point(0))).toEqual({ dcV: 12.7, acV: 0 });
    expect(probeVoltage(point(0), point(12.7))).toEqual({ dcV: -12.7, acV: 0 });
  });

  it('AC: tegangan efektif tanpa tanda', () => {
    expect(probeVoltage(point(220, 'ac'), point(0, 'ac'))).toEqual({ dcV: 0, acV: 220 });
    expect(probeVoltage(point(0, 'ac'), point(220, 'ac'))).toEqual({ dcV: 0, acV: 220 });
  });

  it('probe lepas, mengambang, atau AC terhadap DC: 0 V', () => {
    expect(probeVoltage(point(12.7), undefined)).toEqual({ dcV: 0, acV: 0 });
    expect(probeVoltage(point(12.7), { ...point(0), floating: true })).toEqual({ dcV: 0, acV: 0 });
    expect(probeVoltage(point(220, 'ac'), point(0, 'dc'))).toEqual({ dcV: 0, acV: 0 });
  });
});

describe('readMultimeter', () => {
  const base = { resistanceOhm: Infinity, random: MID };

  it('VDC membaca tegangan DC dengan derau paling besar 0,5%', () => {
    const input = {
      fn: 'vdc' as const,
      red: point(12.7),
      black: point(0),
      resistanceOhm: Infinity,
    };
    expect(readMultimeter({ ...input, random: MID })).toEqual({ kind: 'value', value: 12.7 });
    const high = readMultimeter({ ...input, random: HIGH });
    const low = readMultimeter({ ...input, random: LOW });
    expect(high).toMatchObject({ kind: 'value' });
    expect(low).toMatchObject({ kind: 'value' });
    if (high.kind !== 'value' || low.kind !== 'value') return;
    expect(high.value).toBeCloseTo(12.7 * 1.005, 9);
    expect(low.value).toBeCloseTo(12.7 * 0.995, 9);
  });

  it('probe terbalik memberi tanda minus', () => {
    const reading = readMultimeter({ ...base, fn: 'vdc', red: point(0), black: point(12.7) });
    expect(reading).toEqual({ kind: 'value', value: -12.7 });
  });

  it('VAC membaca tegangan efektif AC', () => {
    const reading = readMultimeter({
      ...base,
      fn: 'vac',
      red: point(220, 'ac'),
      black: point(0, 'ac'),
    });
    expect(reading).toEqual({ kind: 'value', value: 220 });
  });

  it('salah fungsi: VDC pada AC dan VAC pada DC terbaca sekitar nol', () => {
    const ac = { red: point(220, 'ac'), black: point(0, 'ac') };
    const vdcOnAc = readMultimeter({ ...base, ...ac, fn: 'vdc', random: HIGH });
    expect(vdcOnAc.kind === 'value' && Math.abs(vdcOnAc.value)).toBeLessThan(0.5);
    const vacOnDc = readMultimeter({ ...base, fn: 'vac', red: point(12.7), black: point(0) });
    expect(vacOnDc).toEqual({ kind: 'value', value: 0 });
  });

  it('ohm pada rangkaian tidak bertegangan: tahanan + kabel probe; terbuka = OL', () => {
    const dead = { fn: 'ohm' as const, red: point(0), black: point(0), random: MID };
    expect(readMultimeter({ ...dead, resistanceOhm: 0.72 })).toEqual({
      kind: 'value',
      value: 0.72 + LEAD_RESISTANCE_OHM,
    });
    expect(readMultimeter({ ...dead, resistanceOhm: Infinity })).toEqual({ kind: 'overload' });
    expect(readMultimeter({ ...dead, resistanceOhm: 50e6 })).toEqual({ kind: 'overload' });
  });

  it('ohm dengan probe lepas = OL', () => {
    expect(readMultimeter({ ...base, fn: 'ohm' })).toEqual({ kind: 'overload' });
  });

  it('ohm pada rangkaian bertegangan: OL atau angka tak bermakna, bukan tahanan sebenarnya', () => {
    const live = { fn: 'ohm' as const, red: point(12.7), black: point(0), resistanceOhm: 0.72 };
    expect(readMultimeter({ ...live, random: LOW })).toEqual({ kind: 'overload' });
    const erratic = readMultimeter({ ...live, random: HIGH });
    expect(erratic.kind === 'value' && Math.abs(erratic.value)).toBeGreaterThan(100);
    const liveAc = { ...live, red: point(220, 'ac'), black: point(0, 'ac') };
    expect(readMultimeter({ ...liveAc, random: LOW })).toEqual({ kind: 'overload' });
  });

  it('di atas batas ukur menampilkan OL', () => {
    const reading = readMultimeter({ ...base, fn: 'vdc', red: point(1200), black: point(0) });
    expect(reading).toEqual({ kind: 'overload' });
  });
});

describe('readClamp', () => {
  it('mode DC menampilkan arus bertanda; mode AC menampilkan besarnya', () => {
    const dc = { mode: 'dc' as const, supply: 'dc' as const, random: MID };
    expect(readClamp({ ...dc, flowA: 5.9 })).toEqual({ kind: 'value', value: 5.9 });
    expect(readClamp({ ...dc, flowA: -5.9 })).toEqual({ kind: 'value', value: -5.9 });
    const ac = { mode: 'ac' as const, supply: 'ac' as const, random: MID };
    expect(readClamp({ ...ac, flowA: -2.3 })).toEqual({ kind: 'value', value: 2.3 });
  });

  it('mode yang tidak cocok dengan jenis arus terbaca nol', () => {
    expect(readClamp({ mode: 'ac', supply: 'dc', flowA: 5.9, random: MID })).toEqual({
      kind: 'value',
      value: 0,
    });
    expect(readClamp({ mode: 'dc', supply: 'ac', flowA: 2.3, random: MID })).toEqual({
      kind: 'value',
      value: 0,
    });
  });

  it('derau paling besar 0,5% dan batas ukur 400 A', () => {
    const reading = readClamp({ mode: 'dc', supply: 'dc', flowA: 10, random: HIGH });
    expect(reading.kind === 'value' && reading.value).toBeCloseTo(10.05, 9);
    expect(readClamp({ mode: 'dc', supply: 'dc', flowA: 500, random: MID })).toEqual({
      kind: 'overload',
    });
  });
});

describe('meterDigits dan ohmDigits', () => {
  it('rentang otomatis 3½ digit', () => {
    expect(meterDigits(1.2345)).toEqual({ text: '1.234', scale: '' });
    expect(meterDigits(12.734)).toEqual({ text: '12.73', scale: '' });
    expect(meterDigits(-12.734)).toEqual({ text: '-12.73', scale: '' });
    expect(meterDigits(219.96)).toEqual({ text: '220', scale: '' });
    expect(meterDigits(131.25)).toEqual({ text: '131.3', scale: '' });
    expect(meterDigits(-0.0001)).toEqual({ text: '0.000', scale: '' });
  });

  it('ohm: Ω, kΩ, dan MΩ', () => {
    expect(ohmDigits(0.92)).toEqual({ text: '0.9', scale: '' });
    expect(ohmDigits(96.8)).toEqual({ text: '96.8', scale: '' });
    expect(ohmDigits(968)).toEqual({ text: '968', scale: '' });
    expect(ohmDigits(4700)).toEqual({ text: '4.70', scale: 'k' });
    expect(ohmDigits(150_000)).toEqual({ text: '150.0', scale: 'k' });
    expect(ohmDigits(4.7e6)).toEqual({ text: '4.70', scale: 'M' });
  });
});
