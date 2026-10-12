// Tipe langkah waktu: keadaan yang dibawa antarlangkah, kejadian, dan snapshot
// (docs/MODEL_FISIKA.md §12 butir 3–4, docs/ARSITEKTUR.md §2 langkah 4c–4d).
import type { SystemTopology } from '../circuit/subsystem-types';
import type { PlacedComponent, Wire } from '../circuit/types';
import type { BmsCutoffReason, BmsState } from '../components/bms';
import type { InverterDcState } from '../components/inverter';
import type { KwhMeterEnergy } from '../components/meter';
import type { SccBatteryType, SccChargeStage } from '../components/scc';
import type { CableItem } from '../types';
import type { SolvedSystem } from './solver';
import type { OperatingPoint, Reading, SolverEnvironment, SolverState } from './types';

export interface SccSimState {
  stage: SccChargeStage;
  absorptionElapsedS: number;
  /** Terminal beban tersambung (belum diputus LVD SCC). */
  loadConnected: boolean;
  /** Terminal beban diputus karena arus lebih; terkunci sampai direset. */
  loadOverloaded?: boolean;
  /** Skala tegangan sistem; terkunci saat SCC pertama melihat baterai. */
  voltageScale?: number;
}

export interface InverterSimState extends InverterDcState {
  /** Sebab mati terakhir; kosong selama hidup. `overload` terkunci sampai direset. */
  offReason?: 'lvd' | 'hvd' | 'overload';
}

/** Energi kumulatif di terminal alat; rugi di dalam baterai tidak termasuk `lossWh`. */
export interface EnergyTotals {
  pvWh: number;
  loadWh: number;
  batteryChargeWh: number;
  batteryDischargeWh: number;
  gridImportWh: number;
  gridExportWh: number;
  /** Rugi kabel, SCC, dan inverter. */
  lossWh: number;
}

/** Keadaan simulasi; objek biasa, tidak pernah diubah di tempat. Kunci = id di meja kerja. */
export interface SimState {
  timeS: number;
  /** MCB/fuse yang ON. */
  closedSwitchIds: string[];
  /** MCB yang OFF karena trip (bukan dimatikan tangan); dihapus pemanggil saat di-ON-kan lagi. */
  trippedSwitchIds: string[];
  blownFuseIds: string[];
  damagedComponentIds: string[];
  damagedWireIds: string[];
  socPctByBatteryId: Record<string, number>;
  sccById: Record<string, SccSimState>;
  inverterById: Record<string, InverterSimState>;
  bmsById: Record<string, BmsState>;
  /** Dosis termal MCB/fuse; trip saat ≥ 1. */
  thermalDoseBySwitchId: Record<string, number>;
  /** Dosis beban lebih inverter dan terminal beban SCC; mati saat ≥ 1. */
  overloadDoseById: Record<string, number>;
  conductorTempCByWireId: Record<string, number>;
  /** Lama suhu konduktor di zona rusak. */
  overheatSByWireId: Record<string, number>;
  meterEnergyById: Record<string, KwhMeterEnergy>;
  energy: EnergyTotals;
}

/** Setelan yang diatur pengguna atau skenario; tidak diubah stepper. */
export interface SimControls extends Pick<
  SolverState,
  'powerSettingWByLoadId' | 'shadedFractionByPvId' | 'gridAvailableById'
> {
  /** Bawaan `sealed`. */
  batteryTypeBySccId?: Readonly<Record<string, SccBatteryType>>;
}

export const SIM_EVENT_KINDS = [
  'mcb-trip',
  'fuse-blown',
  'bms-cutoff',
  'inverter-lvd',
  'inverter-hvd',
  'inverter-overload',
  'scc-load-overload',
  'component-damaged',
] as const;
export type SimEventKind = (typeof SIM_EVENT_KINDS)[number];

/** Sebab rusak: tidak mampu memadamkan busur, Voc PV di atas batas, kabel terlalu panas, arus lebih. */
export type DamageCause = 'cannot-interrupt' | 'pv-overvoltage' | 'cable-overheat' | 'overcurrent';
export type SimEventCause = 'thermal' | 'magnetic' | BmsCutoffReason | DamageCause;

/** Kejadian pada satu komponen atau satu kabel; teks tampilannya di luar domain. */
export interface SimEvent {
  kind: SimEventKind;
  timeS: number;
  componentId?: string;
  wireId?: string;
  cause?: SimEventCause;
  /** Angka pendukung, satuan di nama kunci (mis. `currentA`). */
  params?: Record<string, number>;
}

export interface StepInput {
  components: readonly PlacedComponent[];
  wires: readonly Wire[];
  /** Item kabel katalog yang dirujuk `wire.cableId`. */
  cables: readonly CableItem[];
  /** Dianggap tetap selama satu panggilan. */
  environment: SolverEnvironment;
  state: SimState;
  /** Waktu nyata langkah ini; waktu simulasi yang ditempuh = `dtS × speed`. */
  dtS: number;
  /** Pengali kecepatan; bawaan 1. */
  speed?: number;
  controls?: SimControls;
  /** Batas sub-langkah per panggilan; bawaan `DEFAULT_MAX_SUBSTEPS`. */
  maxSubsteps?: number;
}

/** `floating` = potensial tidak ditentukan sumber mana pun; tegangannya dilaporkan 0. */
export interface TerminalReading extends Reading {
  floating: boolean;
}

export interface CircuitPotentials {
  /** Kunci = id net; tegangan rata-rata terminalnya, arus terbesar kabelnya. */
  nets: Record<string, Reading>;
  /** Kunci = `komponen.terminal`; arus positif = keluar dari terminal ke kabel. */
  terminals: Record<string, TerminalReading>;
}

/** Rangkaian yang sudah dihitung pada satu saat. */
export interface SimFrame {
  environment: SolverEnvironment;
  cables: readonly CableItem[];
  controls: SimControls;
  topology: SystemTopology;
  solved: SolvedSystem;
  point: OperatingPoint;
  potentials: CircuitPotentials;
}

/** Hasil satu bagian pembaruan keadaan untuk satu sub-langkah. */
export interface StepOutcome {
  state: SimState;
  events: SimEvent[];
  /** Ada perubahan keadaan diskret; sub-langkah yang panjang diulang lebih pendek. */
  transition: boolean;
  /** Perubahan itu seketika (magnetik, hubung singkat, rusak). */
  instant: boolean;
}

export const COMPONENT_CONDITIONS = [
  'ok',
  'off',
  'tripped',
  'blown',
  'cutoff',
  'lvd',
  'hvd',
  'overload',
  'fault',
  'collapsed',
  'damaged',
  'unsupported',
] as const;
export type ComponentCondition = (typeof COMPONENT_CONDITIONS)[number];

export interface ComponentStatus {
  condition: ComponentCondition;
  socPct?: number;
  thermalDose?: number;
  chargeStage?: SccChargeStage;
  loadConnected?: boolean;
}

export type WireCondition = 'ok' | 'overheating' | 'damaged';

/** `overheating` = suhu konduktor di zona rusak, penghitung tunda berjalan. */
export interface WireStatus {
  condition: WireCondition;
  conductorTempC: number;
  currentA: number;
  /** Arus bertanda: positif = dari `wire.from` ke `wire.to`. */
  flowA: number;
  voltageDropV: number;
}

export interface Snapshot {
  timeS: number;
  nets: Record<string, Reading>;
  terminals: Record<string, TerminalReading>;
  components: Record<string, ComponentStatus>;
  /** Kunci = id kabel; kabel rusak berarus 0. */
  wires: Record<string, WireStatus>;
  energy: EnergyTotals;
  /** Kejadian selama panggilan ini, urut waktu. */
  events: SimEvent[];
  /** Bacaan rinci per alat pada akhir langkah. */
  operatingPoint: OperatingPoint;
}

export interface StepResult {
  state: SimState;
  snapshot: Snapshot;
  /** Waktu simulasi yang benar-benar ditempuh; kurang dari `dtS × speed` bila batas sub-langkah tercapai. */
  simulatedS: number;
}
