// Skema inverter off-grid, grid-tie, dan hibrida (docs/KATALOG.md §6.5).
import { z } from 'zod';
import { HYBRID_MODES, INVERTER_WAVEFORMS } from '@/domain';
import { bool, count, curve, fraction, itemSchema, nonNegative, positive } from './common';

const offgridElectrical = z.strictObject({
  ratedAcPowerW: positive,
  surgeMultiple: z.number().min(1),
  surgeDurationS: positive,
  noLoadPowerW: nonNegative,
  efficiencyAtHalfLoad: fraction,
  efficiencyAtFullLoad: fraction,
  nominalDcV: positive,
  dcVoltageLowAlarmV: positive,
  dcVoltageLvdV: positive,
  dcVoltageLvrV: positive,
  dcVoltageHvdV: positive,
  lvdDelayS: nonNegative,
  acOutputVoltageV: positive,
  acOutputFrequencyHz: positive,
  waveform: z.enum(INVERTER_WAVEFORMS),
});

const offgridProtection = z.strictObject({
  overloadCurve: curve,
  hasInternalFuse: bool,
  hasReversePolarityProtection: bool,
  reversePolarityDamages: bool,
});

export const inverterOffgridSchema = itemSchema(
  'inverter-offgrid',
  offgridElectrical,
  offgridProtection,
);

export const inverterGridtieSchema = itemSchema(
  'inverter-gridtie',
  z.strictObject({
    ratedAcPowerW: positive,
    mpptCount: count,
    dcStartV: positive,
    mpptMinV: positive,
    mpptMaxV: positive,
    dcCurrentMaxA: positive,
    efficiencyPeak: fraction,
    efficiencyAtHalfLoad: fraction,
    efficiencyAtFullLoad: fraction,
    noLoadPowerW: nonNegative,
    standbyPowerW: nonNegative,
    dcPowerMaxFactor: positive,
    gridVoltageMinFactor: positive,
    gridVoltageMaxFactor: positive,
    gridFrequencyMinHz: positive,
    gridFrequencyMaxHz: positive,
    reconnectDelayS: nonNegative,
    acOutputVoltageV: positive,
    acOutputFrequencyHz: positive,
  }),
  z.strictObject({
    dcVocMaxV: positive,
    antiIslanding: bool,
    antiIslandingTimeS: nonNegative,
    hasReversePolarityProtection: bool,
    reversePolarityDamages: bool,
  }),
);

export const inverterHybridSchema = itemSchema(
  'inverter-hybrid',
  offgridElectrical.extend({
    mpptCount: count,
    mpptMinV: positive,
    mpptMaxV: positive,
    pvVocMaxV: positive,
    mpptCurrentMaxA: positive,
    mpptEfficiency: fraction,
    gridChargeEfficiency: fraction,
    sbuToGridV: positive,
    sbuToBatteryV: positive,
    gridChargeCurrentMaxA: positive,
    gridChargeCurrentDefaultA: nonNegative,
    exportAllowedDefault: bool,
    transferTimeMs: nonNegative,
    modes: z.array(z.enum(HYBRID_MODES)).min(1),
  }),
  offgridProtection.extend({ antiIslanding: bool, antiIslandingTimeS: nonNegative }),
);
