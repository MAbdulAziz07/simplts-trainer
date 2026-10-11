// Tindakan pemulihan dari pengguna: MCB di-ON-kan lagi, fuse/komponen/kabel diganti, BMS dan
// proteksi beban lebih direset. Fungsi murni atas `SimState`; id yang tidak cocok diabaikan.
import { BMS_CLOSED } from '../components/bms';
import type { SimState } from './step-types';

const without = (ids: readonly string[], id: string) => ids.filter((other) => other !== id);

function omit<T>(record: Readonly<Record<string, T>>, id: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== id));
}

/**
 * MCB di-ON-kan lagi (setelah trip atau dimatikan tangan). Dosis termal tidak dihapus: MCB yang
 * masih panas trip lebih cepat. MCB rusak dan fuse putus tidak bisa di-ON-kan.
 */
export function resetBreaker(state: SimState, id: string): SimState {
  if (state.damagedComponentIds.includes(id) || state.blownFuseIds.includes(id)) return state;
  return {
    ...state,
    closedSwitchIds: [...without(state.closedSwitchIds, id), id].sort(),
    trippedSwitchIds: without(state.trippedSwitchIds, id),
  };
}

/** Fuse putus diganti baru: tersambung lagi dengan dosis termal nol. */
export function replaceFuse(state: SimState, id: string): SimState {
  if (!state.blownFuseIds.includes(id)) return state;
  return {
    ...state,
    blownFuseIds: without(state.blownFuseIds, id),
    closedSwitchIds: [...without(state.closedSwitchIds, id), id].sort(),
    thermalDoseBySwitchId: omit(state.thermalDoseBySwitchId, id),
  };
}

/** BMS yang memutus disambung lagi; memutus ulang bila sebabnya masih ada. */
export function resetBms(state: SimState, id: string): SimState {
  if (!state.bmsById[id]?.open) return state;
  return { ...state, bmsById: { ...state.bmsById, [id]: BMS_CLOSED } };
}

/** Inverter yang mati karena beban lebih dihidupkan lagi dengan dosis nol. */
export function resetInverter(state: SimState, id: string): SimState {
  if (state.inverterById[id]?.offReason !== 'overload') return state;
  return {
    ...state,
    inverterById: { ...state.inverterById, [id]: { on: true, lowVoltageS: 0 } },
    overloadDoseById: omit(state.overloadDoseById, id),
  };
}

/** Terminal beban SCC yang putus karena arus lebih disambung lagi dengan dosis nol. */
export function resetSccLoad(state: SimState, id: string): SimState {
  const scc = state.sccById[id];
  if (!scc?.loadOverloaded) return state;
  return {
    ...state,
    sccById: { ...state.sccById, [id]: { ...scc, loadConnected: true, loadOverloaded: false } },
    overloadDoseById: omit(state.overloadDoseById, id),
  };
}

/**
 * Komponen rusak diganti baru: keadaan bawaannya (dosis, tahap SCC, proteksi inverter, BMS, energi
 * meter) kembali ke awal. MCB pengganti terpasang OFF; SoC baterai tidak diubah.
 */
export function replaceComponent(state: SimState, id: string): SimState {
  if (!state.damagedComponentIds.includes(id)) return state;
  return {
    ...state,
    damagedComponentIds: without(state.damagedComponentIds, id),
    trippedSwitchIds: without(state.trippedSwitchIds, id),
    thermalDoseBySwitchId: omit(state.thermalDoseBySwitchId, id),
    overloadDoseById: omit(state.overloadDoseById, id),
    sccById: omit(state.sccById, id),
    inverterById: omit(state.inverterById, id),
    bmsById: omit(state.bmsById, id),
    meterEnergyById: omit(state.meterEnergyById, id),
  };
}

/** Kabel rusak diganti baru pada suhu sekitar. */
export function replaceWire(state: SimState, id: string): SimState {
  if (!state.damagedWireIds.includes(id)) return state;
  return {
    ...state,
    damagedWireIds: without(state.damagedWireIds, id),
    conductorTempCByWireId: omit(state.conductorTempCByWireId, id),
    overheatSByWireId: omit(state.overheatSByWireId, id),
  };
}
