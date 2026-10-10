// Parameter katalog: baterai dan BMS (docs/KATALOG.md §6.4).
import type { CurvePoint } from './shared';

export const BATTERY_CHEMISTRIES = ['vrla-agm', 'vrla-gel', 'lifepo4'] as const;
export type BatteryChemistry = (typeof BATTERY_CHEMISTRIES)[number];

/** Kalibrasi model baterai (MODEL_FISIKA §4.2–4.3); seluruhnya asumsi. */
export interface BatteryModelParams {
  ocvSoc: number[];
  ocvV: number[];
  overVoltageSoc: number[];
  overVoltageV: number[];
  resistanceSocFactor: number;
  sagVoltageV: number;
  sagSocScale: number;
  peukertExponent: number;
  peukertRefHours: number;
  chargeEfficiency: number;
  chargeEfficiencyKneeSoc: number;
  chargeEfficiencyAtFull: number;
  acceptancePerHour: number;
  selfDischargePctPerDay: number;
}

// Field opsional hanya ada pada kimia tertentu (VRLA atau LiFePO4) atau bila tertera di datasheet.
export interface BatteryElectrical {
  chemistry: BatteryChemistry;
  nominalVoltageV: number;
  cellCount: number;
  capacityAh: number;
  capacityBasisHours?: number;
  capacityC5Ah?: number;
  capacityC2Ah?: number;
  energyWh?: number;
  internalResistanceMohm: number;
  floatVPerCell?: number;
  cycleVPerCell?: number;
  tempCoeffFloatMvPerCPerCell?: number;
  tempCoeffCycleMvPerCPerCell?: number;
  chargeVoltageV?: number;
  chargeVoltageToleranceV?: number;
  chargeVoltageMinV?: number;
  chargeVoltageMaxV?: number;
  chargeVoltageRecommendedV?: number;
  floatV?: number;
  tailCurrentFractionC?: number;
  chargeCurrentMaxA: number;
  chargeCurrentRecommendedA?: number;
  dischargeCurrentMaxA?: number;
  dischargeCurrentRecommendedA?: number;
  pulseCurrentMaxA?: number;
  pulseDurationS?: number;
  dischargeCutoffVPerCell?: number;
  dischargeCutoffV?: number;
  capacityTempPoints: CurvePoint[];
  roundTripEfficiency?: number;
  selfDischargePctPerMonth?: number;
  chargeTempMinC: number;
  chargeTempMaxC: number;
  dischargeTempMinC: number;
  dischargeTempMaxC: number;
  cycleLife100DodMin?: number;
  cycleLife100DodMax?: number;
  cycleLife80Dod?: number;
  cycleLife70Dod?: number;
  cycleLife50Dod?: number;
  designLifeYears?: number;
  trainingDodLimitPct: number;
  modelParams: BatteryModelParams;
}

export interface BatteryProtection {
  internalBms: boolean;
  externalBmsRequired?: boolean;
  overVoltageCutoffV?: number;
  underVoltageCutoffV?: number;
  overCurrentDischargeA?: number;
  overCurrentDelayS?: number;
  shortCircuitFactor?: number;
  shortCircuitDelayMs?: number;
}

export interface BmsElectrical {
  nominalVoltageV: number;
  cellCount: number;
  chargeCurrentMaxA: number;
  dischargeCurrentMaxA: number;
  overVoltageCellV: number;
  underVoltageCellV: number;
  maxBatteriesParallel: number;
  balancing: boolean;
}

export interface BmsProtection {
  overCurrentDischargeA: number;
  overCurrentDelayS: number;
  shortCircuitFactor: number;
  shortCircuitDelayMs: number;
  chargeTempMinC: number;
  chargeTempMaxC: number;
}
