// Masukan dan hasil `solveOperatingPoint` (docs/MODEL_FISIKA.md §12, docs/ARSITEKTUR.md §2).
import type { SystemTopology } from '../circuit/subsystem-types';
import type { SccBatteryType, SccChargeStage, SccVocStatus } from '../components/scc';
import type { CableItem } from '../types';

export interface SolverEnvironment {
  irradianceWm2: number;
  ambientTempC: number;
}

/** Keadaan SCC yang dibawa antarlangkah; yang kosong memakai bawaan. */
export interface SccState {
  /** Bawaan `bulk`. */
  stage?: SccChargeStage;
  /** Bawaan `sealed`. */
  batteryType?: SccBatteryType;
  /** Skala tegangan sistem hasil deteksi (1 atau 2); bawaan dideteksi dari tegangan bank. */
  voltageScale?: number;
  /** Terminal beban tersambung (belum diputus LVD/beban lebih); bawaan `true`. */
  loadConnected?: boolean;
}

/** Keadaan per komponen; kunci = id komponen di meja kerja. */
export interface SolverState {
  /** Bawaan 100. */
  socPctByBatteryId?: Readonly<Record<string, number>>;
  sccById?: Readonly<Record<string, SccState>>;
  /** Inverter hidup (belum mati karena proteksi); bawaan `true`. */
  inverterOnById?: Readonly<Record<string, boolean>>;
  /** Setelan daya beban; bawaan daya maksimum beban. */
  powerSettingWByLoadId?: Readonly<Record<string, number>>;
  /** Bagian luas modul yang teduh, 0..1; bawaan 0. */
  shadedFractionByPvId?: Readonly<Record<string, number>>;
  /** Bawaan `availableDefault` katalog. */
  gridAvailableById?: Readonly<Record<string, boolean>>;
  /** Suhu konduktor kabel; bawaan suhu sekitar. */
  conductorTempCByWireId?: Readonly<Record<string, number>>;
}

export interface SolverInput {
  /** Hasil `recognizeSubsystems` untuk keadaan MCB/fuse saat ini. */
  topology: SystemTopology;
  /** Item kabel katalog yang dirujuk `wire.cableId`. */
  cables: readonly CableItem[];
  environment: SolverEnvironment;
  state?: SolverState;
}

export interface Reading {
  voltageV: number;
  currentA: number;
  powerW: number;
}

/** Arus dan daya baterai: positif = diisi, negatif = melepas (sama dengan components/battery.ts). */
export type BatteryReading = Reading;

export type SubsystemStatus = 'ok' | 'collapsed' | 'unsupported';

export interface DcBusPoint {
  id: string;
  status: SubsystemStatus;
  /** Tegangan di terminal bank baterai. */
  voltageV: number;
  /** Arus bank; positif = diisi. */
  batteryCurrentA: number;
}

export type SccStatus = 'charging' | 'regulating' | 'idle' | 'no-battery' | SccVocStatus;

export interface SccReading {
  /** `fault`/`damaged` = Voc array di atas batas (§2.3); `idle` = tanpa arus PV. */
  status: Exclude<SccStatus, 'ok'>;
  pvVoltageV: number;
  chargeCurrentA: number;
  batteryVoltageV: number;
  /** Arus terminal beban SCC. */
  loadCurrentA: number;
  /** Daya dari array di terminal PV: Vpv·Ichg. */
  pvPowerW: number;
  /** Rugi sakelar dan konsumsi sendiri. */
  lossW: number;
}

/** `collapsed` = daya DC yang diminta tidak tersedia; `no-dc` = masukan DC tanpa baterai. */
export type InverterStatus = 'on' | 'off' | 'collapsed' | 'no-dc';

export interface InverterReading {
  status: InverterStatus;
  dcVoltageV: number;
  dcCurrentA: number;
  dcPowerW: number;
  acVoltageV: number;
  acCurrentA: number;
  acPowerW: number;
}

/** `dead` = sumbernya mati atau padam. */
export type AcBusStatus = 'ok' | 'dead' | 'unsupported';

export interface AcBusPoint {
  id: string;
  status: AcBusStatus;
  voltageV: number;
  sourceId?: string;
}

/** Neraca daya sesaat (§12 butir 5): pv + batteryDischarge + gridImport = load + rugi + residual. */
export interface PowerBalance {
  pvW: number;
  /** Positif = baterai melepas. */
  batteryDischargeW: number;
  /** Positif = impor dari jaringan. */
  gridImportW: number;
  loadW: number;
  wireLossW: number;
  sccLossW: number;
  inverterLossW: number;
  residualW: number;
}

export type OperatingStatus = 'ok' | 'collapsed' | 'unsupported' | 'no-source';

export interface OperatingPoint {
  /** `no-source` = tidak ada bus yang bertegangan; `unsupported` = ada bagian yang belum dimodelkan. */
  status: OperatingStatus;
  dcBuses: DcBusPoint[];
  acBuses: AcBusPoint[];
  /** Daya dan arus yang diberikan tiap modul PV. */
  pvModules: Record<string, Reading>;
  batteries: Record<string, BatteryReading>;
  sccs: Record<string, SccReading>;
  inverters: Record<string, InverterReading>;
  /** Beban DC dan AC: tegangan terminal, arus, daya terserap. */
  loads: Record<string, Reading>;
  /** Jaringan: arus dan daya positif = impor. */
  grids: Record<string, Reading>;
  /** Besar arus tiap kabel; bisa diteruskan ke `validateCircuit`. */
  currentAByWireId: Record<string, number>;
  /** Besar arus lewat MCB, fuse, dan kWh meter (kutub terbesar). */
  currentAByComponentId: Record<string, number>;
  voltageDropVByWireId: Record<string, number>;
  /** Kabel yang menutup lingkaran; arusnya tidak dihitung. */
  loopWireIds: string[];
  balance: PowerBalance;
}
