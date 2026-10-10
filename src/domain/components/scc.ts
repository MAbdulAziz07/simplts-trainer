// Model SCC PWM (docs/MODEL_FISIKA.md §2). SCC MPPT (§3) belum dimodelkan pada putaran ini.
import type { SccPwmElectrical, SccPwmProtection } from '../catalog/sources';
import { interpolateLogLog } from './numeric';
import { pvArrayCurrentA, type PvArray } from './pv-array';

export type SccChargeStage = 'bulk' | 'absorption' | 'float';
export type SccBatteryType = keyof SccPwmElectrical['absorptionV'];
export type SccVocStatus = 'ok' | 'fault' | 'damaged';

/** Di atas tegangan ini SCC mengira sistem 24 V (§2.3, US17). [PERLU VERIFIKASI] */
export const PWM_DETECT_24V_THRESHOLD_V = 16;

const SECONDS_PER_MINUTE = 60;

/** Ambang kerja SCC setelah diskalakan ke tegangan sistem yang terdeteksi. */
export interface PwmSetpoints {
  voltageScale: number;
  absorptionV: number;
  floatV: number;
  rechargeV: number;
  loadDisconnectV: number;
  loadReconnectV: number;
  pvVocMaxV: number;
  pvPowerMaxW: number;
}

export interface PwmChargePoint {
  /** Tegangan array: PV "ditarik" ke tegangan baterai + jatuh sakelar. */
  pvVoltageV: number;
  chargeCurrentA: number;
  /** Daya yang benar-benar masuk baterai: Vbat·Ichg. */
  harvestW: number;
  /** Daya yang diambil dari array: Vpv·Ichg (pembanding terhadap daya maksimum array). */
  pvPowerW: number;
}

/**
 * Skala tegangan sistem dari tegangan yang terbaca saat SCC pertama menyala: 1 (12 V) atau
 * `voltageScale24V`. Bila PV dipasang sebelum baterai, yang terbaca Voc PV → deteksi salah.
 */
export function pwmDetectVoltageScale(scc: SccPwmElectrical, sensedVoltageV: number): number {
  return sensedVoltageV > PWM_DETECT_24V_THRESHOLD_V ? scc.voltageScale24V : 1;
}

/** Ambang tegangan (basis 12 V × skala) dan batas PV untuk sistem yang terdeteksi. */
export function pwmSetpoints(
  scc: SccPwmElectrical,
  batteryType: SccBatteryType,
  voltageScale = 1,
): PwmSetpoints {
  const is24V = voltageScale > 1;
  return {
    voltageScale,
    absorptionV: scc.absorptionV[batteryType] * voltageScale,
    floatV: scc.floatV * voltageScale,
    rechargeV: scc.rechargeV * voltageScale,
    loadDisconnectV: scc.loadDisconnectV * voltageScale,
    loadReconnectV: scc.loadReconnectV * voltageScale,
    pvVocMaxV: is24V ? scc.pvVocMax24VV : scc.pvVocMax12VV,
    pvPowerMaxW: is24V ? scc.pvPowerMax24VW : scc.pvPowerMax12VW,
  };
}

/** Voc array terhadap batas SCC: normal, galat (tidak mengisi), atau rusak (§2.3). */
export function pwmVocStatus(
  arrayVocV: number,
  pvVocMaxV: number,
  protection: SccPwmProtection,
): SccVocStatus {
  if (arrayVocV <= pvVocMaxV) return 'ok';
  return arrayVocV <= pvVocMaxV * protection.vocFaultFactor ? 'fault' : 'damaged';
}

/**
 * Titik kerja pengisian: Ichg = min(I_array(Vbat + Vsw), Ichg_max, Iaccept).
 * `acceptanceA` = arus yang masih diterima baterai (tahap absorption/float membatasinya).
 */
export function pwmChargePoint(
  scc: SccPwmElectrical,
  array: PvArray,
  batteryVoltageV: number,
  acceptanceA = Number.POSITIVE_INFINITY,
): PwmChargePoint {
  const pvVoltageV = batteryVoltageV + scc.switchDropV;
  if (batteryVoltageV <= 0) return { pvVoltageV: 0, chargeCurrentA: 0, harvestW: 0, pvPowerW: 0 };
  const chargeCurrentA = Math.max(
    Math.min(pvArrayCurrentA(array, pvVoltageV), scc.chargeCurrentMaxA, acceptanceA),
    0,
  );
  return {
    pvVoltageV,
    chargeCurrentA,
    harvestW: batteryVoltageV * chargeCurrentA,
    pvPowerW: pvVoltageV * chargeCurrentA,
  };
}

/**
 * Tahap pengisian berikutnya: bulk → absorption saat Vbat ≥ Vabs; absorption → float setelah
 * `absorptionDurationMin`; float → bulk saat Vbat < Vrecharge.
 */
export function pwmNextStage(
  scc: SccPwmElectrical,
  setpoints: PwmSetpoints,
  stage: SccChargeStage,
  batteryVoltageV: number,
  absorptionElapsedS: number,
): SccChargeStage {
  if (stage === 'bulk') return batteryVoltageV >= setpoints.absorptionV ? 'absorption' : 'bulk';
  if (stage === 'absorption') {
    const durationS = scc.absorptionDurationMin * SECONDS_PER_MINUTE;
    return absorptionElapsedS >= durationS ? 'float' : 'absorption';
  }
  return batteryVoltageV < setpoints.rechargeV ? 'bulk' : 'float';
}

/** Terminal beban: putus saat Vbat ≤ Vlvd, tersambung lagi saat Vbat ≥ Vlvr (histeresis). */
export function pwmLoadConnected(
  setpoints: PwmSetpoints,
  wasConnected: boolean,
  batteryVoltageV: number,
): boolean {
  if (batteryVoltageV <= setpoints.loadDisconnectV) return false;
  if (batteryVoltageV >= setpoints.loadReconnectV) return true;
  return wasConnected;
}

/**
 * Waktu sampai terminal beban diputus karena arus lebih (kurva `[I/Iload_max, detik]`).
 * `Infinity` sampai Iload_max; antara Iload_max dan titik pertama memakai waktu titik pertama.
 */
export function pwmLoadOverloadTimeS(
  scc: SccPwmElectrical,
  protection: SccPwmProtection,
  loadCurrentA: number,
): number {
  const ratio = Math.abs(loadCurrentA) / scc.loadCurrentMaxA;
  if (ratio <= 1 || protection.loadOverloadCurve.length === 0) return Number.POSITIVE_INFINITY;
  return interpolateLogLog(protection.loadOverloadCurve, ratio);
}
