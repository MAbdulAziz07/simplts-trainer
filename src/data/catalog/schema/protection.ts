// Skema MCB, fuse, SPD, dan combiner box (docs/KATALOG.md §6.6–6.7).
import { z } from 'zod';
import { FUSE_CLASSES } from '@/domain';
import {
  bool,
  count,
  itemSchema,
  nonNegative,
  num,
  positive,
  tripCurve,
  tripTimeCurve,
} from './common';

export const mcbDcSchema = itemSchema(
  'mcb-dc',
  z.strictObject({
    poles: count,
    ratedCurrentA: positive,
    curve: tripCurve,
    ratedVoltageDcV: positive,
    maxVoltageDcV: positive,
    breakingCapacityKa: positive,
    refTempC: num,
    polarized: bool,
    minOperatingVoltageV: nonNegative,
  }),
  z.strictObject({
    ratedCurrentA: positive,
    curve: tripCurve,
    ratedVoltageDcV: positive,
    breakingCapacityKa: positive,
  }),
);

export const mcbAcSchema = itemSchema(
  'mcb-ac',
  z.strictObject({
    poles: count,
    ratedCurrentA: positive,
    curve: tripCurve,
    ratedVoltageAcV: positive,
    ratedVoltageDcV: positive.nullable(),
    breakingCapacityKa: positive,
    refTempC: num,
    frequencyHz: positive,
  }),
  z.strictObject({
    ratedCurrentA: positive,
    curve: tripCurve,
    ratedVoltageAcV: positive,
    breakingCapacityKa: positive,
  }),
);

export const fuseSchema = itemSchema(
  'fuse',
  z.strictObject({
    poles: count,
    ratedCurrentA: positive,
    ratedVoltageDcV: positive,
    breakingCapacityKa: positive,
    class: z.enum(FUSE_CLASSES),
  }),
  z.strictObject({
    ratedCurrentA: positive,
    ratedVoltageDcV: positive,
    timeCurrentPoints: tripTimeCurve,
    blowsPermanently: bool,
  }),
);

const spdRatings = {
  continuousVoltageUcV: positive,
  protectionLevelUpKv: positive,
  nominalDischargeCurrentKa: positive,
  maxEvents: count,
};

export const spdSchema = itemSchema(
  'spd',
  z.strictObject({ type: count, ...spdRatings }),
  z.strictObject(spdRatings),
);

export const combinerSchema = itemSchema(
  'combiner',
  z.strictObject({
    stringInputs: count,
    ratedVoltageDcV: positive,
    ratedCurrentA: positive,
    fusePerStringA: positive,
    poles: count,
  }),
  z.strictObject({ fusePerStringA: positive, ratedVoltageDcV: positive, ratedCurrentA: positive }),
);
