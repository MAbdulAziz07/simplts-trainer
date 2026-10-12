// Snapshot keluaran tiap langkah: V/I/P per net dan terminal, status tiap komponen, energi
// kumulatif, dan kejadian baru (docs/ARSITEKTUR.md §2 langkah 4d).
import { SWITCH_CATEGORIES } from '../circuit/bridges';
import type { PlacedComponent } from '../circuit/types';
import type {
  ComponentCondition,
  ComponentStatus,
  SimEvent,
  SimFrame,
  SimState,
  Snapshot,
  WireStatus,
} from './step-types';

function switchStatus(id: string, isFuse: boolean, state: SimState): ComponentStatus {
  const condition: ComponentCondition = state.blownFuseIds.includes(id)
    ? 'blown'
    : state.closedSwitchIds.includes(id)
      ? 'ok'
      : !isFuse && state.trippedSwitchIds.includes(id)
        ? 'tripped'
        : 'off';
  return { condition, thermalDose: state.thermalDoseBySwitchId[id] ?? 0 };
}

function inverterCondition(id: string, frame: SimFrame, state: SimState): ComponentCondition {
  const status = frame.point.inverters[id]?.status;
  if (status === 'on') return 'ok';
  if (status === 'collapsed') return 'collapsed';
  const simState = state.inverterById[id];
  return simState && !simState.on ? (simState.offReason ?? 'off') : 'off';
}

/** Status satu komponen pada keadaan dan titik kerja ini. */
export function componentStatus(
  { id, item }: PlacedComponent,
  frame: SimFrame,
  state: SimState,
): ComponentStatus {
  if (state.damagedComponentIds.includes(id)) return { condition: 'damaged' };
  if (frame.topology.unsupportedIds.includes(id)) return { condition: 'unsupported' };
  if (SWITCH_CATEGORIES.includes(item.category)) {
    return switchStatus(id, item.category === 'fuse', state);
  }
  switch (item.category) {
    case 'battery':
      return {
        condition: state.bmsById[id]?.open ? 'cutoff' : 'ok',
        socPct: state.socPctByBatteryId[id] ?? 100,
      };
    case 'scc-pwm': {
      const status = frame.point.sccs[id]?.status;
      const scc = state.sccById[id];
      return {
        condition:
          status === 'fault' || status === 'damaged'
            ? 'fault'
            : scc?.loadOverloaded
              ? 'overload'
              : 'ok',
        chargeStage: scc?.stage ?? 'bulk',
        loadConnected: scc?.loadConnected ?? true,
      };
    }
    case 'inverter-offgrid':
      return { condition: inverterCondition(id, frame, state) };
    default:
      return { condition: 'ok' };
  }
}

/**
 * Status tiap kabel: yang masih di rangkaian, yang rusak, dan yang suhunya pernah dihitung. Kabel
 * di luar tabel katalog dilaporkan pada suhu sekitar.
 */
export function wireStatuses(frame: SimFrame, state: SimState): Record<string, WireStatus> {
  const { point } = frame;
  const damaged = new Set(state.damagedWireIds);
  const ids = [
    ...frame.topology.netlist.wires.map((wire) => wire.id),
    ...Object.keys(state.conductorTempCByWireId),
    ...state.damagedWireIds,
  ];
  const wires: Record<string, WireStatus> = {};
  for (const id of ids) {
    const isDamaged = damaged.has(id);
    wires[id] = {
      condition: isDamaged
        ? 'damaged'
        : (state.overheatSByWireId[id] ?? 0) > 0
          ? 'overheating'
          : 'ok',
      conductorTempC: state.conductorTempCByWireId[id] ?? frame.environment.ambientTempC,
      currentA: isDamaged ? 0 : (point.currentAByWireId[id] ?? 0),
      flowA: isDamaged ? 0 : (point.flowAByWireId[id] ?? 0),
      voltageDropV: isDamaged ? 0 : (point.voltageDropVByWireId[id] ?? 0),
    };
  }
  return wires;
}

/** Snapshot pada akhir langkah; `events` = kejadian selama panggilan `stepSimulation` ini. */
export function buildSnapshot(
  frame: SimFrame,
  state: SimState,
  events: readonly SimEvent[],
): Snapshot {
  const components: Record<string, ComponentStatus> = {};
  for (const component of frame.topology.components) {
    components[component.id] = componentStatus(component, frame, state);
  }
  return {
    timeS: state.timeS,
    nets: frame.potentials.nets,
    terminals: frame.potentials.terminals,
    components,
    wires: wireStatuses(frame, state),
    energy: state.energy,
    events: [...events],
    operatingPoint: frame.point,
  };
}
