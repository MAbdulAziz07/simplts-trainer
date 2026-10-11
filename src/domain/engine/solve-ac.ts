// Satu bus AC: tegangan dari satu sumber (inverter off-grid atau jaringan), beban resistif
// P = V²/R dengan jatuh tegangan kabel putaran sebelumnya (MODEL_FISIKA §5.3, §6.2).
import type { AcBus, AcSource } from '../circuit/subsystem-types';
import type { TerminalRef } from '../circuit/types';
import { loadCurrentA } from '../components/load';
import { portOffsetV } from './solve-dc';
import type { ItemLookup } from './prepare-dc';
import type { OffsetFn } from './solve-dc';
import type { AcBusStatus } from './types';

export interface AcBusRound {
  bus: AcBus;
  status: AcBusStatus;
  /** Tegangan di terminal sumber; 0 bila mati. */
  voltageV: number;
  /** Sumber tunggal bus; kosong bila bus tidak didukung. */
  source?: AcSource;
  currentAByLoadId: Map<string, number>;
  totalCurrentA: number;
}

/** Tegangan nominal sumber AC yang dimodelkan; `undefined` = kategori belum didukung. */
function sourceVoltageV(source: AcSource, itemOf: ItemLookup): number | undefined {
  if (source.category === 'grid') return itemOf(source.id, 'grid')?.electrical.nominalVoltageV;
  if (source.category !== 'inverter-offgrid') return undefined;
  return itemOf(source.id, 'inverter-offgrid')?.electrical.acOutputVoltageV;
}

/**
 * Arus tiap beban di bus AC. Bus dengan lebih dari satu sumber, atau dengan inverter grid-tie atau
 * hibrida, berstatus `unsupported`; sumber yang mati (`isLive` salah) memberi 0 V.
 */
export function solveAcBus(
  bus: AcBus,
  itemOf: ItemLookup,
  isLive: (source: AcSource) => boolean,
  resistanceOhm: (loadId: string) => number,
  offsetV: OffsetFn,
): AcBusRound {
  const [source] = bus.sources;
  const nominalV = source && bus.sources.length === 1 ? sourceVoltageV(source, itemOf) : undefined;
  const currentAByLoadId = new Map<string, number>();
  if (!source || nominalV === undefined) {
    return { bus, status: 'unsupported', voltageV: 0, currentAByLoadId, totalCurrentA: 0 };
  }
  if (!isLive(source)) {
    return { bus, status: 'dead', voltageV: 0, source, currentAByLoadId, totalCurrentA: 0 };
  }
  let totalCurrentA = 0;
  for (const load of bus.loads) {
    const voltageV = Math.max(nominalV + portOffsetV(load.port, source.port, offsetV), 0);
    const currentA = loadCurrentA(resistanceOhm(load.id), voltageV);
    currentAByLoadId.set(load.id, currentA);
    totalCurrentA += currentA;
  }
  return { bus, status: 'ok', voltageV: nominalV, source, currentAByLoadId, totalCurrentA };
}

/** Suntikan arus tiap terminal dari hasil satu bus AC, untuk `solveFlow`. */
export function injectAcBus(
  round: AcBusRound,
  inject: (terminal: TerminalRef, currentA: number) => void,
): void {
  if (!round.source) return;
  inject(round.source.port.pos, round.totalCurrentA);
  inject(round.source.port.neg, -round.totalCurrentA);
  for (const load of round.bus.loads) {
    const currentA = round.currentAByLoadId.get(load.id) ?? 0;
    inject(load.port.pos, -currentA);
    inject(load.port.neg, currentA);
  }
}
