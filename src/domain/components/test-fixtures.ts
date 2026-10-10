// Data uji model komponen: salinan nilai katalog (src/data/catalog), karena src/domain tidak boleh
// meng-import src/data. Hanya dipakai berkas *.test.ts.
import type { PvModuleElectrical } from '../catalog/sources';
import type { BatteryElectrical, BatteryModelParams } from '../catalog/storage';

const pvCommon = {
  noctC: 45,
  systemVoltageMaxV: 1000,
  bypassDiodeCount: 3,
  tempOpMinC: -40,
  tempOpMaxC: 85,
};

export const PV_240W_60P: PvModuleElectrical = {
  ...pvCommon,
  cellCount: 60,
  pmaxW: 240,
  vmpV: 30.0,
  impA: 8.01,
  vocV: 37.2,
  iscA: 8.56,
  tempCoeffIscPerC: 0.0005,
  tempCoeffVocPerC: -0.0027,
  tempCoeffPmaxPerC: -0.0045,
};

export const PV_JS310CB_80P: PvModuleElectrical = {
  ...pvCommon,
  cellCount: 80,
  pmaxW: 310,
  vmpV: 25.3,
  impA: 12.3,
  vocV: 29.5,
  iscA: 12.9,
  tempCoeffIscPerC: 0.0005,
  tempCoeffVocPerC: -0.003,
  tempCoeffPmaxPerC: -0.0036,
};

export const PV_JS185CB_48P: PvModuleElectrical = {
  ...pvCommon,
  cellCount: 48,
  pmaxW: 185,
  vmpV: 15.1,
  impA: 12.3,
  vocV: 17.7,
  iscA: 13.1,
  tempCoeffIscPerC: 0.0005,
  tempCoeffVocPerC: -0.003,
  tempCoeffPmaxPerC: -0.0036,
};

/** Panel paket Minimum. */
export const PV_GENERIC_100WP: PvModuleElectrical = {
  ...pvCommon,
  cellCount: 36,
  pmaxW: 100,
  vmpV: 18.0,
  impA: 5.56,
  vocV: 22.0,
  iscA: 5.97,
  tempCoeffIscPerC: 0.0005,
  tempCoeffVocPerC: -0.0032,
  tempCoeffPmaxPerC: -0.004,
  bypassDiodeCount: 2,
};

const vrlaModelParams: BatteryModelParams = {
  ocvSoc: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  ocvV: [11.6, 11.8, 11.95, 12.05, 12.2, 12.3, 12.4, 12.5, 12.65, 12.75, 12.85],
  overVoltageSoc: [0, 0.5, 0.75, 0.9, 1.0],
  overVoltageV: [0.3, 0.3, 0.6, 1.3, 1.6],
  resistanceSocFactor: 1.5,
  sagVoltageV: 2.0,
  sagSocScale: 0.05,
  peukertExponent: 1.2,
  peukertRefHours: 20,
  chargeEfficiency: 0.95,
  chargeEfficiencyKneeSoc: 0.8,
  chargeEfficiencyAtFull: 0.7,
  acceptancePerHour: 1.0,
  selfDischargePctPerDay: 0.1,
};

/** Baterai paket Minimum (bat-vrla-agm-12v-100ah). */
export const BATTERY_VRLA_100AH: BatteryElectrical = {
  chemistry: 'vrla-agm',
  nominalVoltageV: 12,
  cellCount: 6,
  capacityAh: 100,
  capacityBasisHours: 20,
  internalResistanceMohm: 4.5,
  floatVPerCell: 2.275,
  cycleVPerCell: 2.425,
  tempCoeffFloatMvPerCPerCell: -3,
  tempCoeffCycleMvPerCPerCell: -5,
  chargeCurrentMaxA: 30,
  dischargeCutoffVPerCell: 1.75,
  capacityTempPoints: [
    [0, 0.86],
    [25, 1.0],
    [40, 1.05],
  ],
  selfDischargePctPerMonth: 3,
  chargeTempMinC: 0,
  chargeTempMaxC: 40,
  dischargeTempMinC: -20,
  dischargeTempMaxC: 55,
  trainingDodLimitPct: 50,
  designLifeYears: 12,
  modelParams: vrlaModelParams,
};

/** bat-lfp-25v6-100ah; dipakai untuk cabang LiFePO4. */
export const BATTERY_LFP_24V_100AH: BatteryElectrical = {
  chemistry: 'lifepo4',
  nominalVoltageV: 25.6,
  cellCount: 8,
  capacityAh: 100,
  internalResistanceMohm: 1.6,
  chargeVoltageRecommendedV: 28.4,
  floatV: 27.0,
  tailCurrentFractionC: 0.02,
  chargeCurrentMaxA: 200,
  dischargeCurrentMaxA: 200,
  dischargeCutoffV: 22.4,
  capacityTempPoints: [
    [-20, 0.5],
    [0, 0.8],
    [25, 1.0],
  ],
  chargeTempMinC: 5,
  chargeTempMaxC: 50,
  dischargeTempMinC: -20,
  dischargeTempMaxC: 50,
  trainingDodLimitPct: 80,
  modelParams: {
    ocvSoc: [0, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9, 0.95, 1.0],
    ocvV: [22.4, 24.0, 25.6, 26.0, 26.16, 26.32, 26.48, 26.72, 27.04, 27.2],
    overVoltageSoc: [0, 0.9, 0.95, 0.98, 1.0],
    overVoltageV: [0.4, 0.4, 0.96, 1.6, 2.0],
    resistanceSocFactor: 0,
    sagVoltageV: 0,
    sagSocScale: 0.05,
    peukertExponent: 1.0,
    peukertRefHours: 1,
    chargeEfficiency: 0.96,
    chargeEfficiencyKneeSoc: 1.0,
    chargeEfficiencyAtFull: 0.96,
    acceptancePerHour: 5.0,
    selfDischargePctPerDay: 0.1,
  },
};

/** Batas relatif untuk nilai acuan contoh hitung MODEL_FISIKA.md (toleransi 2%). */
export const REFERENCE_TOLERANCE = 0.02;

/** `true` bila `actual` berada dalam toleransi relatif terhadap `expected`. */
export function within(actual: number, expected: number, tolerance = REFERENCE_TOLERANCE): boolean {
  return Math.abs(actual - expected) <= Math.abs(expected) * tolerance;
}
