// Model proteksi: kurva waktu-arus MCB dan fuse, dosis termal, kemampuan memutus
// (docs/MODEL_FISIKA.md §9.1–9.2). Datasheet tidak memuat kurva; seluruh titik kurva asumsi.
import type { McbAcElectrical, McbDcElectrical } from '../catalog/protection';
import type { CurvePoint, TripCurve } from '../catalog/shared';
import { interpolateLogLog } from './numeric';

/** Titik kurva termal MCB `[I/In, detik]` (§9.1). [PERLU VERIFIKASI] */
export const MCB_THERMAL_POINTS: CurvePoint[] = [
  [1.13, 7200],
  [1.45, 1800],
  [2.55, 20],
  [5, 6],
];
/** Ambang magnetik AC per kurva, kelipatan In (§9.1). [PERLU VERIFIKASI] */
export const MCB_MAGNETIC_MULTIPLE: Record<TripCurve, number> = { B: 4, C: 8, D: 14, K: 12, Z: 3 };
/** Faktor ambang magnetik pada DC `kdc`. [PERLU VERIFIKASI] */
export const MCB_DC_MAGNETIC_FACTOR = 1.4;
export const MCB_MAGNETIC_TRIP_TIME_S = 0.02;
/** Penurunan In per °C di atas suhu acuan. [PERLU VERIFIKASI] */
const MCB_TEMP_DERATING_PER_C = 0.005;
/** Konstanta waktu pendinginan dosis termal τcool. [PERLU VERIFIKASI] */
export const THERMAL_COOL_TIME_S = 300;
/** Proteksi trip/putus saat dosis termal mencapai nilai ini. */
export const THERMAL_DOSE_TRIP = 1;
/** MCB tanpa rating DC di sirkuit DC: batas tegangan dan kelipatan arus yang masih padam (§9.1). */
const UNRATED_DC_MAX_VOLTAGE_V = 48;
const UNRATED_DC_MAX_CURRENT_MULTIPLE = 3;

/** In efektif pada suhu sekitar: In·(1 − 0.005·(Ta − Tref)). */
export function mcbEffectiveRatedCurrentA(
  ratedCurrentA: number,
  ambientTempC: number,
  refTempC: number,
): number {
  return ratedCurrentA * (1 - MCB_TEMP_DERATING_PER_C * (ambientTempC - refTempC));
}

/** Arus ambang trip magnetik (seketika). */
export function mcbMagneticThresholdA(
  ratedCurrentA: number,
  curve: TripCurve,
  isDc: boolean,
): number {
  return ratedCurrentA * MCB_MAGNETIC_MULTIPLE[curve] * (isDc ? MCB_DC_MAGNETIC_FACTOR : 1);
}

/**
 * Waktu trip MCB pada arus tetap. `effectiveRatedCurrentA` = In setelah koreksi suhu.
 * `Infinity` = tidak trip (I ≤ 1.13·In); 0.02 s = trip magnetik.
 */
export function mcbTripTimeS(
  currentA: number,
  effectiveRatedCurrentA: number,
  curve: TripCurve,
  isDc: boolean,
): number {
  const current = Math.abs(currentA);
  if (current >= mcbMagneticThresholdA(effectiveRatedCurrentA, curve, isDc)) {
    return MCB_MAGNETIC_TRIP_TIME_S;
  }
  const ratio = current / effectiveRatedCurrentA;
  const [noTripRatio] = MCB_THERMAL_POINTS[0] ?? [1];
  if (ratio <= noTripRatio) return Number.POSITIVE_INFINITY;
  return Math.max(interpolateLogLog(MCB_THERMAL_POINTS, ratio), MCB_MAGNETIC_TRIP_TIME_S);
}

/**
 * Waktu lebur fuse dari titik kurva katalog `[I/In, detik]`.
 * `Infinity` di bawah titik pertama; di atas titik terakhir memakai waktu titik terakhir.
 */
export function fuseMeltTimeS(
  currentA: number,
  ratedCurrentA: number,
  timeCurrentPoints: readonly CurvePoint[],
): number {
  const first = timeCurrentPoints[0];
  const last = timeCurrentPoints[timeCurrentPoints.length - 1];
  if (!first || !last) return Number.POSITIVE_INFINITY;
  const ratio = Math.abs(currentA) / ratedCurrentA;
  if (ratio <= first[0]) return Number.POSITIVE_INFINITY;
  if (ratio >= last[0]) return last[1];
  return interpolateLogLog(timeCurrentPoints, ratio);
}

/**
 * Dosis termal setelah `dtS` (arus berubah-ubah): bertambah dt/t_trip saat arus lebih,
 * mendingin dengan τcool saat I < In, tetap di antaranya. Trip saat dosis ≥ 1.
 */
export function thermalDoseStep(
  dose: number,
  tripTimeS: number,
  loadRatio: number,
  dtS: number,
  coolTimeS = THERMAL_COOL_TIME_S,
): number {
  if (Number.isFinite(tripTimeS)) return dose + dtS / Math.max(tripTimeS, Number.EPSILON);
  if (loadRatio < 1) return dose * Math.exp(-dtS / coolTimeS);
  return dose;
}

/**
 * `true` bila MCB DC mampu memadamkan busur saat memutus. `false` = MCB rusak saat harus trip:
 * tegangan sistem > Ue, arus > Icu, atau polaritas terbalik pada MCB berpolaritas.
 */
export function mcbDcCanInterrupt(
  mcb: McbDcElectrical,
  systemVoltageV: number,
  interruptedCurrentA: number,
  reversedPolarity = false,
): boolean {
  if (mcb.polarized && reversedPolarity) return false;
  if (Math.abs(systemVoltageV) > mcb.ratedVoltageDcV) return false;
  return Math.abs(interruptedCurrentA) <= mcb.breakingCapacityKa * 1000;
}

/**
 * MCB AC yang dipasang di sirkuit DC. Tanpa rating DC di datasheet, busur hanya padam bila
 * tegangan < 48 V dan arus yang diputus ≤ 3·In.
 */
export function mcbAcCanInterruptDc(
  mcb: McbAcElectrical,
  systemVoltageV: number,
  interruptedCurrentA: number,
): boolean {
  const current = Math.abs(interruptedCurrentA);
  if (current > mcb.breakingCapacityKa * 1000) return false;
  if (mcb.ratedVoltageDcV !== null) return Math.abs(systemVoltageV) <= mcb.ratedVoltageDcV;
  return (
    Math.abs(systemVoltageV) < UNRATED_DC_MAX_VOLTAGE_V &&
    current <= UNRATED_DC_MAX_CURRENT_MULTIPLE * mcb.ratedCurrentA
  );
}

/** Arus hubung singkat prospektif sumber tegangan: V / R total (baterai + kabel + kontak). */
export function faultCurrentA(sourceVoltageV: number, loopResistanceOhm: number): number {
  return loopResistanceOhm > 0 ? sourceVoltageV / loopResistanceOhm : Number.POSITIVE_INFINITY;
}
