// Menyesuaikan keadaan simulasi dengan rangkaian di meja kerja, dan tindakan pemulihan per
// komponen. Fungsi murni: keadaan masukan tidak diubah.
import {
  SWITCH_CATEGORIES,
  createSimState,
  replaceComponent,
  replaceFuse,
  resetBms,
  resetBreaker,
  resetInverter,
  resetSccLoad,
  type ComponentCondition,
  type PlacedComponent,
  type SimState,
  type Wire,
} from '@/domain';
import type { CircuitDoc } from './circuit-doc';

/** SoC baterai yang baru ditaruh di meja. [PERLU VERIFIKASI] */
export const INITIAL_SOC_PCT = 80;

export interface CircuitParts {
  components: readonly PlacedComponent[];
  wires: readonly Wire[];
  /** MCB/fuse yang ON menurut meja kerja. */
  closedSwitchIds: readonly string[];
}

/**
 * `true` bila kedua dokumen sama secara listrik: komponen, setelan daya beban, ubahan parameter, kabel, dan tuas
 * (posisi dan putaran tidak dihitung).
 */
export function sameCircuit(a: CircuitDoc, b: CircuitDoc): boolean {
  if (a === b) return true;
  return (
    a.wires === b.wires &&
    a.closedSwitchIds === b.closedSwitchIds &&
    a.components.length === b.components.length &&
    a.components.every((part, i) => {
      const other = b.components[i];
      return (
        part.id === other?.id &&
        part.catalogId === other.catalogId &&
        part.powerSettingW === other.powerSettingW &&
        part.params === other.params
      );
    })
  );
}

/** Keadaan awal untuk rangkaian ini: baterai pada SoC awal, tuas seperti di meja kerja. */
export function initialSimState(parts: CircuitParts): SimState {
  const socPctByBatteryId: Record<string, number> = {};
  for (const { id, item } of parts.components) {
    if (item.category === 'battery') socPctByBatteryId[id] = INITIAL_SOC_PCT;
  }
  const state = createSimState(parts.components, { socPctByBatteryId });
  return { ...state, closedSwitchIds: [...parts.closedSwitchIds].sort() };
}

function keep<T>(record: Readonly<Record<string, T>>, ids: ReadonlySet<string>) {
  return Object.fromEntries(Object.entries(record).filter(([id]) => ids.has(id)));
}

/**
 * Keadaan simulasi setelah rangkaian berubah: catatan komponen dan kabel yang sudah tidak ada
 * dibuang, baterai baru mulai dari SoC awal, dan tuas mengikuti meja kerja. Tuas yang di-ON-kan
 * pengguna melewati `resetBreaker`, jadi MCB rusak dan fuse putus tetap terbuka.
 */
export function reconcileSimState(state: SimState, parts: CircuitParts): SimState {
  const componentIds = new Set(parts.components.map((component) => component.id));
  const wireIds = new Set(parts.wires.map((wire) => wire.id));
  const kept = (ids: readonly string[], known: ReadonlySet<string>) =>
    ids.filter((id) => known.has(id));

  const socPctByBatteryId: Record<string, number> = {};
  for (const { id, item } of parts.components) {
    if (item.category !== 'battery') continue;
    socPctByBatteryId[id] = state.socPctByBatteryId[id] ?? INITIAL_SOC_PCT;
  }

  let next: SimState = {
    ...state,
    closedSwitchIds: kept(state.closedSwitchIds, componentIds),
    trippedSwitchIds: kept(state.trippedSwitchIds, componentIds),
    blownFuseIds: kept(state.blownFuseIds, componentIds),
    damagedComponentIds: kept(state.damagedComponentIds, componentIds),
    damagedWireIds: kept(state.damagedWireIds, wireIds),
    socPctByBatteryId,
    sccById: keep(state.sccById, componentIds),
    inverterById: keep(state.inverterById, componentIds),
    bmsById: keep(state.bmsById, componentIds),
    thermalDoseBySwitchId: keep(state.thermalDoseBySwitchId, componentIds),
    overloadDoseById: keep(state.overloadDoseById, componentIds),
    conductorTempCByWireId: keep(state.conductorTempCByWireId, wireIds),
    overheatSByWireId: keep(state.overheatSByWireId, wireIds),
    meterEnergyById: keep(state.meterEnergyById, componentIds),
  };

  const wanted = new Set(parts.closedSwitchIds);
  for (const { id, item } of parts.components) {
    if (!SWITCH_CATEGORIES.includes(item.category)) continue;
    const isClosed = next.closedSwitchIds.includes(id);
    if (wanted.has(id) && !isClosed) next = resetBreaker(next, id);
    if (!wanted.has(id) && isClosed) {
      next = { ...next, closedSwitchIds: next.closedSwitchIds.filter((other) => other !== id) };
    }
  }
  return next;
}

/**
 * Tuas yang di meja kerja masih ON padahal simulasi sudah membukanya (trip, MCB rusak). Fuse putus
 * tidak termasuk: fuse tidak punya tuas.
 */
export function switchesOpenedBySim(state: SimState, closedSwitchIds: readonly string[]): string[] {
  return closedSwitchIds.filter(
    (id) => !state.closedSwitchIds.includes(id) && !state.blownFuseIds.includes(id),
  );
}

/** Kondisi yang dipulihkan lewat tombol reset pada komponen. */
export const REPAIRABLE_CONDITIONS: readonly ComponentCondition[] = [
  'tripped',
  'blown',
  'cutoff',
  'overload',
  'damaged',
];

/**
 * Tindakan pemulihan menurut kondisi komponen: fuse dan komponen rusak diganti, BMS dan proteksi
 * beban lebih direset. MCB trip dipulihkan lewat tuasnya (lihat `reconcileSimState`).
 */
export function repairState(state: SimState, id: string, condition: ComponentCondition): SimState {
  switch (condition) {
    case 'blown':
      return replaceFuse(state, id);
    case 'cutoff':
      return resetBms(state, id);
    case 'overload':
      return resetSccLoad(resetInverter(state, id), id);
    case 'damaged':
      return replaceComponent(state, id);
    default:
      return state;
  }
}
