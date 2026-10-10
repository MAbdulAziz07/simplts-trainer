// Model inverter off-grid: rugi terhadap beban, beban lebih, LVD/HVD berhisteresis
// (docs/MODEL_FISIKA.md §5). Grid-tie (§6) dan hibrida (§7) belum dimodelkan pada putaran ini.
import type { InverterOffgridElectrical, InverterOffgridProtection } from '../catalog/inverters';
import { interpolateLogLog } from './numeric';

export interface InverterLossCoefficients {
  k1: number;
  /** Satuan 1/W. */
  k2: number;
}

/** Keadaan proteksi tegangan DC; `on = false` berarti keluaran AC mati. */
export interface InverterDcState {
  on: boolean;
  /** Lama tegangan DC terus-menerus di bawah Vlvd. */
  lowVoltageS: number;
}

/** Koefisien rugi k1, k2 dari P0, η50, η100 (§5.2). */
export function inverterLossCoefficients(
  inverter: InverterOffgridElectrical,
): InverterLossCoefficients {
  const { ratedAcPowerW: ratedW, noLoadPowerW } = inverter;
  const fullLossW = ratedW / inverter.efficiencyAtFullLoad - ratedW - noLoadPowerW;
  const halfLossW = ratedW / 2 / inverter.efficiencyAtHalfLoad - ratedW / 2 - noLoadPowerW;
  const k2 = (fullLossW - 2 * halfLossW) / (ratedW ** 2 / 2);
  const k1 = (halfLossW - (k2 * ratedW ** 2) / 4) / (ratedW / 2);
  return { k1, k2 };
}

/** Daya DC masukan untuk keluaran AC `acOutputW`: Pout + P0 + k1·Pout + k2·Pout². Idle = P0. */
export function inverterDcInputW(inverter: InverterOffgridElectrical, acOutputW: number): number {
  if (acOutputW <= 0) return inverter.noLoadPowerW;
  const { k1, k2 } = inverterLossCoefficients(inverter);
  return acOutputW + inverter.noLoadPowerW + k1 * acOutputW + k2 * acOutputW ** 2;
}

/** Efisiensi η = Pout/Pin; 0 saat tanpa beban. */
export function inverterEfficiency(inverter: InverterOffgridElectrical, acOutputW: number): number {
  return acOutputW > 0 ? acOutputW / inverterDcInputW(inverter, acOutputW) : 0;
}

/**
 * Waktu sampai mati karena beban lebih (kurva `[P/Pr, detik]`, log-log).
 * `Infinity` sampai Pr; antara Pr dan titik pertama memakai waktu titik pertama;
 * di atas titik terakhir (lonjakan) memakai waktu titik terakhir.
 */
export function inverterOverloadTimeS(
  inverter: InverterOffgridElectrical,
  protection: InverterOffgridProtection,
  acOutputW: number,
): number {
  const ratio = acOutputW / inverter.ratedAcPowerW;
  const last = protection.overloadCurve[protection.overloadCurve.length - 1];
  if (ratio <= 1 || !last) return Number.POSITIVE_INFINITY;
  if (ratio >= last[0]) return last[1];
  return interpolateLogLog(protection.overloadCurve, ratio);
}

/** Alarm tegangan rendah (belum memutus). */
export function inverterLowVoltageAlarm(
  inverter: InverterOffgridElectrical,
  dcVoltageV: number,
): boolean {
  return dcVoltageV < inverter.dcVoltageLowAlarmV;
}

/**
 * Proteksi tegangan DC setelah `dtS`: mati bila V < Vlvd terus-menerus selama tunda LVD atau
 * V > Vhvd (seketika); hidup lagi saat V kembali di antara Vlvr dan Vhvd.
 */
export function inverterStepDcState(
  inverter: InverterOffgridElectrical,
  state: InverterDcState,
  dcVoltageV: number,
  dtS: number,
): InverterDcState {
  if (dcVoltageV > inverter.dcVoltageHvdV) return { on: false, lowVoltageS: 0 };
  if (!state.on) {
    return { on: dcVoltageV >= inverter.dcVoltageLvrV, lowVoltageS: 0 };
  }
  if (dcVoltageV >= inverter.dcVoltageLvdV) return { on: true, lowVoltageS: 0 };
  const lowVoltageS = state.lowVoltageS + dtS;
  return lowVoltageS >= inverter.lvdDelayS
    ? { on: false, lowVoltageS: 0 }
    : { on: true, lowVoltageS };
}
