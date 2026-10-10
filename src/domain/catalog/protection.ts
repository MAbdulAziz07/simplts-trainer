// Parameter katalog: MCB, fuse, SPD, dan combiner box (docs/KATALOG.md §6.6–6.7).
import type { CurvePoint, TripCurve } from './shared';

export interface McbDcElectrical {
  poles: number;
  ratedCurrentA: number;
  curve: TripCurve;
  ratedVoltageDcV: number;
  maxVoltageDcV: number;
  breakingCapacityKa: number;
  refTempC: number;
  polarized: boolean;
  minOperatingVoltageV: number;
}

export interface McbDcProtection {
  ratedCurrentA: number;
  curve: TripCurve;
  ratedVoltageDcV: number;
  breakingCapacityKa: number;
}

export interface McbAcElectrical {
  poles: number;
  ratedCurrentA: number;
  curve: TripCurve;
  ratedVoltageAcV: number;
  /** `null`: datasheet tidak memberi rating DC. */
  ratedVoltageDcV: number | null;
  breakingCapacityKa: number;
  refTempC: number;
  frequencyHz: number;
}

export interface McbAcProtection {
  ratedCurrentA: number;
  curve: TripCurve;
  ratedVoltageAcV: number;
  breakingCapacityKa: number;
}

export const FUSE_CLASSES = ['gPV', 'ANL'] as const;
export type FuseClass = (typeof FUSE_CLASSES)[number];

export interface FuseElectrical {
  poles: number;
  ratedCurrentA: number;
  ratedVoltageDcV: number;
  breakingCapacityKa: number;
  class: FuseClass;
}

export interface FuseProtection {
  ratedCurrentA: number;
  ratedVoltageDcV: number;
  timeCurrentPoints: CurvePoint[];
  blowsPermanently: boolean;
}

export interface SpdElectrical {
  type: number;
  continuousVoltageUcV: number;
  protectionLevelUpKv: number;
  nominalDischargeCurrentKa: number;
  maxEvents: number;
}

export type SpdProtection = Omit<SpdElectrical, 'type'>;

export interface CombinerElectrical {
  stringInputs: number;
  ratedVoltageDcV: number;
  ratedCurrentA: number;
  fusePerStringA: number;
  poles: number;
}

export interface CombinerProtection {
  fusePerStringA: number;
  ratedVoltageDcV: number;
  ratedCurrentA: number;
}
