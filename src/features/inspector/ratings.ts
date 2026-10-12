// Rating utama sebuah item katalog untuk inspektur: paling banyak empat angka yang paling
// menentukan cara merangkainya (docs/UX.md §1 butir 8).
import type { CatalogItem } from '@/domain';
import { t } from '@/i18n';

export type RatingKey = keyof typeof t.inspector.rating;

export interface Rating {
  key: RatingKey;
  /** Angka siap tampil (desimal koma), mis. `12,8` atau `12/24`. */
  text: string;
  unit: string;
}

export const MAX_RATINGS = 4;

const number = (value: number): string =>
  value.toLocaleString('id-ID', { maximumFractionDigits: 2 });

const rating = (key: RatingKey, value: number | string, unit = ''): Rating => ({
  key,
  text: typeof value === 'number' ? number(value) : value,
  unit,
});

/** Rating utama per kategori, urut dari yang paling penting. */
function allRatings(item: CatalogItem): Rating[] {
  switch (item.category) {
    case 'pv-module': {
      const { pmaxW, vocV, iscA, vmpV } = item.electrical;
      return [
        rating('pmax', pmaxW, 'W'),
        rating('voc', vocV, 'V'),
        rating('isc', iscA, 'A'),
        rating('vmp', vmpV, 'V'),
      ];
    }
    case 'scc-pwm': {
      const scc = item.electrical;
      return [
        rating('systemV', scc.batteryVoltagesV.map(number).join('/'), 'V'),
        rating('chargeA', scc.chargeCurrentMaxA, 'A'),
        rating('loadA', scc.loadCurrentMaxA, 'A'),
        rating('pvVocMax', `${number(scc.pvVocMax12VV)}/${number(scc.pvVocMax24VV)}`, 'V'),
      ];
    }
    case 'scc-mppt': {
      const scc = item.electrical;
      return [
        rating('systemV', scc.batteryNominalV, 'V'),
        rating('chargeA', scc.chargeCurrentMaxA, 'A'),
        rating('pvVocMax', scc.pvVocMaxV, 'V'),
        rating('pvPowerMax', scc.pvPowerMaxW, 'W'),
      ];
    }
    case 'battery': {
      const battery = item.electrical;
      return [
        rating('nominalV', battery.nominalVoltageV, 'V'),
        rating('capacity', battery.capacityAh, 'Ah'),
        rating('chargeA', battery.chargeCurrentMaxA, 'A'),
        ...(battery.dischargeCurrentMaxA === undefined
          ? []
          : [rating('dischargeA', battery.dischargeCurrentMaxA, 'A')]),
      ];
    }
    case 'bms': {
      const bms = item.electrical;
      return [
        rating('nominalV', bms.nominalVoltageV, 'V'),
        rating('chargeA', bms.chargeCurrentMaxA, 'A'),
        rating('dischargeA', bms.dischargeCurrentMaxA, 'A'),
      ];
    }
    case 'inverter-offgrid':
    case 'inverter-hybrid': {
      const inverter = item.electrical;
      return [
        rating('acPower', inverter.ratedAcPowerW, 'W'),
        rating('dcV', inverter.nominalDcV, 'V'),
        rating('acV', inverter.acOutputVoltageV, 'V'),
        item.category === 'inverter-hybrid'
          ? rating('pvVocMax', item.electrical.pvVocMaxV, 'V')
          : rating('lvd', inverter.dcVoltageLvdV, 'V'),
      ];
    }
    case 'inverter-gridtie': {
      const inverter = item.electrical;
      return [
        rating('acPower', inverter.ratedAcPowerW, 'W'),
        rating('mpptRange', `${number(inverter.mpptMinV)}–${number(inverter.mpptMaxV)}`, 'V'),
        rating('pvVocMax', item.protection.dcVocMaxV, 'V'),
        rating('inputA', inverter.dcCurrentMaxA, 'A'),
      ];
    }
    case 'mcb-dc':
    case 'mcb-ac': {
      const mcb = item.electrical;
      const ratedV =
        item.category === 'mcb-dc'
          ? item.electrical.ratedVoltageDcV
          : item.electrical.ratedVoltageAcV;
      return [
        rating('ratedA', mcb.ratedCurrentA, 'A'),
        rating('nominalV', ratedV, 'V'),
        rating('curve', mcb.curve),
        rating('breaking', mcb.breakingCapacityKa, 'kA'),
      ];
    }
    case 'fuse': {
      const fuse = item.electrical;
      return [
        rating('ratedA', fuse.ratedCurrentA, 'A'),
        rating('nominalV', fuse.ratedVoltageDcV, 'V'),
        rating('fuseClass', fuse.class),
        rating('breaking', fuse.breakingCapacityKa, 'kA'),
      ];
    }
    case 'spd': {
      const spd = item.electrical;
      return [
        rating('uc', spd.continuousVoltageUcV, 'V'),
        rating('up', spd.protectionLevelUpKv, 'kV'),
        rating('surge', spd.nominalDischargeCurrentKa, 'kA'),
      ];
    }
    case 'combiner': {
      const combiner = item.electrical;
      return [
        rating('inputs', combiner.stringInputs),
        rating('ratedA', combiner.ratedCurrentA, 'A'),
        rating('nominalV', combiner.ratedVoltageDcV, 'V'),
        rating('stringFuse', combiner.fusePerStringA, 'A'),
      ];
    }
    case 'kwh-meter': {
      const meter = item.electrical;
      return [
        rating('maxA', meter.currentMaxA, 'A'),
        rating('maxV', meter.voltageMaxV, 'V'),
        rating('accuracy', meter.accuracyClass),
      ];
    }
    case 'busbar': {
      const busbar = item.electrical;
      return [
        rating('positions', busbar.positions),
        rating('ratedA', busbar.ratedCurrentA, 'A'),
        rating('nominalV', busbar.ratedVoltageV, 'V'),
      ];
    }
    case 'grounding':
      return [rating('earthR', item.electrical.earthResistanceOhm, 'Ω')];
    case 'load-panel': {
      const panel = item.electrical;
      return [
        rating('ratedA', panel.ratedCurrentA, 'A'),
        rating('nominalV', panel.ratedVoltageAcV, 'V'),
        rating('circuits', panel.circuitCount),
        rating('circuitA', panel.circuitBreakerA, 'A'),
      ];
    }
    case 'load-dc':
    case 'load-ac':
      return [
        rating('maxPower', item.electrical.maxPowerW, 'W'),
        rating('nominalV', item.electrical.ratedVoltageV, 'V'),
      ];
    case 'grid':
      return [
        rating('nominalV', item.electrical.nominalVoltageV, 'V'),
        rating('frequency', item.electrical.frequencyHz, 'Hz'),
      ];
    case 'cable':
      return [];
  }
}

/** Paling banyak `MAX_RATINGS` rating utama sebuah item. */
export function ratingsOf(item: CatalogItem): Rating[] {
  return allRatings(item).slice(0, MAX_RATINGS);
}
