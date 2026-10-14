// Parameter komponen yang bisa diatur manual: rating utama tiap kategori (sama dengan kotak rating
// di inspektur). Nilai default = nilai katalog; ubahan disimpan per komponen di berkas rangkaian.
import type { ComponentCategory } from '../types';
import { FUSE_CLASSES } from './protection';
import { TRIP_CURVES } from './shared';

/** Nilai ubahan per kunci parameter, mis. `{ ratedA: 25, curve: 'B' }`. */
export type ComponentParams = Readonly<Record<string, number | string>>;

interface ParamBase {
  /** Kunci unik per kategori; juga kunci teks di `t.inspector.rating`. */
  key: string;
  /** Nama field di `electrical` dan/atau `protection`; diisi di keduanya bila ada. */
  field: string;
}

export interface NumberParamSpec extends ParamBase {
  kind: 'number';
  unit: string;
}

export interface ChoiceParamSpec extends ParamBase {
  kind: 'choice';
  options: readonly string[];
}

/** Hanya tampil: terikat gambar dan terminal, atau model fisika (mis. jumlah sel baterai). */
export interface FixedParamSpec extends ParamBase {
  kind: 'fixed';
  unit: string;
}

export type ParamSpec = NumberParamSpec | ChoiceParamSpec | FixedParamSpec;

const num = (key: string, field: string, unit = ''): NumberParamSpec => ({
  key,
  field,
  unit,
  kind: 'number',
});
const fixed = (key: string, field: string, unit = ''): FixedParamSpec => ({
  key,
  field,
  unit,
  kind: 'fixed',
});
const choice = (key: string, field: string, options: readonly string[]): ChoiceParamSpec => ({
  key,
  field,
  options,
  kind: 'choice',
});

const MCB_COMMON = [num('ratedA', 'ratedCurrentA', 'A'), choice('curve', 'curve', TRIP_CURVES)];
const INVERTER_COMMON = [
  num('acPower', 'ratedAcPowerW', 'W'),
  num('dcV', 'nominalDcV', 'V'),
  num('acV', 'acOutputVoltageV', 'V'),
];
const LOAD = [num('maxPower', 'maxPowerW', 'W'), num('nominalV', 'ratedVoltageV', 'V')];

/** Urutan = urutan tampil. Kabel tidak punya parameter di sini (penampang dan panjang per kabel). */
export const PARAM_SPECS: Readonly<Record<ComponentCategory, readonly ParamSpec[]>> = {
  'pv-module': [
    num('pmax', 'pmaxW', 'W'),
    num('voc', 'vocV', 'V'),
    num('isc', 'iscA', 'A'),
    num('vmp', 'vmpV', 'V'),
  ],
  'scc-pwm': [
    fixed('systemV', 'batteryVoltagesV', 'V'),
    num('chargeA', 'chargeCurrentMaxA', 'A'),
    num('loadA', 'loadCurrentMaxA', 'A'),
    num('pvVocMax12', 'pvVocMax12VV', 'V'),
    num('pvVocMax24', 'pvVocMax24VV', 'V'),
  ],
  'scc-mppt': [
    num('systemV', 'batteryNominalV', 'V'),
    num('chargeA', 'chargeCurrentMaxA', 'A'),
    num('pvVocMax', 'pvVocMaxV', 'V'),
    num('pvPowerMax', 'pvPowerMaxW', 'W'),
  ],
  battery: [
    fixed('nominalV', 'nominalVoltageV', 'V'),
    num('capacity', 'capacityAh', 'Ah'),
    num('chargeA', 'chargeCurrentMaxA', 'A'),
    num('dischargeA', 'dischargeCurrentMaxA', 'A'),
  ],
  bms: [
    num('nominalV', 'nominalVoltageV', 'V'),
    num('chargeA', 'chargeCurrentMaxA', 'A'),
    num('dischargeA', 'dischargeCurrentMaxA', 'A'),
  ],
  'inverter-offgrid': [...INVERTER_COMMON, num('lvd', 'dcVoltageLvdV', 'V')],
  'inverter-hybrid': [...INVERTER_COMMON, num('pvVocMax', 'pvVocMaxV', 'V')],
  'inverter-gridtie': [
    num('acPower', 'ratedAcPowerW', 'W'),
    num('mpptMin', 'mpptMinV', 'V'),
    num('mpptMax', 'mpptMaxV', 'V'),
    num('pvVocMax', 'dcVocMaxV', 'V'),
    num('inputA', 'dcCurrentMaxA', 'A'),
  ],
  'mcb-dc': [
    ...MCB_COMMON,
    num('nominalV', 'ratedVoltageDcV', 'V'),
    num('breaking', 'breakingCapacityKa', 'kA'),
  ],
  'mcb-ac': [
    ...MCB_COMMON,
    num('nominalV', 'ratedVoltageAcV', 'V'),
    num('breaking', 'breakingCapacityKa', 'kA'),
  ],
  fuse: [
    num('ratedA', 'ratedCurrentA', 'A'),
    num('nominalV', 'ratedVoltageDcV', 'V'),
    choice('fuseClass', 'class', FUSE_CLASSES),
    num('breaking', 'breakingCapacityKa', 'kA'),
  ],
  spd: [
    num('uc', 'continuousVoltageUcV', 'V'),
    num('up', 'protectionLevelUpKv', 'kV'),
    num('surge', 'nominalDischargeCurrentKa', 'kA'),
  ],
  combiner: [
    fixed('inputs', 'stringInputs'),
    num('ratedA', 'ratedCurrentA', 'A'),
    num('nominalV', 'ratedVoltageDcV', 'V'),
    num('stringFuse', 'fusePerStringA', 'A'),
  ],
  cable: [],
  'kwh-meter': [
    num('maxA', 'currentMaxA', 'A'),
    num('maxV', 'voltageMaxV', 'V'),
    num('accuracy', 'accuracyClass'),
  ],
  busbar: [
    fixed('positions', 'positions'),
    num('ratedA', 'ratedCurrentA', 'A'),
    num('nominalV', 'ratedVoltageV', 'V'),
  ],
  grounding: [num('earthR', 'earthResistanceOhm', 'Ω')],
  'load-panel': [
    num('ratedA', 'ratedCurrentA', 'A'),
    num('nominalV', 'ratedVoltageAcV', 'V'),
    fixed('circuits', 'circuitCount'),
    num('circuitA', 'circuitBreakerA', 'A'),
  ],
  'load-dc': LOAD,
  'load-ac': LOAD,
  grid: [num('nominalV', 'nominalVoltageV', 'V'), num('frequency', 'frequencyHz', 'Hz')],
};
