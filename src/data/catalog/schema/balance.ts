// Skema kabel, kWh meter, distribusi, jaringan, dan beban (docs/KATALOG.md §6.8–6.10).
import { z } from 'zod';
import {
  bool,
  count,
  itemSchema,
  noProtection,
  nonNegative,
  num,
  pct,
  positive,
  tempFactorCurve,
  tripCurve,
} from './common';

const pvCableSize = z.strictObject({
  areaMm2: positive,
  rMaxOhmPerKm: positive,
  ampacityAirA: positive,
  ampacitySurfaceA: positive,
  ampacityTouchingA: positive,
});

const nyyCableSize = z.strictObject({
  areaMm2: positive,
  ampacityGround20A: positive,
  ampacityGround30A: positive,
  ampacityAir20A: positive,
  ampacityAir30A: positive,
});

export const cableSchema = itemSchema(
  'cable',
  z.strictObject({
    conductor: z.literal('copper'),
    resistivityOhmMm2PerM: positive,
    tempCoeffPerC: positive,
    tinnedFactor: z.number().min(1),
    contactResistanceMohm: nonNegative,
    thermalTimeConstantMin: positive,
    ratedVoltageV: positive,
    currentType: z.enum(['dc', 'ac-dc']),
    maxConductorTempC: num,
    ampacityRefAmbientC: num,
    ambientDerating: tempFactorCurve.optional(),
    sizes: z.array(z.union([pvCableSize, nyyCableSize])).min(1),
  }),
  z.strictObject({
    maxConductorTempC: num,
    overheatDamageMarginK: positive,
    overheatDamageDelayS: nonNegative,
  }),
);

export const kwhMeterSchema = itemSchema(
  'kwh-meter',
  z.strictObject({
    network: z.literal('1P2W'),
    directConnection: bool,
    currentMinA: positive,
    currentRefA: positive,
    currentMaxA: positive,
    voltageMinV: positive,
    voltageMaxV: positive,
    frequencyHz: positive,
    accuracyClass: positive,
    energyAccuracyPct: pct,
    lowCurrentErrorPct: pct,
    displayMaxKwh: positive,
    displayResolutionKwh: positive,
    pulseKwhPerPulse: positive,
    gainErrorMaxPct: pct,
    terminalMaxMm2: positive,
    tempOpMinC: num,
    tempOpMaxC: num,
  }),
  z.strictObject({
    currentMaxA: positive,
    overCurrentDamageA: positive,
    ipRating: z.string().regex(/^IP\d{2}$/),
  }),
);

export const busbarSchema = itemSchema(
  'busbar',
  z.strictObject({ positions: count, ratedCurrentA: positive, ratedVoltageV: positive }),
  z.strictObject({ ratedCurrentA: positive }),
);

export const groundingSchema = itemSchema(
  'grounding',
  z.strictObject({ earthResistanceOhm: positive }),
  noProtection,
);

const loadPanelRatings = {
  ratedCurrentA: positive,
  circuitBreakerA: positive,
  circuitCurve: tripCurve,
  breakingCapacityKa: positive,
};

export const loadPanelSchema = itemSchema(
  'load-panel',
  z.strictObject({ ...loadPanelRatings, circuitCount: count, ratedVoltageAcV: positive }),
  z.strictObject(loadPanelRatings),
);

export const gridSchema = itemSchema(
  'grid',
  z.strictObject({
    nominalVoltageV: positive,
    voltageToleranceUpPct: pct,
    voltageToleranceDownPct: pct,
    frequencyHz: positive,
    availableDefault: bool,
  }),
  noProtection,
);

const loadElectrical = z.strictObject({
  kind: z.literal('resistive'),
  ratedVoltageV: positive,
  maxPowerW: positive,
  minPowerW: nonNegative,
  stepW: positive,
  resistanceAtMaxOhm: positive,
});

export const loadDcSchema = itemSchema('load-dc', loadElectrical, noProtection);
export const loadAcSchema = itemSchema('load-ac', loadElectrical, noProtection);
