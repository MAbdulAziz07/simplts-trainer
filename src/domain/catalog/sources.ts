// Parameter katalog: modul PV dan SCC (docs/KATALOG.md §6.1–6.3).
import type { CurvePoint, ProtectionFeature } from './shared';

export interface PvModuleElectrical {
  cellCount: number;
  pmaxW: number;
  vmpV: number;
  impA: number;
  vocV: number;
  iscA: number;
  tempCoeffIscPerC: number;
  tempCoeffVocPerC: number;
  tempCoeffPmaxPerC: number;
  noctC: number;
  systemVoltageMaxV: number;
  bypassDiodeCount: number;
  tempOpMinC: number;
  tempOpMaxC: number;
}

export interface PvModuleProtection {
  seriesFuseMaxA: number;
  reverseCurrentMaxA: number;
}

export type SccInstallStep = 'battery' | 'pv' | 'load';

export interface SccPwmElectrical {
  batteryVoltagesV: number[];
  chargeStages: number;
  chargeCurrentMaxA: number;
  loadCurrentMaxA: number;
  pvPowerMax12VW: number;
  pvPowerMax24VW: number;
  pvVocMax12VV: number;
  pvVocMax24VV: number;
  absorptionV: { sealed: number; gel: number; flooded: number };
  floatV: number;
  rechargeV: number;
  loadDisconnectV: number;
  loadReconnectV: number;
  voltageScale24V: number;
  selfConsumptionMa: number;
  switchDropV: number;
  absorptionDurationMin: number;
  tempOpMinC: number;
  tempOpMaxC: number;
  installOrder: SccInstallStep[];
}

export interface SccPwmProtection {
  vocFaultFactor: number;
  loadOverloadCurve: CurvePoint[];
  features: ProtectionFeature[];
  reversePolarityDamages: boolean;
}

export interface SccMpptElectrical {
  batteryNominalV: number;
  mpptMinV: number;
  mpptMaxV: number;
  pvVocMaxV: number;
  pvPowerMaxW: number;
  inputCurrentMaxA: number;
  chargeCurrentMaxA: number;
  efficiencyMax: number;
  trackingEfficiency: number;
  standbyPowerW: number;
  startDeltaV: number;
  bulkV: number;
  floatV: { vented: number; sealed: number; gel: number; nicd: number };
  lowBatteryAlarmV: number;
  autoDetectBattery: boolean;
  batteryTempSensor: boolean;
  absorptionDurationMin: number;
  tempOpMinC: number;
  tempOpMaxC: number;
}

export interface SccMpptProtection {
  vocMaxV: number;
  vocFaultFactor: number;
  overloadAlarmPct: number;
  features: ProtectionFeature[];
}
