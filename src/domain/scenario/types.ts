// Tipe skenario praktik: langkah dengan kondisi selesai yang diperiksa otomatis, gangguan
// tersembunyi, dan rubrik nilai (docs/SKENARIO.md). Skema zod-nya ada di src/data/scenarios/.
import type { PackageId } from '../types';
import type { ComponentCondition } from '../engine/step-types';
import type { ClampMode, MeterFunction } from '../instruments/multimeter';
import type { FindingSeverity } from '../circuit/types';

export const SCENARIO_MODES = ['guided', 'troubleshoot', 'assessment'] as const;
export type ScenarioMode = (typeof SCENARIO_MODES)[number];

/** Ikon langkah; dipetakan ke ikon lucide di src/features/scenarios. */
export const STEP_ICONS = [
  'cable',
  'plug',
  'battery',
  'sun',
  'gauge',
  'toggle',
  'lightbulb',
  'search',
  'shield',
  'clock',
  'wrench',
  'zap',
  'check',
] as const;
export type StepIcon = (typeof STEP_ICONS)[number];

/**
 * Penunjuk komponen: id di meja kerja (`bat`), kategori katalog (`scc-pwm`), id katalog
 * (`mcb-dc-16a`), atau alias kelompok (`scc`, `inverter`, `mcb`, `load`, `pv`).
 */
export type ComponentSelector = string;
/** Penunjuk terminal `komponen.terminal`, mis. `scc.bat-pos` atau `battery.pos`. */
export type TerminalSelector = string;

/** Besaran yang dibaca dari snapshot simulasi; jumlah semua komponen sejenis. */
export const SCENARIO_QUANTITIES = [
  'soc-pct',
  'battery-voltage-v',
  'battery-current-a',
  'pv-power-w',
  'load-power-w',
  'sim-time-s',
] as const;
export type ScenarioQuantity = (typeof SCENARIO_QUANTITIES)[number];

/** Nilai acuan yang dihitung dari keadaan saat ini (lingkungan, SoC). */
export const REFERENCE_IDS = ['module-voc', 'module-isc', 'battery-ocv'] as const;
export type ReferenceId = (typeof REFERENCE_IDS)[number];

/** Angka tetap, atau acuan × faktor (mis. dua modul seri: `{ ref: 'module-voc', factor: 2 }`). */
export type ExpectedValue = number | { ref: ReferenceId; factor?: number };

export type ScenarioRule =
  /** Dua terminal satu net: lewat kabel dan busbar; lewat MCB/fuse yang ON bila `throughSwitches`. */
  | { kind: 'connected'; a: TerminalSelector; b: TerminalSelector; throughSwitches?: boolean }
  /** Sedikitnya `count` (bawaan 1) komponen ada di meja kerja. */
  | { kind: 'placed'; component: ComponentSelector; count?: number }
  /** Tuas MCB/fuse ON atau OFF di meja kerja. */
  | { kind: 'switch'; component: ComponentSelector; on: boolean }
  /** Kondisi simulasi salah satu komponen yang ditunjuk termasuk `conditions`. */
  | { kind: 'condition'; component: ComponentSelector; conditions: ComponentCondition[] }
  /** Multimeter terbuka pada fungsi `fn`, probe di terminal yang ditunjuk, bacaan sesuai. */
  | {
      kind: 'multimeter';
      fn: MeterFunction;
      red?: TerminalSelector;
      black?: TerminalSelector;
      expected?: ExpectedValue;
      /** Bawaan 5. */
      tolerancePct?: number;
    }
  /** Tang ampere pada kabel yang salah satu ujungnya di `wire`, bacaan sesuai. */
  | {
      kind: 'clamp';
      mode: ClampMode;
      wire?: TerminalSelector;
      expected?: ExpectedValue;
      tolerancePct?: number;
      /** Bacaan paling kecil (besar arus); bawaan tanpa batas. */
      minA?: number;
    }
  /** Besaran saat ini di antara `min` dan `max`. */
  | { kind: 'value'; quantity: ScenarioQuantity; min?: number; max?: number }
  /** Besaran naik/turun sedikitnya `minDelta` selama `durationS` detik simulasi terakhir. */
  | {
      kind: 'trend';
      quantity: ScenarioQuantity;
      direction: 'rise' | 'fall';
      durationS: number;
      /** Bawaan 0 (asal berubah ke arah itu). */
      minDelta?: number;
    }
  /** Tidak ada temuan pemeriksaan dengan keparahan ini atau lebih (bawaan `danger`). */
  | { kind: 'no-finding'; severity?: FindingSeverity }
  /** Peserta sudah menunjuk gangguan tersembunyi dengan benar. */
  | { kind: 'fault-found' }
  | { kind: 'all'; rules: ScenarioRule[] }
  | { kind: 'any'; rules: ScenarioRule[] };

export type RuleKind = ScenarioRule['kind'];

export interface ScenarioStep {
  id: string;
  /** Satu kalimat perintah. */
  text: string;
  icon: StepIcon;
  done: ScenarioRule;
  /** Petunjuk 1 samar, petunjuk 2 jelas; boleh kosong. */
  hints: string[];
  /** Nilai langkah; bawaan `rubric.stepPoints`. */
  points?: number;
}

export const FAULT_KINDS = [
  'wire-open',
  'fuse-blown',
  'mc4-loose',
  'pv-shaded',
  'battery-weak-cell',
  'scc-setting-wrong',
  'mcb-wrong-rating',
  'grid-outage',
] as const;
export type FaultKind = (typeof FAULT_KINDS)[number];

/**
 * Gangguan tersembunyi. `target` = id kabel (wire-open, mc4-loose) atau id komponen di meja kerja.
 * `value`: bagian teduh 0..1 (pv-shaded), arus pengenal palsu A (mcb-wrong-rating), resistansi
 * kontak Ω (mc4-loose).
 */
export interface Fault {
  kind: FaultKind;
  target: string;
  value?: number;
}

export interface Rubric {
  /** Nilai tiap langkah bila langkah tidak menyebut `points`. */
  stepPoints: number;
  /** Potongan petunjuk 1 dan petunjuk 2 (kumulatif) dari nilai langkah itu. */
  hintPenalty: [number, number];
  /** Nilai menemukan gangguan dengan bukti ukur. */
  faultPoints: number;
  /** Nilai menemukan gangguan tanpa bukti ukur. */
  faultNoEvidencePoints: number;
  /** Potongan tiap jawaban gangguan yang salah. */
  wrongAnswerPenalty: number;
  /** Potongan tiap komponen atau kabel yang rusak. */
  damagePenalty: number;
  /** Potongan tiap jenis temuan bahaya yang pernah muncul. */
  dangerFindingPenalty: number;
  /** Batas lulus dalam persen. */
  passPct: number;
  /** Batas waktu (detik nyata) yang disarankan; hanya dicatat. */
  timeLimitS?: number;
}

export interface ScenarioEnvironment {
  startHour?: number;
  cloudCoverPct?: number;
  irradianceWm2?: number;
}

/** Bentuk skenario sesudah divalidasi; `initialCircuit` adalah isi berkas .simplts.json. */
export interface Scenario<Circuit = unknown> {
  id: string;
  version: number;
  title: string;
  package: PackageId;
  mode: ScenarioMode;
  goal: string;
  initialCircuit?: Circuit;
  environment?: ScenarioEnvironment;
  steps: ScenarioStep[];
  /** Pilihan gangguan untuk instruktur; kosong = semua gangguan yang cocok dengan rangkaian. */
  faults: Fault[];
  /** Jumlah gangguan yang disuntikkan saat diacak. */
  faultCount: number;
  rubric: Rubric;
}
