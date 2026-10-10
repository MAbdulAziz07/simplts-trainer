// Model baterai VRLA dan LiFePO4: tegangan terminal, beban daya konstan, SoC, kapasitas,
// penerimaan arus (docs/MODEL_FISIKA.md §4.2–4.3). Arus > 0 = mengisi, arus < 0 = melepas.
import type { BatteryElectrical } from '../catalog/storage';
import { clamp, interpolate } from './numeric';

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;
const REFERENCE_TEMP_C = 25;

/** Rchg = 3·R(SoC) untuk VRLA, Rint untuk LiFePO4 (§4.2); tidak ada di katalog. [PERLU VERIFIKASI] */
const CHARGE_RESISTANCE_FACTOR = { 'vrla-agm': 3, 'vrla-gel': 3, lifepo4: 1 } as const;
/** Kemiringan kapasitas di luar titik tabel suhu (§4.3). [PERLU VERIFIKASI] */
const CAPACITY_TEMP_SLOPE_PER_C = 0.0056;

export interface BatteryLoadPoint {
  /** Besar arus lepas (positif). */
  currentA: number;
  /** Tegangan di sisi beban, setelah resistansi luar (kabel). */
  voltageV: number;
}

const socFraction = (socPct: number) => clamp(socPct / 100, 0, 1);

/** Tegangan rangkaian terbuka pada keadaan istirahat. */
export function batteryOcvV(battery: BatteryElectrical, socPct: number): number {
  const { ocvSoc, ocvV } = battery.modelParams;
  return interpolate(ocvSoc, ocvV, socFraction(socPct));
}

/** Resistansi internal saat melepas: Rfull·(1 + faktor·(1 − SoC)). */
export function batteryResistanceOhm(battery: BatteryElectrical, socPct: number): number {
  const fullOhm = battery.internalResistanceMohm / 1000;
  return fullOhm * (1 + battery.modelParams.resistanceSocFactor * (1 - socFraction(socPct)));
}

// Suku Kk·exp(−SoC/s0): tegangan runtuh di ujung pengosongan.
const sagV = (battery: BatteryElectrical, socPct: number) => {
  const { sagVoltageV, sagSocScale } = battery.modelParams;
  return sagVoltageV * Math.exp(-socFraction(socPct) / sagSocScale);
};

/** Tegangan saat melepas arus `currentA` (tanda diabaikan), diukur setelah `externalResistanceOhm`. */
export function batteryDischargeVoltageV(
  battery: BatteryElectrical,
  socPct: number,
  currentA: number,
  externalResistanceOhm = 0,
): number {
  const resistanceOhm = batteryResistanceOhm(battery, socPct) + externalResistanceOhm;
  const voltageV = batteryOcvV(battery, socPct) - Math.abs(currentA) * resistanceOhm;
  return Math.max(voltageV - sagV(battery, socPct), 0);
}

/** Tegangan terminal saat diisi arus `currentA` (≥ 0): OCV + ΔVover(SoC) + I·Rchg. */
export function batteryChargeVoltageV(
  battery: BatteryElectrical,
  socPct: number,
  currentA: number,
): number {
  const { overVoltageSoc, overVoltageV } = battery.modelParams;
  const overV = interpolate(overVoltageSoc, overVoltageV, socFraction(socPct));
  const chargeOhm =
    CHARGE_RESISTANCE_FACTOR[battery.chemistry] * batteryResistanceOhm(battery, socPct);
  return batteryOcvV(battery, socPct) + overV + Math.max(currentA, 0) * chargeOhm;
}

/**
 * Titik kerja untuk beban daya konstan `powerW` (mis. masukan inverter): akar kecil dari
 * R·I² − E·I + P = 0. `null` = daya tidak tersedia (tegangan runtuh).
 */
export function batteryConstantPowerPoint(
  battery: BatteryElectrical,
  socPct: number,
  powerW: number,
  externalResistanceOhm = 0,
): BatteryLoadPoint | null {
  const sourceV = batteryOcvV(battery, socPct) - sagV(battery, socPct);
  if (powerW <= 0) return { currentA: 0, voltageV: Math.max(sourceV, 0) };
  const resistanceOhm = batteryResistanceOhm(battery, socPct) + externalResistanceOhm;
  if (sourceV <= 0) return null;
  if (resistanceOhm <= 0) return { currentA: powerW / sourceV, voltageV: sourceV };
  const discriminant = sourceV * sourceV - 4 * resistanceOhm * powerW;
  if (discriminant < 0) return null;
  const currentA = (sourceV - Math.sqrt(discriminant)) / (2 * resistanceOhm);
  return { currentA, voltageV: sourceV - currentA * resistanceOhm };
}

/** Kapasitas efektif pada suhu baterai: Cn·fT(T), ekstrapolasi linier di luar titik tabel. */
export function batteryEffectiveCapacityAh(battery: BatteryElectrical, tempC: number): number {
  const temps = battery.capacityTempPoints.map(([pointTempC]) => pointTempC);
  const factors = battery.capacityTempPoints.map(([, factor]) => factor);
  const minTempC = temps[0] ?? REFERENCE_TEMP_C;
  const maxTempC = temps[temps.length - 1] ?? REFERENCE_TEMP_C;
  const outsideC = tempC < minTempC ? tempC - minTempC : Math.max(tempC - maxTempC, 0);
  const factor =
    (temps.length > 0 ? interpolate(temps, factors, tempC) : 1) +
    CAPACITY_TEMP_SLOPE_PER_C * outsideC;
  return battery.capacityAh * Math.max(factor, 0);
}

/** Efisiensi coulomb pengisian ηc(SoC): tetap sampai lutut, lalu turun linier sampai penuh. */
export function batteryChargeEfficiency(battery: BatteryElectrical, socPct: number): number {
  const { chargeEfficiency, chargeEfficiencyKneeSoc, chargeEfficiencyAtFull } = battery.modelParams;
  return interpolate(
    [chargeEfficiencyKneeSoc, 1],
    [chargeEfficiency, chargeEfficiencyAtFull],
    socFraction(socPct),
  );
}

/** Arus isi yang masih diterima baterai: a·Cn·(1 − SoC); 0 saat penuh. */
export function batteryAcceptanceA(battery: BatteryElectrical, socPct: number): number {
  return battery.modelParams.acceptancePerHour * battery.capacityAh * (1 - socFraction(socPct));
}

/**
 * SoC (%) setelah `dtS` detik pada arus `currentA` (+ isi, − lepas): Peukert saat melepas,
 * ηc saat mengisi, ditambah swa-lepas. Hasil dibatasi 0..100.
 */
export function batteryStepSocPct(
  battery: BatteryElectrical,
  socPct: number,
  currentA: number,
  dtS: number,
  tempC = REFERENCE_TEMP_C,
): number {
  const { peukertExponent, peukertRefHours, selfDischargePctPerDay } = battery.modelParams;
  const capacityAh = batteryEffectiveCapacityAh(battery, tempC);
  let deltaAh = 0;
  if (currentA > 0) {
    deltaAh = batteryChargeEfficiency(battery, socPct) * currentA;
  } else if (currentA < 0) {
    const referenceA = battery.capacityAh / peukertRefHours;
    deltaAh = -Math.abs(currentA) * (Math.abs(currentA) / referenceA) ** (peukertExponent - 1);
  }
  const deltaPct = capacityAh > 0 ? ((deltaAh * dtS) / (SECONDS_PER_HOUR * capacityAh)) * 100 : 0;
  const selfPct = (selfDischargePctPerDay * dtS) / SECONDS_PER_DAY;
  return clamp(socPct + deltaPct - selfPct, 0, 100);
}

/** Koreksi suhu tegangan isi VRLA: ΔV = kT·Nsel·(Tbat − 25), kT dalam mV/°C/sel. */
export function batteryChargeTempCompensationV(
  tempCoeffMvPerCPerCell: number,
  cellCount: number,
  tempC: number,
): number {
  return (tempCoeffMvPerCPerCell / 1000) * cellCount * (tempC - REFERENCE_TEMP_C);
}
