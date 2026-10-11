// Kejadian pada alat untuk satu sub-langkah: BMS memutus baterai, SCC rusak karena Voc PV, dan
// kWh meter rusak karena arus lebih (docs/MODEL_FISIKA.md §2.3, §4.5, §10.2).
import { BMS_CLOSED, bmsLimits, bmsStep } from '../components/bms';
import type { SimEvent, SimFrame, SimState, StepOutcome } from './step-types';

/** Keadaan BMS tiap baterai ber-BMS setelah `dtS`; baterai yang diputus terkunci sampai direset. */
export function stepBms(frame: SimFrame, state: SimState, dtS: number): StepOutcome {
  const bmsById = { ...state.bmsById };
  const events: SimEvent[] = [];
  let instant = false;
  let transition = false;
  for (const [id, reading] of Object.entries(frame.point.batteries)) {
    const limits = bmsLimits(
      frame.solved.itemOf(id, 'battery')?.protection ?? { internalBms: false },
    );
    if (!limits) continue;
    const previous = bmsById[id] ?? BMS_CLOSED;
    const next = bmsStep(limits, previous, reading.voltageV, reading.currentA, dtS);
    bmsById[id] = next;
    // Mulai atau berhentinya penghitung tunda juga dihitung per langkah dasar.
    transition ||=
      next.open !== previous.open || next.overCurrentS > 0 !== previous.overCurrentS > 0;
    if (!next.open || previous.open) continue;
    instant ||= next.reason !== 'over-current';
    events.push({
      kind: 'bms-cutoff',
      timeS: state.timeS + dtS,
      componentId: id,
      ...(next.reason && { cause: next.reason }),
      params: { voltageV: reading.voltageV, currentA: reading.currentA },
    });
  }
  return { state: { ...state, bmsById }, events, transition, instant };
}

/**
 * Alat yang rusak pada titik kerja ini: SCC dengan Voc array di atas batas × faktor galat, dan
 * kWh meter dengan arus di atas `overCurrentDamageA`. Rusak berlaku seketika.
 */
export function stepDeviceDamage(frame: SimFrame, state: SimState, dtS: number): StepOutcome {
  const events: SimEvent[] = [];
  const timeS = state.timeS + dtS;
  for (const [id, scc] of Object.entries(frame.point.sccs)) {
    if (scc.status !== 'damaged') continue;
    events.push({
      kind: 'component-damaged',
      timeS,
      componentId: id,
      cause: 'pv-overvoltage',
      params: { pvVoltageV: scc.pvVoltageV },
    });
  }
  for (const { id, item } of frame.topology.components) {
    if (item.category !== 'kwh-meter') continue;
    const currentA = frame.point.currentAByComponentId[id] ?? 0;
    if (currentA <= item.protection.overCurrentDamageA) continue;
    events.push({
      kind: 'component-damaged',
      timeS,
      componentId: id,
      cause: 'overcurrent',
      params: { currentA },
    });
  }
  const damaged = events.flatMap((event) => event.componentId ?? []);
  return {
    state: { ...state, damagedComponentIds: [...state.damagedComponentIds, ...damaged] },
    events,
    transition: events.length > 0,
    instant: events.length > 0,
  };
}
