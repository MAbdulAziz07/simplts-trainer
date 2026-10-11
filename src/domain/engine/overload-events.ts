// Beban lebih inverter dan terminal beban SCC untuk satu sub-langkah: dosis menurut kurva waktu
// katalog, lalu mati terkunci sampai direset (docs/MODEL_FISIKA.md §2, §5).
import { inverterOverloadTimeS } from '../components/inverter';
import { THERMAL_DOSE_TRIP, thermalDoseStep } from '../components/protection';
import { pwmLoadOverloadTimeS } from '../components/scc';
import { INITIAL_SCC } from './advance-state';
import type { SimEvent, SimFrame, SimState, StepOutcome } from './step-types';

/** Beban sebuah inverter yang hidup atau terminal beban sebuah SCC. */
export interface OverloadLoad {
  id: string;
  kind: 'inverter' | 'scc-load';
  /** `P/Pr` inverter atau `I/Iload_max` SCC. */
  ratio: number;
  /** Waktu sampai mati pada beban ini; `Infinity` = tidak mati. */
  tripTimeS: number;
  /** Angka untuk kejadian: `acPowerW` atau `currentA`. */
  params: Record<string, number>;
}

/** Beban tiap inverter yang hidup dan tiap terminal beban SCC pada titik kerja saat ini. */
export function overloadLoads(frame: SimFrame): OverloadLoad[] {
  const loads: OverloadLoad[] = [];
  for (const [id, reading] of Object.entries(frame.point.inverters)) {
    const item = frame.solved.itemOf(id, 'inverter-offgrid');
    if (!item || reading.status !== 'on') continue;
    const { acPowerW } = reading;
    loads.push({
      id,
      kind: 'inverter',
      ratio: acPowerW / item.electrical.ratedAcPowerW,
      tripTimeS: inverterOverloadTimeS(item.electrical, item.protection, acPowerW),
      params: { acPowerW },
    });
  }
  for (const [id, reading] of Object.entries(frame.point.sccs)) {
    const item = frame.solved.itemOf(id, 'scc-pwm');
    if (!item) continue;
    const currentA = Math.abs(reading.loadCurrentA);
    loads.push({
      id,
      kind: 'scc-load',
      ratio: currentA / item.electrical.loadCurrentMaxA,
      tripTimeS: pwmLoadOverloadTimeS(item.electrical, item.protection, currentA),
      params: { currentA },
    });
  }
  return loads;
}

/**
 * Dosis beban lebih setelah `dtS`; saat dosis ≥ 1 inverter mati (`offReason: 'overload'`) atau
 * terminal beban SCC putus (`loadOverloaded`). Alat yang tidak berbeban mendingin.
 */
export function stepOverloads(
  loads: readonly OverloadLoad[],
  state: SimState,
  dtS: number,
): StepOutcome {
  const loadById = new Map(loads.map((load) => [load.id, load]));
  const overloadDoseById = { ...state.overloadDoseById };
  const inverterById = { ...state.inverterById };
  const sccById = { ...state.sccById };
  const events: SimEvent[] = [];
  const timeS = state.timeS + dtS;

  for (const id of new Set([...Object.keys(overloadDoseById), ...loadById.keys()])) {
    const load = loadById.get(id);
    const tripTimeS = load?.tripTimeS ?? Number.POSITIVE_INFINITY;
    const dose = thermalDoseStep(overloadDoseById[id] ?? 0, tripTimeS, load?.ratio ?? 0, dtS);
    overloadDoseById[id] = dose;
    if (!load || !Number.isFinite(tripTimeS) || dose < THERMAL_DOSE_TRIP) continue;
    if (load.kind === 'inverter') {
      // Yang sudah mati pada sub-langkah ini (LVD/HVD) tidak dimatikan dua kali.
      if (inverterById[id]?.on === false) continue;
      inverterById[id] = { on: false, lowVoltageS: 0, offReason: 'overload' };
      events.push({ kind: 'inverter-overload', timeS, componentId: id, params: load.params });
    } else {
      const scc = sccById[id] ?? INITIAL_SCC;
      if (scc.loadOverloaded) continue;
      sccById[id] = { ...scc, loadConnected: false, loadOverloaded: true };
      events.push({ kind: 'scc-load-overload', timeS, componentId: id, params: load.params });
    }
  }

  return {
    state: { ...state, overloadDoseById, inverterById, sccById },
    events,
    transition: events.length > 0,
    instant: false,
  };
}
