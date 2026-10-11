// Tipe hasil `recognizeSubsystems` (circuit/subsystems.ts): bus baterai, SCC, pemakai DC, bus AC.
import type { Bridge, Netlist, PlacedComponent, TerminalRef } from './types';

/** Sepasang terminal sebuah alat; `pos` = kutub positif atau fasa. */
export interface Port {
  pos: TerminalRef;
  neg: TerminalRef;
}

/** Sumber sejenis (modul PV atau baterai) di antara dua net. */
export interface SourceBank {
  /** String paralel; tiap string berisi id komponen berurutan dari kutub negatif ke positif. */
  strings: string[][];
  /** `true` bila satu komponen dipakai lebih dari satu jalur (seri-paralel campuran). */
  irregular: boolean;
}

export interface DcBus {
  id: string;
  posNetId: string;
  negNetId: string;
  battery: SourceBank;
}

export interface SccNode {
  id: string;
  category: 'scc-pwm' | 'scc-mppt';
  /** Bus baterai di terminal `bat`; kosong bila baterai belum tersambung. */
  busId?: string;
  pv: SourceBank;
  pvPort: Port;
  batPort: Port;
  loadPort?: Port;
}

/** Pemakai DC: beban DC atau masukan inverter off-grid. */
export interface DcConsumer {
  id: string;
  category: 'load-dc' | 'inverter-offgrid';
  port: Port;
  /** Tersambung langsung ke bus baterai. */
  busId?: string;
  /** Tersambung ke terminal beban SCC ini. */
  sccId?: string;
}

export const AC_SOURCE_CATEGORIES = [
  'inverter-offgrid',
  'inverter-gridtie',
  'inverter-hybrid',
  'grid',
] as const;
export type AcSourceCategory = (typeof AC_SOURCE_CATEGORIES)[number];

export interface AcSource {
  id: string;
  category: AcSourceCategory;
  port: Port;
}

export interface AcBus {
  id: string;
  lineNetId: string;
  neutralNetId: string;
  sources: AcSource[];
  loads: { id: string; port: Port }[];
}

export interface SystemTopology {
  /** Komponen tanpa id ganda, urut menurut id. */
  components: PlacedComponent[];
  /** Netlist menurut keadaan MCB/fuse. */
  netlist: Netlist;
  bridges: Bridge[];
  dcBuses: DcBus[];
  sccs: SccNode[];
  dcConsumers: DcConsumer[];
  acBuses: AcBus[];
  /** Beban AC yang tidak berada di bus AC mana pun. */
  idleAcLoadIds: string[];
  /** Komponen yang modelnya belum ada di engine (SCC MPPT, inverter grid-tie, hibrida). */
  unsupportedIds: string[];
}
