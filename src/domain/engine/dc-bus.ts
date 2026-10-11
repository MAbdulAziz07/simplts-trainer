// Titik kerja bus baterai: cari tegangan bus yang membuat jumlah arus masuk = arus keluar
// (docs/MODEL_FISIKA.md §12 butir 2). Baterai sebagai Thevenin (§4.2), sumber dibatasi tegangan
// setelan pengendali, pemakai boleh berdaya konstan (inverter).
import {
  batteryAcceptanceA,
  batteryChargeVoltageV,
  batteryDischargeVoltageV,
  batteryOcvV,
  batteryResistanceOhm,
} from '../components/battery';
import type { BatteryElectrical } from '../catalog/storage';

const SCAN_STEPS = 80;
const BISECT_ITERATIONS = 50;
/** Batas atas pencarian terhadap tegangan istirahat bank saat penuh. */
const SEARCH_RANGE_FACTOR = 2;
const LIMIT_TOLERANCE_V = 1e-9;

/** Bank baterai seragam: `seriesCount` seri × `parallelCount` paralel. */
export interface BatteryBank {
  electrical: BatteryElectrical;
  seriesCount: number;
  parallelCount: number;
  socPct: number;
}

/** Sumber arus ke bus (SCC): arus tersedia turun terhadap tegangan, nol di atas `limitV`. */
export interface BusSource {
  availableA: (busVoltageV: number) => number;
  /** Tegangan bus yang ditahan pengendali (absorption/float). */
  limitV: number;
}

export interface BusSolution {
  voltageV: number;
  /** Arus bank; positif = melepas ke bus, negatif = diisi. */
  batteryCurrentA: number;
  /** Arus tiap sumber, urutannya sama dengan `sources`. */
  sourceCurrentsA: number[];
  sinkCurrentA: number;
  /** `true` bila sumber menahan tegangan bus di `limitV` (arusnya di bawah yang tersedia). */
  regulated: boolean;
  /** `true` bila tidak ada titik kerja: daya yang diminta tidak tersedia (tegangan runtuh). */
  collapsed: boolean;
}

/** Tegangan bank saat istirahat. */
export function bankRestVoltageV(bank: BatteryBank): number {
  return bank.seriesCount * batteryOcvV(bank.electrical, bank.socPct);
}

/**
 * Arus bank pada tegangan terminal bank: positif = melepas, negatif = diisi (dibatasi penerimaan
 * baterai, §4.3). Di antara tegangan lepas dan tegangan isi tanpa arus, baterai tidak berarus.
 */
export function bankCurrentA(bank: BatteryBank, terminalVoltageV: number): number {
  const { electrical, socPct, seriesCount, parallelCount } = bank;
  const unitV = terminalVoltageV / seriesCount;
  const dischargeBaseV = batteryDischargeVoltageV(electrical, socPct, 0);
  if (unitV < dischargeBaseV) {
    const resistanceOhm = batteryResistanceOhm(electrical, socPct);
    const unitA = resistanceOhm > 0 ? (dischargeBaseV - unitV) / resistanceOhm : Infinity;
    return parallelCount * unitA;
  }
  const chargeBaseV = batteryChargeVoltageV(electrical, socPct, 0);
  if (unitV <= chargeBaseV) return 0;
  const chargeOhm = batteryChargeVoltageV(electrical, socPct, 1) - chargeBaseV;
  const unitA = chargeOhm > 0 ? (unitV - chargeBaseV) / chargeOhm : Infinity;
  return -parallelCount * Math.min(unitA, batteryAcceptanceA(electrical, socPct));
}

/**
 * Tegangan bus dan pembagian arus. `bankOffsetV` = tegangan bank dikurangi tegangan bus (jatuh
 * tegangan kabel antarbaterai). Pencarian memindai dari atas lalu bagi-dua, supaya pada beban daya
 * konstan yang terpilih adalah akar stabil (tegangan tinggi); tanpa akar berarti runtuh.
 */
export function solveBus(
  bank: BatteryBank,
  bankOffsetV: number,
  sources: readonly BusSource[],
  sinkA: (busVoltageV: number) => number,
): BusSolution {
  const batteryA = (voltageV: number) => bankCurrentA(bank, voltageV + bankOffsetV);
  const sourceA = (voltageV: number) =>
    sources.reduce(
      (sumA, source) => sumA + (voltageV < source.limitV ? source.availableA(voltageV) : 0),
      0,
    );
  const netA = (voltageV: number) => batteryA(voltageV) + sourceA(voltageV) - sinkA(voltageV);

  const restV = bankRestVoltageV(bank) - bankOffsetV;
  if (sourceA(restV) === 0 && sinkA(restV) === 0) {
    const sourceCurrentsA = sources.map(() => 0);
    return {
      voltageV: restV,
      batteryCurrentA: 0,
      sourceCurrentsA,
      sinkCurrentA: 0,
      regulated: false,
      collapsed: false,
    };
  }

  const highV = SEARCH_RANGE_FACTOR * bank.seriesCount * batteryOcvV(bank.electrical, 100);
  let low = highV;
  let high = highV;
  let found = netA(highV) >= 0;
  for (let i = 1; i <= SCAN_STEPS && !found; i += 1) {
    high = low;
    low = highV * (1 - i / SCAN_STEPS);
    found = low > 0 && netA(low) >= 0;
  }
  if (!found) {
    return {
      voltageV: 0,
      batteryCurrentA: 0,
      sourceCurrentsA: sources.map(() => 0),
      sinkCurrentA: 0,
      regulated: false,
      collapsed: true,
    };
  }
  for (let i = 0; i < BISECT_ITERATIONS; i += 1) {
    const mid = (low + high) / 2;
    if (netA(mid) >= 0) low = mid;
    else high = mid;
  }

  const voltageV = (low + high) / 2;
  const sinkCurrentA = sinkA(voltageV);
  const neededA = sinkCurrentA - batteryA(voltageV);
  // Sumber di bawah setelannya memberi semua yang tersedia; yang tepat di setelan berbagi sisanya.
  const atLimit = sources.map((source) => Math.abs(source.limitV - voltageV) <= LIMIT_TOLERANCE_V);
  const availableA = sources.map((source, i) =>
    atLimit[i]
      ? source.availableA(low)
      : voltageV < source.limitV
        ? source.availableA(voltageV)
        : 0,
  );
  const fixedA = availableA.reduce((sumA, valueA, i) => sumA + (atLimit[i] ? 0 : valueA), 0);
  const flexibleA = availableA.reduce((sumA, valueA, i) => sumA + (atLimit[i] ? valueA : 0), 0);
  const share = flexibleA > 0 ? Math.min(Math.max((neededA - fixedA) / flexibleA, 0), 1) : 0;
  const sourceCurrentsA = availableA.map((valueA, i) => (atLimit[i] ? valueA * share : valueA));
  const suppliedA = sourceCurrentsA.reduce((sumA, valueA) => sumA + valueA, 0);
  return {
    voltageV,
    batteryCurrentA: sinkCurrentA - suppliedA,
    sourceCurrentsA,
    sinkCurrentA,
    regulated: flexibleA > 0 && share < 1,
    collapsed: false,
  };
}
