// Parameter katalog: inverter off-grid, grid-tie, dan hibrida (docs/KATALOG.md §6.5).
import type { CurvePoint } from './shared';

export const INVERTER_WAVEFORMS = ['pure-sine'] as const;
export type InverterWaveform = (typeof INVERTER_WAVEFORMS)[number];

export const HYBRID_MODES = ['SBU', 'SUB', 'UTILITY_FIRST'] as const;
export type HybridMode = (typeof HYBRID_MODES)[number];

export interface InverterOffgridElectrical {
  ratedAcPowerW: number;
  surgeMultiple: number;
  surgeDurationS: number;
  noLoadPowerW: number;
  efficiencyAtHalfLoad: number;
  efficiencyAtFullLoad: number;
  nominalDcV: number;
  dcVoltageLowAlarmV: number;
  dcVoltageLvdV: number;
  dcVoltageLvrV: number;
  dcVoltageHvdV: number;
  lvdDelayS: number;
  acOutputVoltageV: number;
  acOutputFrequencyHz: number;
  waveform: InverterWaveform;
}

export interface InverterOffgridProtection {
  overloadCurve: CurvePoint[];
  hasInternalFuse: boolean;
  hasReversePolarityProtection: boolean;
  reversePolarityDamages: boolean;
}

export interface InverterGridtieElectrical {
  ratedAcPowerW: number;
  mpptCount: number;
  dcStartV: number;
  mpptMinV: number;
  mpptMaxV: number;
  dcCurrentMaxA: number;
  efficiencyPeak: number;
  efficiencyAtHalfLoad: number;
  efficiencyAtFullLoad: number;
  noLoadPowerW: number;
  standbyPowerW: number;
  dcPowerMaxFactor: number;
  gridVoltageMinFactor: number;
  gridVoltageMaxFactor: number;
  gridFrequencyMinHz: number;
  gridFrequencyMaxHz: number;
  reconnectDelayS: number;
  acOutputVoltageV: number;
  acOutputFrequencyHz: number;
}

export interface InverterGridtieProtection {
  dcVocMaxV: number;
  antiIslanding: boolean;
  antiIslandingTimeS: number;
  hasReversePolarityProtection: boolean;
  reversePolarityDamages: boolean;
}

export interface InverterHybridElectrical extends InverterOffgridElectrical {
  mpptCount: number;
  mpptMinV: number;
  mpptMaxV: number;
  pvVocMaxV: number;
  mpptCurrentMaxA: number;
  mpptEfficiency: number;
  gridChargeEfficiency: number;
  sbuToGridV: number;
  sbuToBatteryV: number;
  gridChargeCurrentMaxA: number;
  gridChargeCurrentDefaultA: number;
  exportAllowedDefault: boolean;
  transferTimeMs: number;
  modes: HybridMode[];
}

export interface InverterHybridProtection extends InverterOffgridProtection {
  antiIslanding: boolean;
  antiIslandingTimeS: number;
}
