// Tipe rangkaian di meja kerja dan netlist hasil `buildNetlist` (docs/MODEL_FISIKA.md §12 butir 1).
import type { CableItem, CatalogItem, TerminalKind } from '../types';

export interface TerminalRef {
  componentId: string;
  terminalId: string;
}

/** Bagian item katalog yang dipakai netlist; setiap `CatalogItem` memenuhinya. */
export type CircuitItem = Pick<CatalogItem, 'id' | 'category' | 'terminals'>;

/** Satu komponen di meja kerja; `id` unik per rangkaian, bukan id katalog. */
export interface CircuitComponent {
  id: string;
  item: CircuitItem;
}

/** Kabel dari terminal ke terminal. */
export interface Wire {
  id: string;
  from: TerminalRef;
  to: TerminalRef;
  /** Id item kabel di katalog, mis. `cable-pv-h1z2z2k`. */
  cableId: string;
  areaMm2: number;
  /** Panjang satu arah. */
  lengthM: number;
}

/** Sambungan di dalam komponen (rel busbar, kontak MCB tertutup); digabung seperti kabel. */
export interface Bridge {
  from: TerminalRef;
  to: TerminalRef;
}

/** Kumpulan terminal yang tersambung langsung. */
export interface Net {
  id: string;
  terminals: TerminalRef[];
  /** Jenis terminal di dalam net, tanpa ulangan; `dc+` bersama `dc-` berarti hubung singkat. */
  kinds: TerminalKind[];
}

export interface NetlistWire extends Wire {
  netId: string;
}

export const NETLIST_ISSUE_CODES = [
  'duplicate-component',
  'unknown-component',
  'unknown-terminal',
  'self-loop',
  'duplicate-wire',
  'too-many-wires',
] as const;
export type NetlistIssueCode = (typeof NETLIST_ISSUE_CODES)[number];

/** Salah rangkai yang ditemukan saat membangun netlist; `wireId` kosong berarti dari `Bridge`. */
export interface NetlistIssue {
  code: NetlistIssueCode;
  wireId?: string;
  componentId?: string;
  terminal?: TerminalRef;
}

export interface Netlist {
  nets: Net[];
  /** `netIdByTerminal[componentId][terminalId]`. */
  netIdByTerminal: Record<string, Record<string, string>>;
  /** Kabel yang sah, urut menurut id. */
  wires: NetlistWire[];
  issues: NetlistIssue[];
}

/** Komponen di meja kerja dengan item katalog lengkap; dipakai `validateCircuit`. */
export interface PlacedComponent {
  id: string;
  item: CatalogItem;
}

/** Satu kabel dipasang atau dilepas; `closedSwitchIds` = MCB/fuse yang ON saat itu. */
export interface WiringEvent {
  action: 'connect' | 'disconnect';
  wire: Wire;
  closedSwitchIds: readonly string[];
}

export const FINDING_CODES = [
  'reverse-polarity',
  'short-circuit',
  'pv-direct',
  'pv-voc-over-limit',
  'breaker-overcurrent',
  'cable-overcurrent',
  'cable-unknown',
  'system-voltage-mismatch',
  'pv-before-battery',
  'open-circuit',
  'ac-load-on-dc',
  'gridtie-without-grid',
  'pe-not-connected',
  'live-rewiring',
] as const;
export type FindingCode = (typeof FINDING_CODES)[number];

/** Urut dari yang paling ringan. */
export const FINDING_SEVERITIES = ['info', 'warning', 'danger'] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

/** Hasil satu aturan pemeriksaan; teks tampilannya ada di src/i18n/id.ts per `code`. */
export interface Finding {
  code: FindingCode;
  severity: FindingSeverity;
  /** Komponen terkait, urut menurut id. */
  componentIds: string[];
  wireIds?: string[];
  terminals?: TerminalRef[];
  /** Angka pendukung, satuan di nama kunci (mis. `vocColdV`, `limitV`). */
  params?: Record<string, number>;
}

export interface ValidationInput {
  components: readonly PlacedComponent[];
  wires: readonly Wire[];
  /** Item kabel katalog yang dirujuk `wire.cableId`. */
  cables: readonly CableItem[];
  /** MCB/fuse yang ON; tanpa nilai berarti semua ON. */
  closedSwitchIds?: readonly string[];
  /** Suhu sel terendah untuk Voc dingin; bawaan `DEFAULT_MIN_CELL_TEMP_C`. */
  minCellTempC?: number;
  /** Suhu sekitar untuk KHA kabel; bawaan `DEFAULT_AMBIENT_TEMP_C`. */
  ambientTempC?: number;
  /** Arus terukur dari engine; tanpa nilai dipakai taksiran statis. */
  currentAByWireId?: Readonly<Record<string, number>>;
  currentAByComponentId?: Readonly<Record<string, number>>;
  /** Riwayat pemasangan kabel, urut waktu; dipakai aturan urutan. */
  wiringLog?: readonly WiringEvent[];
}
