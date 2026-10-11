// Model kabel tembaga: resistansi pergi-pulang, jatuh tegangan, pemanasan konduktor
// (docs/MODEL_FISIKA.md §8). Panjang selalu SATU arah; resistansi dihitung pergi + pulang.
import type { CableElectrical, CableProtection } from '../catalog/balance';
import { interpolate } from './numeric';

const RESISTIVITY_REF_TEMP_C = 20;
const SECONDS_PER_MINUTE = 60;

/** Ambang jatuh tegangan yang ditampilkan (§8.2): hijau ≤ 3%, kuning ≤ 5%. [PERLU VERIFIKASI] */
export const CABLE_DROP_OK_PCT = 3;
export const CABLE_DROP_WARNING_PCT = 5;
/** Batas `I/Iz` antara hangat dan panas (§8.2). [PERLU VERIFIKASI] */
const CABLE_HOT_LOAD_RATIO = 1.25;

export type CableDropLevel = 'ok' | 'warning' | 'bad';
export type CableHeatLevel = 'normal' | 'warm' | 'hot';

export interface CableRun {
  areaMm2: number;
  /** Panjang satu arah. */
  lengthM: number;
  /** Suhu konduktor; bawaan 20 °C. */
  conductorTempC?: number;
  /** Jumlah sambungan/terminal pada jalur. */
  jointCount?: number;
}

/** Resistivitas tembaga pada suhu konduktor: ρ20·(1 + αCu·(T − 20)). */
export function cableResistivityOhmMm2PerM(cable: CableElectrical, conductorTempC: number): number {
  return (
    cable.resistivityOhmMm2PerM *
    (1 + cable.tempCoeffPerC * (conductorTempC - RESISTIVITY_REF_TEMP_C))
  );
}

/** Resistansi pergi-pulang: ρ(T)·2L/A·Kcl + sambungan·Rc. */
export function cableLoopResistanceOhm(cable: CableElectrical, run: CableRun): number {
  const { areaMm2, lengthM, conductorTempC = RESISTIVITY_REF_TEMP_C, jointCount = 0 } = run;
  const resistivity = cableResistivityOhmMm2PerM(cable, conductorTempC);
  const conductorOhm = ((resistivity * 2 * Math.max(lengthM, 0)) / areaMm2) * cable.tinnedFactor;
  return conductorOhm + (jointCount * cable.contactResistanceMohm) / 1000;
}

/** Jatuh tegangan ΔV = |I|·R_loop. */
export function cableVoltageDropV(currentA: number, loopResistanceOhm: number): number {
  return Math.abs(currentA) * loopResistanceOhm;
}

/** Jatuh tegangan sebagai persen tegangan sumber; sumber 0 V memberi 0. */
export function cableVoltageDropPct(voltageDropV: number, sourceVoltageV: number): number {
  return sourceVoltageV > 0 ? (voltageDropV / sourceVoltageV) * 100 : 0;
}

/** Warna indikator jatuh tegangan. */
export function cableDropLevel(voltageDropPct: number): CableDropLevel {
  if (voltageDropPct <= CABLE_DROP_OK_PCT) return 'ok';
  return voltageDropPct <= CABLE_DROP_WARNING_PCT ? 'warning' : 'bad';
}

/**
 * KHA tabel untuk penampang `areaMm2`; `undefined` bila penampang tidak ada di tabel. Cara pasang
 * bawaan "di udara": kabel PV kolom bebas di udara, NYY kolom udara 30 °C. [PERLU VERIFIKASI]
 */
export function cableTableAmpacityA(cable: CableElectrical, areaMm2: number): number | undefined {
  const size = cable.sizes.find((candidate) => candidate.areaMm2 === areaMm2);
  if (!size) return undefined;
  return 'ampacityAirA' in size ? size.ampacityAirA : size.ampacityAir30A;
}

/**
 * KHA efektif: KHA tabel (kolom dipilih pemanggil) × faktor suhu sekitar × faktor pengelompokan.
 * Kabel tanpa tabel faktor suhu (NYY) hanya memakai faktor pengelompokan.
 */
export function cableEffectiveAmpacityA(
  cable: CableElectrical,
  tableAmpacityA: number,
  ambientTempC: number,
  groupingFactor = 1,
): number {
  const points = cable.ambientDerating ?? [];
  const ambientFactor =
    points.length > 0
      ? interpolate(
          points.map(([tempC]) => tempC),
          points.map(([, factor]) => factor),
          ambientTempC,
        )
      : 1;
  return tableAmpacityA * ambientFactor * groupingFactor;
}

/** Suhu konduktor tunak: Ta + (Tmax − Tref)·(I/Iz)². */
export function cableSteadyTempC(
  cable: CableElectrical,
  currentA: number,
  ampacityA: number,
  ambientTempC: number,
): number {
  if (ampacityA <= 0) return ambientTempC;
  const loadRatio = Math.abs(currentA) / ampacityA;
  return ambientTempC + (cable.maxConductorTempC - cable.ampacityRefAmbientC) * loadRatio ** 2;
}

/** Suhu konduktor setelah `dtS`: mendekati suhu tunak dengan konstanta waktu τcab. */
export function cableStepTempC(
  cable: CableElectrical,
  conductorTempC: number,
  steadyTempC: number,
  dtS: number,
): number {
  const timeConstantS = cable.thermalTimeConstantMin * SECONDS_PER_MINUTE;
  if (timeConstantS <= 0) return steadyTempC;
  return steadyTempC + (conductorTempC - steadyTempC) * Math.exp(-Math.max(dtS, 0) / timeConstantS);
}

/** Status panas: I/Iz ≤ 1 normal; ≤ 1.25 hangat; di atasnya atau Tcond ≥ Tmax panas. */
export function cableHeatLevel(
  cable: CableElectrical,
  currentA: number,
  ampacityA: number,
  conductorTempC: number,
): CableHeatLevel {
  const loadRatio = ampacityA > 0 ? Math.abs(currentA) / ampacityA : Number.POSITIVE_INFINITY;
  if (loadRatio > CABLE_HOT_LOAD_RATIO || conductorTempC >= cable.maxConductorTempC) return 'hot';
  return loadRatio > 1 ? 'warm' : 'normal';
}

/** `true` bila suhu konduktor sudah di zona rusak (Tmax + margin); lamanya dihitung pemanggil. */
export function cableIsOverheating(protection: CableProtection, conductorTempC: number): boolean {
  return conductorTempC >= protection.maxConductorTempC + protection.overheatDamageMarginK;
}
