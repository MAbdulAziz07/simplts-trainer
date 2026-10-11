// Pembaruan keadaan kabel dan kWh meter untuk satu sub-langkah: suhu konduktor, isolasi rusak
// karena panas, dan energi impor/ekspor (docs/MODEL_FISIKA.md §8.2, §10.2).
import {
  cableEffectiveAmpacityA,
  cableIsOverheating,
  cableStepTempC,
  cableSteadyTempC,
  cableTableAmpacityA,
} from '../components/cable';
import { kwhMeterAccumulate, kwhMeterCanMeasure } from '../components/meter';
import type { KwhMeterEnergy } from '../components/meter';
import type { SimEvent, SimFrame, SimState, StepOutcome } from './step-types';

const NO_ENERGY: KwhMeterEnergy = { importWh: 0, exportWh: 0 };

/**
 * Daya lewat kWh meter: tegangan L−N di sisi masuk × arus dari `l-in` ke `l-out`. Positif = impor.
 * L IN/L OUT tertukar membalik tandanya; netral tidak tersambung memberi tegangan 0.
 */
export function meterPowerW(
  frame: SimFrame,
  meterId: string,
): { voltageV: number; powerW: number } {
  const { terminals } = frame.potentials;
  const line = terminals[`${meterId}.l-in`];
  const neutralIn = terminals[`${meterId}.n-in`];
  const neutral = neutralIn && !neutralIn.floating ? neutralIn : terminals[`${meterId}.n-out`];
  if (!line || line.floating || !neutral || neutral.floating) return { voltageV: 0, powerW: 0 };
  const voltageV = line.voltageV - neutral.voltageV;
  // Arus yang masuk ke `l-in` dari kabel = arus yang lewat meter ke arah beban.
  return { voltageV, powerW: voltageV * -line.currentA || 0 };
}

/** Energi tiap kWh meter setelah `dtS`; di luar jendela tegangan meter tidak menghitung. */
export function advanceMeters(
  frame: SimFrame,
  state: SimState,
  dtS: number,
): Record<string, KwhMeterEnergy> {
  const meterEnergyById = { ...state.meterEnergyById };
  for (const { id, item } of frame.topology.components) {
    if (item.category !== 'kwh-meter') continue;
    const previous = meterEnergyById[id] ?? NO_ENERGY;
    const { voltageV, powerW } = meterPowerW(frame, id);
    meterEnergyById[id] = kwhMeterCanMeasure(item.electrical, Math.abs(voltageV))
      ? kwhMeterAccumulate(previous, powerW, dtS)
      : previous;
  }
  return meterEnergyById;
}

/**
 * Suhu konduktor, lama di zona rusak, dan energi meter setelah `dtS`. Kabel yang bertahan di zona
 * rusak selama `overheatDamageDelayS` menjadi rusak (putus). Kabel di luar tabel katalog dilewati.
 */
export function advanceWiring(frame: SimFrame, state: SimState, dtS: number): StepOutcome {
  const { ambientTempC } = frame.environment;
  const cableById = new Map(frame.cables.map((cable) => [cable.id, cable]));
  const conductorTempCByWireId = { ...state.conductorTempCByWireId };
  const overheatSByWireId = { ...state.overheatSByWireId };
  const damagedWireIds = [...state.damagedWireIds];
  const events: SimEvent[] = [];
  let transition = false;

  for (const wire of frame.topology.netlist.wires) {
    const cable = cableById.get(wire.cableId);
    const tableA = cable && cableTableAmpacityA(cable.electrical, wire.areaMm2);
    if (!cable || tableA === undefined) continue;
    const currentA = frame.point.currentAByWireId[wire.id] ?? 0;
    const ampacityA = cableEffectiveAmpacityA(cable.electrical, tableA, ambientTempC);
    const steadyTempC = cableSteadyTempC(cable.electrical, currentA, ampacityA, ambientTempC);
    const previousTempC = conductorTempCByWireId[wire.id] ?? ambientTempC;
    const tempC = cableStepTempC(cable.electrical, previousTempC, steadyTempC, dtS);
    conductorTempCByWireId[wire.id] = tempC;

    const previousS = overheatSByWireId[wire.id] ?? 0;
    const overheatS = cableIsOverheating(cable.protection, tempC) ? previousS + dtS : 0;
    transition ||= overheatS > 0 !== previousS > 0;
    overheatSByWireId[wire.id] = overheatS;
    if (overheatS <= 0 || overheatS < cable.protection.overheatDamageDelayS) continue;
    transition = true;
    overheatSByWireId[wire.id] = 0;
    damagedWireIds.push(wire.id);
    events.push({
      kind: 'component-damaged',
      timeS: state.timeS + dtS,
      wireId: wire.id,
      cause: 'cable-overheat',
      params: { conductorTempC: tempC, currentA },
    });
  }

  return {
    state: {
      ...state,
      conductorTempCByWireId,
      overheatSByWireId,
      damagedWireIds,
      meterEnergyById: advanceMeters(frame, state, dtS),
    },
    events,
    transition,
    instant: false,
  };
}
