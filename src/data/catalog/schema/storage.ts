// Skema baterai dan BMS (docs/KATALOG.md §6.4).
import { z } from 'zod';
import { BATTERY_CHEMISTRIES } from '@/domain';
import {
  bool,
  count,
  fraction,
  itemSchema,
  nonNegative,
  num,
  pct,
  positive,
  socAxis,
  tempFactorCurve,
} from './common';

const points = z.array(num).min(2);

const modelParamsSchema = z
  .strictObject({
    ocvSoc: socAxis,
    ocvV: z.array(positive).min(2),
    overVoltageSoc: socAxis,
    overVoltageV: points,
    resistanceSocFactor: nonNegative,
    sagVoltageV: nonNegative,
    sagSocScale: positive,
    peukertExponent: z.number().min(1),
    peukertRefHours: positive,
    chargeEfficiency: fraction,
    chargeEfficiencyKneeSoc: fraction,
    chargeEfficiencyAtFull: fraction,
    acceptancePerHour: positive,
    selfDischargePctPerDay: nonNegative,
  })
  .refine((p) => p.ocvSoc.length === p.ocvV.length, {
    error: 'ocvSoc dan ocvV harus sama panjang',
    path: ['ocvV'],
  })
  .refine((p) => p.overVoltageSoc.length === p.overVoltageV.length, {
    error: 'overVoltageSoc dan overVoltageV harus sama panjang',
    path: ['overVoltageV'],
  });

export const batterySchema = itemSchema(
  'battery',
  z.strictObject({
    chemistry: z.enum(BATTERY_CHEMISTRIES),
    nominalVoltageV: positive,
    cellCount: count,
    capacityAh: positive,
    capacityBasisHours: positive.optional(),
    capacityC5Ah: positive.optional(),
    capacityC2Ah: positive.optional(),
    energyWh: positive.optional(),
    internalResistanceMohm: positive,
    floatVPerCell: positive.optional(),
    cycleVPerCell: positive.optional(),
    tempCoeffFloatMvPerCPerCell: num.optional(),
    tempCoeffCycleMvPerCPerCell: num.optional(),
    chargeVoltageV: positive.optional(),
    chargeVoltageToleranceV: nonNegative.optional(),
    chargeVoltageMinV: positive.optional(),
    chargeVoltageMaxV: positive.optional(),
    chargeVoltageRecommendedV: positive.optional(),
    floatV: positive.optional(),
    tailCurrentFractionC: fraction.optional(),
    chargeCurrentMaxA: positive,
    chargeCurrentRecommendedA: positive.optional(),
    dischargeCurrentMaxA: positive.optional(),
    dischargeCurrentRecommendedA: positive.optional(),
    pulseCurrentMaxA: positive.optional(),
    pulseDurationS: positive.optional(),
    dischargeCutoffVPerCell: positive.optional(),
    dischargeCutoffV: positive.optional(),
    capacityTempPoints: tempFactorCurve,
    roundTripEfficiency: fraction.optional(),
    selfDischargePctPerMonth: pct.optional(),
    chargeTempMinC: num,
    chargeTempMaxC: num,
    dischargeTempMinC: num,
    dischargeTempMaxC: num,
    cycleLife100DodMin: count.optional(),
    cycleLife100DodMax: count.optional(),
    cycleLife80Dod: count.optional(),
    cycleLife70Dod: count.optional(),
    cycleLife50Dod: count.optional(),
    designLifeYears: positive.optional(),
    trainingDodLimitPct: pct,
    modelParams: modelParamsSchema,
  }),
  z.strictObject({
    internalBms: bool,
    externalBmsRequired: bool.optional(),
    overVoltageCutoffV: positive.optional(),
    underVoltageCutoffV: positive.optional(),
    overCurrentDischargeA: positive.optional(),
    overCurrentDelayS: nonNegative.optional(),
    shortCircuitFactor: positive.optional(),
    shortCircuitDelayMs: nonNegative.optional(),
  }),
);

export const bmsSchema = itemSchema(
  'bms',
  z.strictObject({
    nominalVoltageV: positive,
    cellCount: count,
    chargeCurrentMaxA: positive,
    dischargeCurrentMaxA: positive,
    overVoltageCellV: positive,
    underVoltageCellV: positive,
    maxBatteriesParallel: count,
    balancing: bool,
  }),
  z.strictObject({
    overCurrentDischargeA: positive,
    overCurrentDelayS: nonNegative,
    shortCircuitFactor: positive,
    shortCircuitDelayMs: nonNegative,
    chargeTempMinC: num,
    chargeTempMaxC: num,
  }),
);
