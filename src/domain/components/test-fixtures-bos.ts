// Data uji komponen selain PV dan baterai: salinan nilai katalog (src/data/catalog).
// Hanya dipakai berkas *.test.ts.
import type {
  CableElectrical,
  GridElectrical,
  KwhMeterElectrical,
  LoadElectrical,
} from '../catalog/balance';
import type { InverterOffgridElectrical, InverterOffgridProtection } from '../catalog/inverters';
import type { McbAcElectrical, McbDcElectrical } from '../catalog/protection';
import type { CurvePoint } from '../catalog/shared';
import type { SccPwmElectrical, SccPwmProtection } from '../catalog/sources';

/** scc-pwm-rbl-20a */
export const PWM_RBL_20A: SccPwmElectrical = {
  batteryVoltagesV: [12, 24],
  chargeStages: 4,
  chargeCurrentMaxA: 20,
  loadCurrentMaxA: 10,
  pvPowerMax12VW: 240,
  pvPowerMax24VW: 480,
  pvVocMax12VV: 24,
  pvVocMax24VV: 48,
  absorptionV: { sealed: 14.4, gel: 14.2, flooded: 14.6 },
  floatV: 13.7,
  rechargeV: 13.0,
  loadDisconnectV: 10.7,
  loadReconnectV: 12.6,
  voltageScale24V: 2,
  selfConsumptionMa: 10,
  switchDropV: 0.3,
  absorptionDurationMin: 120,
  tempOpMinC: -35,
  tempOpMaxC: 60,
  installOrder: ['battery', 'pv', 'load'],
};

export const PWM_RBL_20A_PROTECTION: SccPwmProtection = {
  vocFaultFactor: 1.2,
  loadOverloadCurve: [
    [1.25, 60],
    [1.5, 5],
  ],
  features: ['short-circuit', 'open-circuit', 'reverse-polarity', 'overload', 'reverse-current'],
  reversePolarityDamages: false,
};

/** inv-offgrid-500w-12v */
export const INVERTER_500W: InverterOffgridElectrical = {
  ratedAcPowerW: 500,
  surgeMultiple: 3,
  surgeDurationS: 5,
  noLoadPowerW: 8,
  efficiencyAtHalfLoad: 0.9,
  efficiencyAtFullLoad: 0.88,
  nominalDcV: 12,
  dcVoltageLowAlarmV: 11.0,
  dcVoltageLvdV: 10.5,
  dcVoltageLvrV: 12.5,
  dcVoltageHvdV: 15.5,
  lvdDelayS: 10,
  acOutputVoltageV: 220,
  acOutputFrequencyHz: 50,
  waveform: 'pure-sine',
};

export const INVERTER_500W_PROTECTION: InverterOffgridProtection = {
  overloadCurve: [
    [1.1, 600],
    [1.25, 60],
    [1.5, 10],
    [2.0, 1],
    [3.0, 0.1],
  ],
  hasInternalFuse: false,
  hasReversePolarityProtection: false,
  reversePolarityDamages: true,
};

const cableCommon = {
  conductor: 'copper',
  resistivityOhmMm2PerM: 0.0175,
  tempCoeffPerC: 0.00393,
  tinnedFactor: 1.0,
  contactResistanceMohm: 0.3,
  thermalTimeConstantMin: 10,
} as const;

/** cable-pv-h1z2z2k (ukuran dipersingkat). */
export const CABLE_PV: CableElectrical = {
  ...cableCommon,
  ratedVoltageV: 1500,
  currentType: 'dc',
  maxConductorTempC: 90,
  ampacityRefAmbientC: 60,
  ambientDerating: [
    [60, 1.0],
    [70, 0.92],
    [80, 0.84],
    [90, 0.75],
  ],
  sizes: [
    {
      areaMm2: 4,
      rMaxOhmPerKm: 5.09,
      ampacityAirA: 55,
      ampacitySurfaceA: 52,
      ampacityTouchingA: 44,
    },
  ],
};

/** cable-nyy-2core (ukuran dipersingkat). */
export const CABLE_NYY: CableElectrical = {
  ...cableCommon,
  ratedVoltageV: 1000,
  currentType: 'ac-dc',
  maxConductorTempC: 70,
  ampacityRefAmbientC: 30,
  sizes: [
    {
      areaMm2: 2.5,
      ampacityGround20A: 41,
      ampacityGround30A: 36,
      ampacityAir20A: 29,
      ampacityAir30A: 25,
    },
  ],
};

/** mcb-dc-20a */
export const MCB_DC_20A: McbDcElectrical = {
  poles: 2,
  ratedCurrentA: 20,
  curve: 'C',
  ratedVoltageDcV: 440,
  maxVoltageDcV: 500,
  breakingCapacityKa: 10,
  refTempC: 55,
  polarized: true,
  minOperatingVoltageV: 12,
};

/** mcb-ac-10a */
export const MCB_AC_10A: McbAcElectrical = {
  poles: 2,
  ratedCurrentA: 10,
  curve: 'C',
  ratedVoltageAcV: 240,
  ratedVoltageDcV: null,
  breakingCapacityKa: 6,
  refTempC: 30,
  frequencyHz: 50,
};

/** Kurva waktu-arus fuse di katalog (fuse-pv-15a, fuse-bat-100a). */
export const FUSE_POINTS: CurvePoint[] = [
  [1.13, 36000],
  [1.45, 3600],
  [2, 150],
  [3, 10],
  [5, 1],
  [10, 0.05],
  [20, 0.005],
];

/** load-dc-12v-200w */
export const LOAD_DC_200W: LoadElectrical = {
  kind: 'resistive',
  ratedVoltageV: 12,
  maxPowerW: 200,
  minPowerW: 0,
  stepW: 10,
  resistanceAtMaxOhm: 0.72,
};

/** load-ac-500w */
export const LOAD_AC_500W: LoadElectrical = {
  kind: 'resistive',
  ratedVoltageV: 220,
  maxPowerW: 500,
  minPowerW: 0,
  stepW: 10,
  resistanceAtMaxOhm: 96.8,
};

/** grid-pln */
export const GRID_PLN: GridElectrical = {
  nominalVoltageV: 220,
  voltageToleranceUpPct: 5,
  voltageToleranceDownPct: 10,
  frequencyHz: 50,
  availableDefault: true,
};

/** kwh-meter-sdm230 */
export const KWH_METER_SDM230: KwhMeterElectrical = {
  network: '1P2W',
  directConnection: true,
  currentMinA: 0.5,
  currentRefA: 10,
  currentMaxA: 100,
  voltageMinV: 176,
  voltageMaxV: 276,
  frequencyHz: 50,
  accuracyClass: 1,
  energyAccuracyPct: 1,
  lowCurrentErrorPct: 5,
  displayMaxKwh: 99999.99,
  displayResolutionKwh: 0.01,
  pulseKwhPerPulse: 0.001,
  gainErrorMaxPct: 1,
  terminalMaxMm2: 19,
  tempOpMinC: -25,
  tempOpMaxC: 55,
};
