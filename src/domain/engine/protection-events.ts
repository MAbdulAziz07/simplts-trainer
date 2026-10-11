// MCB dan fuse untuk satu sub-langkah: dosis termal, trip magnetik sebagai kejadian, fuse putus,
// dan MCB rusak bila tidak mampu memadamkan busur (docs/MODEL_FISIKA.md §9.1–9.2, §12 butir 4).
import { SWITCH_CATEGORIES } from '../circuit/bridges';
import type { PlacedComponent } from '../circuit/types';
import {
  fuseMeltTimeS,
  MCB_MAGNETIC_TRIP_TIME_S,
  mcbAcCanInterruptDc,
  mcbDcCanInterrupt,
  mcbEffectiveRatedCurrentA,
  mcbTripTimeS,
  THERMAL_DOSE_TRIP,
  thermalDoseStep,
} from '../components/protection';
import type { TerminalKind } from '../types';
import type { SimEvent, SimFrame, SimState, StepOutcome } from './step-types';

const DC_KINDS: readonly TerminalKind[] = ['dc+', 'dc-', 'pv+', 'pv-'];
const A_PER_KA = 1000;

/** Beban sebuah MCB atau fuse yang sedang ON. */
export interface SwitchLoad {
  id: string;
  currentA: number;
  /** `I/In`; untuk MCB, In sudah dikoreksi suhu sekitar. */
  ratio: number;
  /** Waktu trip atau lebur pada arus ini; `Infinity` = tidak trip. */
  tripTimeS: number;
  isDc: boolean;
}

/** MCB AC dihitung sebagai DC bila salah satu netnya memuat terminal DC atau PV. */
function isInDcCircuit(frame: SimFrame, component: PlacedComponent): boolean {
  if (component.item.category !== 'mcb-ac') return true;
  const { netlist } = frame.topology;
  const netIds = new Set(Object.values(netlist.netIdByTerminal[component.id] ?? {}));
  return netlist.nets.some(
    (net) => netIds.has(net.id) && net.kinds.some((kind) => DC_KINDS.includes(kind)),
  );
}

/** Beban tiap MCB/fuse yang ON pada titik kerja saat ini, urut menurut id. */
export function switchLoads(frame: SimFrame): SwitchLoad[] {
  const loads: SwitchLoad[] = [];
  for (const component of frame.topology.components) {
    const { id, item } = component;
    const currentA = frame.point.currentAByComponentId[id];
    if (currentA === undefined) continue;
    if (item.category === 'fuse') {
      const { ratedCurrentA, timeCurrentPoints } = item.protection;
      const tripTimeS = fuseMeltTimeS(currentA, ratedCurrentA, timeCurrentPoints);
      loads.push({ id, currentA, ratio: currentA / ratedCurrentA, tripTimeS, isDc: true });
    } else if (item.category === 'mcb-dc' || item.category === 'mcb-ac') {
      const { ratedCurrentA, refTempC, curve } = item.electrical;
      const isDc = isInDcCircuit(frame, component);
      const ratedA = mcbEffectiveRatedCurrentA(
        ratedCurrentA,
        frame.environment.ambientTempC,
        refTempC,
      );
      const tripTimeS = mcbTripTimeS(currentA, ratedA, curve, isDc);
      loads.push({ id, currentA, ratio: currentA / ratedA, tripTimeS, isDc });
    }
  }
  return loads;
}

/** `true` bila MCB mampu memutus arus ini pada tegangan sistemnya (potensial terminal terbesar). */
function canInterrupt(frame: SimFrame, component: PlacedComponent, load: SwitchLoad): boolean {
  const { id, item } = component;
  let systemVoltageV = 0;
  for (const terminal of item.terminals) {
    const voltageV = frame.potentials.terminals[`${id}.${terminal.id}`]?.voltageV ?? 0;
    systemVoltageV = Math.max(systemVoltageV, Math.abs(voltageV));
  }
  if (item.category === 'mcb-dc') {
    return mcbDcCanInterrupt(item.electrical, systemVoltageV, load.currentA);
  }
  if (item.category !== 'mcb-ac') return true;
  return load.isDc
    ? mcbAcCanInterruptDc(item.electrical, systemVoltageV, load.currentA)
    : load.currentA <= item.electrical.breakingCapacityKa * A_PER_KA;
}

/**
 * Dosis termal semua MCB/fuse setelah `dtS`, lalu trip atau putus bila dosis ≥ 1 atau arusnya di
 * daerah magnetik (t ≤ 0,02 s). Yang OFF mendingin. MCB yang tidak mampu memutus menjadi rusak.
 */
export function stepSwitches(
  frame: SimFrame,
  loads: readonly SwitchLoad[],
  state: SimState,
  dtS: number,
): StepOutcome {
  const loadById = new Map(loads.map((load) => [load.id, load]));
  const thermalDoseBySwitchId = { ...state.thermalDoseBySwitchId };
  const opened = new Set<string>();
  const tripped: string[] = [];
  const blown: string[] = [];
  const damaged: string[] = [];
  const events: SimEvent[] = [];
  let instant = false;
  const timeS = state.timeS + dtS;

  for (const component of frame.topology.components) {
    const { id, item } = component;
    if (!SWITCH_CATEGORIES.includes(item.category)) continue;
    const load = loadById.get(id);
    const previousDose = thermalDoseBySwitchId[id] ?? 0;
    const dose = thermalDoseStep(
      previousDose,
      load?.tripTimeS ?? Number.POSITIVE_INFINITY,
      load?.ratio ?? 0,
      dtS,
    );
    thermalDoseBySwitchId[id] = dose;
    if (!load) continue;
    const isMagnetic = load.tripTimeS <= MCB_MAGNETIC_TRIP_TIME_S;
    if (!isMagnetic && dose < THERMAL_DOSE_TRIP) continue;
    instant ||= isMagnetic;
    opened.add(id);
    const cause = isMagnetic ? 'magnetic' : 'thermal';
    const params = { currentA: load.currentA };
    if (item.category === 'fuse') {
      blown.push(id);
      events.push({ kind: 'fuse-blown', timeS, componentId: id, cause, params });
      continue;
    }
    tripped.push(id);
    events.push({ kind: 'mcb-trip', timeS, componentId: id, cause, params });
    if (canInterrupt(frame, component, load)) continue;
    damaged.push(id);
    events.push({
      kind: 'component-damaged',
      timeS,
      componentId: id,
      cause: 'cannot-interrupt',
      params,
    });
  }

  return {
    state: {
      ...state,
      thermalDoseBySwitchId,
      closedSwitchIds: state.closedSwitchIds.filter((id) => !opened.has(id)),
      trippedSwitchIds: [...state.trippedSwitchIds, ...tripped],
      blownFuseIds: [...state.blownFuseIds, ...blown],
      damagedComponentIds: [...state.damagedComponentIds, ...damaged],
    },
    events,
    transition: opened.size > 0,
    instant,
  };
}
