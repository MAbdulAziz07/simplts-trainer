// Langkah waktu simulasi (docs/MODEL_FISIKA.md §12 butir 3–4, docs/ARSITEKTUR.md §2 langkah 4):
// waktu nyata × kecepatan dipecah menjadi sub-langkah; tiap sub-langkah menghitung titik kerja,
// memperbarui keadaan, dan mencatat kejadian. Fungsi murni: keadaan masukan tidak diubah.
import { MCB_MAGNETIC_TRIP_TIME_S } from '../components/protection';
import { advanceDevices } from './advance-state';
import { advanceWiring } from './advance-wiring';
import { stepBms, stepDeviceDamage } from './device-events';
import { solveFrame } from './frame';
import { overloadLoads, stepOverloads } from './overload-events';
import type { OverloadLoad } from './overload-events';
import { stepSwitches, switchLoads } from './protection-events';
import type { SwitchLoad } from './protection-events';
import { hasPendingTimers } from './sim-state';
import { buildSnapshot } from './snapshot';
import type {
  SimEvent,
  SimFrame,
  SimState,
  StepInput,
  StepOutcome,
  StepResult,
} from './step-types';
import { BASE_DT_S, chooseDtS } from './time-step';

export const DEFAULT_MAX_SUBSTEPS = 2000;
/** Sisa waktu di bawah ini dianggap habis (galat pembulatan). */
const TIME_EPSILON_S = 1e-9;
/** Pemendekan sub-langkah bila ada perubahan keadaan di dalamnya. */
const RETRY_DIVISOR = 4;

/**
 * Keadaan setelah satu sub-langkah `dtS` pada titik kerja `frame`: alat, kabel, MCB/fuse, BMS, beban
 * lebih, lalu kerusakan. Waktu simulasi ikut maju.
 */
export function advanceSubstep(
  frame: SimFrame,
  loads: readonly SwitchLoad[],
  state: SimState,
  dtS: number,
  overloads: readonly OverloadLoad[] = overloadLoads(frame),
): StepOutcome {
  const parts: ((current: SimState) => StepOutcome)[] = [
    (current) => advanceDevices(frame, current, dtS),
    (current) => advanceWiring(frame, current, dtS),
    (current) => stepSwitches(frame, loads, current, dtS),
    (current) => stepBms(frame, current, dtS),
    (current) => stepOverloads(overloads, current, dtS),
    (current) => stepDeviceDamage(frame, current, dtS),
  ];
  const events: SimEvent[] = [];
  let current = state;
  let transition = false;
  let instant = false;
  for (const part of parts) {
    const outcome = part(current);
    current = outcome.state;
    events.push(...outcome.events);
    transition ||= outcome.transition;
    instant ||= outcome.instant;
  }
  return { state: { ...current, timeS: state.timeS + dtS }, events, transition, instant };
}

/**
 * Memajukan simulasi sejauh `dtS × speed`. Sub-langkah mengikuti `chooseDtS`; sub-langkah yang
 * memuat perubahan keadaan diulang lebih pendek (sampai 1 s, atau 0,02 s untuk kejadian seketika)
 * supaya percepatan tidak menggeser waktu kejadian. Setelah tiap sub-langkah rangkaian dihitung
 * ulang, jadi akibat trip langsung berlaku. `dtS = 0` hanya menghasilkan snapshot.
 */
export function stepSimulation(input: StepInput): StepResult {
  const maxSubsteps = input.maxSubsteps ?? DEFAULT_MAX_SUBSTEPS;
  const targetS = Math.max(input.dtS, 0) * Math.max(input.speed ?? 1, 0);
  const events: SimEvent[] = [];
  let state = input.state;
  let frame = solveFrame(input, state);
  let simulatedS = 0;

  for (let n = 0; n < maxSubsteps && targetS - simulatedS > TIME_EPSILON_S; n += 1) {
    const loads = switchLoads(frame);
    const overloads = overloadLoads(frame);
    // Alat yang tidak sedang beban lebih tidak memendekkan langkah.
    const tripping = overloads.filter((load) => Number.isFinite(load.tripTimeS));
    let dtS = chooseDtS([...loads, ...tripping], hasPendingTimers(state), targetS - simulatedS);
    let outcome = advanceSubstep(frame, loads, state, dtS, overloads);
    for (;;) {
      const floorS = outcome.instant ? MCB_MAGNETIC_TRIP_TIME_S : BASE_DT_S;
      if (!outcome.transition || dtS <= floorS) break;
      dtS = outcome.instant ? floorS : Math.max(dtS / RETRY_DIVISOR, floorS);
      outcome = advanceSubstep(frame, loads, state, dtS, overloads);
    }
    state = outcome.state;
    events.push(...outcome.events);
    simulatedS += dtS;
    frame = solveFrame(input, state);
  }
  return { state, snapshot: buildSnapshot(frame, state, events), simulatedS };
}
