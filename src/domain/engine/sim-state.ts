// Keadaan awal simulasi dan turunannya untuk solver: rangkaian yang masih tersambung dan
// `SolverState` (docs/MODEL_FISIKA.md §12 butir 3).
import { SWITCH_CATEGORIES } from '../circuit/bridges';
import type { PlacedComponent, Wire } from '../circuit/types';
import type { SimControls, SimState } from './step-types';
import type { SccState, SolverState } from './types';

const DEFAULT_SOC_PCT = 100;

/**
 * Keadaan awal: semua MCB/fuse ON, semua baterai penuh, penghitung nol. `init` menimpa sebagian,
 * mis. `{ socPctByBatteryId: { bat1: 50 } }` (baterai lain tetap 100%).
 */
export function createSimState(
  components: readonly PlacedComponent[],
  init: Partial<SimState> = {},
): SimState {
  const idsOf = (matches: (component: PlacedComponent) => boolean) =>
    components
      .filter(matches)
      .map((component) => component.id)
      .sort();
  const socPctByBatteryId: Record<string, number> = {};
  for (const id of idsOf(({ item }) => item.category === 'battery')) {
    socPctByBatteryId[id] = init.socPctByBatteryId?.[id] ?? DEFAULT_SOC_PCT;
  }
  return {
    timeS: 0,
    closedSwitchIds: idsOf(({ item }) => SWITCH_CATEGORIES.includes(item.category)),
    trippedSwitchIds: [],
    blownFuseIds: [],
    damagedComponentIds: [],
    damagedWireIds: [],
    sccById: {},
    inverterById: {},
    bmsById: {},
    thermalDoseBySwitchId: {},
    overloadDoseById: {},
    conductorTempCByWireId: {},
    overheatSByWireId: {},
    meterEnergyById: {},
    energy: {
      pvWh: 0,
      loadWh: 0,
      batteryChargeWh: 0,
      batteryDischargeWh: 0,
      gridImportWh: 0,
      gridExportWh: 0,
      lossWh: 0,
    },
    ...init,
    socPctByBatteryId,
  };
}

export interface ActiveCircuit {
  wires: Wire[];
  closedSwitchIds: string[];
}

/**
 * Rangkaian yang masih menghantar: kabel rusak dan kabel ke komponen rusak atau ke baterai yang
 * diputus BMS dibuang; fuse putus dan MCB rusak dianggap OFF.
 */
export function activeCircuit(state: SimState, wires: readonly Wire[]): ActiveCircuit {
  const isolated = new Set(state.damagedComponentIds);
  for (const [id, bms] of Object.entries(state.bmsById)) if (bms.open) isolated.add(id);
  const deadWires = new Set(state.damagedWireIds);
  const open = new Set([...state.blownFuseIds, ...state.damagedComponentIds]);
  return {
    wires: wires.filter(
      (wire) =>
        !deadWires.has(wire.id) &&
        !isolated.has(wire.from.componentId) &&
        !isolated.has(wire.to.componentId),
    ),
    closedSwitchIds: state.closedSwitchIds.filter((id) => !open.has(id)),
  };
}

/** Keadaan dan setelan pengguna dalam bentuk yang dibaca `solveSystem`. */
export function toSolverState(state: SimState, controls: SimControls = {}): SolverState {
  const { batteryTypeBySccId, ...settings } = controls;
  const sccIds = new Set([...Object.keys(state.sccById), ...Object.keys(batteryTypeBySccId ?? {})]);
  const sccById: Record<string, SccState> = {};
  for (const id of sccIds) {
    const scc = state.sccById[id];
    const batteryType = batteryTypeBySccId?.[id];
    sccById[id] = {
      ...(scc && { stage: scc.stage, loadConnected: scc.loadConnected }),
      ...(scc?.voltageScale !== undefined && { voltageScale: scc.voltageScale }),
      ...(batteryType && { batteryType }),
    };
  }
  const inverterOnById: Record<string, boolean> = {};
  for (const [id, inverter] of Object.entries(state.inverterById)) inverterOnById[id] = inverter.on;
  return {
    ...settings,
    socPctByBatteryId: state.socPctByBatteryId,
    sccById,
    inverterOnById,
    conductorTempCByWireId: state.conductorTempCByWireId,
  };
}

/** `true` bila ada penghitung tunda yang sedang berjalan (LVD, arus lebih BMS, kabel terlalu panas). */
export function hasPendingTimers(state: SimState): boolean {
  return (
    Object.values(state.inverterById).some((inverter) => inverter.on && inverter.lowVoltageS > 0) ||
    Object.values(state.bmsById).some((bms) => !bms.open && bms.overCurrentS > 0) ||
    Object.values(state.overheatSByWireId).some((overheatS) => overheatS > 0)
  );
}
