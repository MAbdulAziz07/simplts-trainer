// Bacaan multimeter dan tang ampere dari potensial terminal dan arus kabel hasil simulasi
// (docs/PRD.md US11, US12). Fungsi murni; derau diberikan lewat `random` (0..1) dari pemanggil.
import type { Netlist, TerminalRef } from '../circuit/types';

export const METER_FUNCTIONS = ['vdc', 'vac', 'ohm'] as const;
export type MeterFunction = (typeof METER_FUNCTIONS)[number];

export const CLAMP_MODES = ['dc', 'ac'] as const;
export type ClampMode = (typeof CLAMP_MODES)[number];

/** Jenis tegangan pada sebuah net: dari kutub DC/PV, dari fasa/netral AC, atau bukan keduanya. */
export type SupplyKind = 'dc' | 'ac' | 'none';

/** Derau bacaan ±0,5%. */
export const METER_NOISE_FRACTION = 0.005;
/** Batas ukur: di atasnya alat menampilkan "OL". */
export const VDC_MAX_V = 1000;
export const VAC_MAX_V = 750;
export const OHM_MAX = 20e6;
export const CLAMP_MAX_A = 400;
/** Beda tegangan terkecil yang membuat fungsi ohm tidak sah (rangkaian masih bertegangan). */
export const LIVE_THRESHOLD_V = 0.05;
/** Tahanan kabel probe yang ikut terbaca. [PERLU VERIFIKASI] */
export const LEAD_RESISTANCE_OHM = 0.2;
/** Simpangan bacaan saat fungsi tidak cocok dengan jenis tegangan (mis. VDC pada AC). */
const MISMATCH_JITTER = 0.2;
/** Bacaan ohm pada rangkaian bertegangan: angka acak sampai nilai ini, atau "OL". */
const ERRATIC_OHM_SPAN = 1999;

export type MeterReading = { kind: 'value'; value: number } | { kind: 'overload' };

/** Jenis tegangan net tempat terminal berada; terminal lepas atau tak dikenal = `none`. */
export function supplyKindOf(netlist: Netlist, ref: TerminalRef | undefined): SupplyKind {
  const netId = ref && netlist.netIdByTerminal[ref.componentId]?.[ref.terminalId];
  const kinds = netlist.nets.find((net) => net.id === netId)?.kinds ?? [];
  if (kinds.includes('acL') || kinds.includes('acN')) return 'ac';
  if (kinds.some((kind) => kind === 'dc+' || kind === 'dc-' || kind === 'pv+' || kind === 'pv-')) {
    return 'dc';
  }
  return 'none';
}

/** Titik yang disentuh probe. */
export interface ProbePoint {
  /** Potensial terminal terhadap acuan busnya. */
  voltageV: number;
  /** Potensial tidak ditentukan sumber mana pun. */
  floating: boolean;
  supply: SupplyKind;
}

export interface ProbeVoltage {
  /** Merah − hitam; negatif bila probe terbalik. */
  dcV: number;
  /** Tegangan efektif AC, selalu ≥ 0. */
  acV: number;
}

/**
 * Tegangan antara probe merah dan hitam. Probe yang lepas atau mengambang tidak memberi tegangan.
 * Satu probe di sisi AC dan satu di sisi DC dianggap tanpa acuan bersama: 0 V.
 */
export function probeVoltage(red?: ProbePoint, black?: ProbePoint): ProbeVoltage {
  if (!red || !black || red.floating || black.floating) return { dcV: 0, acV: 0 };
  const diffV = red.voltageV - black.voltageV;
  const supplies = [red.supply, black.supply];
  if (supplies.includes('ac') && supplies.includes('dc')) return { dcV: 0, acV: 0 };
  return supplies.includes('ac') ? { dcV: 0, acV: Math.abs(diffV) } : { dcV: diffV, acV: 0 };
}

const withNoise = (value: number, random: () => number): number =>
  value * (1 + METER_NOISE_FRACTION * (2 * random() - 1));

const ranged = (value: number, maxAbs: number): MeterReading =>
  Math.abs(value) > maxAbs ? { kind: 'overload' } : { kind: 'value', value };

export interface MultimeterInput {
  fn: MeterFunction;
  red?: ProbePoint;
  black?: ProbePoint;
  /** Tahanan rangkaian antara kedua probe; `Infinity` bila terbuka atau ada probe yang lepas. */
  resistanceOhm: number;
  /** Bilangan acak 0..1 untuk derau. */
  random: () => number;
}

/**
 * Satu cuplikan bacaan multimeter. Fungsi yang salah berperilaku seperti alat nyata: VDC pada AC
 * dan VAC pada DC terbaca sekitar nol; ohm pada rangkaian bertegangan memberi angka tak bermakna
 * atau "OL"; ohm pada rangkaian terbuka memberi "OL".
 */
export function readMultimeter(input: MultimeterInput): MeterReading {
  const { fn, random } = input;
  const { dcV, acV } = probeVoltage(input.red, input.black);
  if (fn === 'vdc') {
    const jitterV = acV > 0 ? MISMATCH_JITTER * (2 * random() - 1) : 0;
    return ranged(withNoise(dcV, random) + jitterV, VDC_MAX_V);
  }
  if (fn === 'vac') return ranged(withNoise(acV, random), VAC_MAX_V);

  if (Math.abs(dcV) > LIVE_THRESHOLD_V || acV > LIVE_THRESHOLD_V) {
    const isOverload = random() < 0.5;
    return isOverload
      ? { kind: 'overload' }
      : { kind: 'value', value: ERRATIC_OHM_SPAN * (2 * random() - 1) };
  }
  if (!Number.isFinite(input.resistanceOhm)) return { kind: 'overload' };
  return ranged(withNoise(input.resistanceOhm + LEAD_RESISTANCE_OHM, random), OHM_MAX);
}

export interface ClampInput {
  mode: ClampMode;
  /** Arus kabel bertanda: positif = dari `wire.from` ke `wire.to`. */
  flowA: number;
  /** Jenis tegangan net kabel yang dijepit. */
  supply: SupplyKind;
  random: () => number;
}

/**
 * Satu cuplikan bacaan tang ampere pada satu kabel. Mode DC menampilkan arus bertanda (arah),
 * mode AC menampilkan besarnya; mode yang tidak cocok dengan jenis arus terbaca nol.
 */
export function readClamp({ mode, flowA, supply, random }: ClampInput): MeterReading {
  const matches = supply === mode;
  const valueA = !matches ? 0 : mode === 'dc' ? flowA : Math.abs(flowA);
  return ranged(withNoise(valueA, random), CLAMP_MAX_A);
}

export type MeterScale = '' | 'k' | 'M';

export interface MeterDigits {
  /** Angka dengan titik desimal, mis. `12.73`. */
  text: string;
  /** Awalan satuan: kosong, kilo, atau mega (hanya fungsi ohm). */
  scale: MeterScale;
}

/** Jumlah desimal alat 3½ digit (1999 cacah) untuk nilai sebesar ini. */
function decimalsFor(magnitude: number): number {
  if (magnitude < 2) return 3;
  if (magnitude < 20) return 2;
  if (magnitude < 200) return 1;
  return 0;
}

/** Angka tampilan volt atau ampere dengan rentang otomatis. */
export function meterDigits(value: number): MeterDigits {
  const rounded = value.toFixed(decimalsFor(Math.abs(value)));
  // `-0.000` ditampilkan tanpa tanda minus.
  return { text: Number(rounded) === 0 ? rounded.replace('-', '') : rounded, scale: '' };
}

/** Angka tampilan ohm: di bawah 200 Ω satu desimal, lalu Ω, kΩ, dan MΩ. */
export function ohmDigits(valueOhm: number): MeterDigits {
  const magnitude = Math.abs(valueOhm);
  if (magnitude < 200) return { text: valueOhm.toFixed(1), scale: '' };
  if (magnitude < 2000) return { text: valueOhm.toFixed(0), scale: '' };
  if (magnitude < 2e6) {
    const kilo = valueOhm / 1e3;
    return { text: kilo.toFixed(decimalsFor(Math.abs(kilo))), scale: 'k' };
  }
  const mega = valueOhm / 1e6;
  return { text: mega.toFixed(decimalsFor(Math.abs(mega))), scale: 'M' };
}
