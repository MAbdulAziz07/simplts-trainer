// Satu hitungan rangkaian pada keadaan tertentu: topologi, titik kerja, dan potensial
// (docs/ARSITEKTUR.md §2 langkah 4a–4b).
import { recognizeSubsystems } from '../circuit/subsystems';
import { readPotentials } from './potentials';
import { readOperatingPoint } from './readings';
import { activeCircuit, toSolverState } from './sim-state';
import { solveSystem } from './solver';
import type { SimFrame, SimState, StepInput } from './step-types';

type FrameInput = Pick<StepInput, 'components' | 'wires' | 'cables' | 'environment' | 'controls'>;

/** Rangkaian dihitung ulang dari awal: kejadian sebelumnya (trip, putus, rusak) sudah berlaku. */
export function solveFrame(input: FrameInput, state: SimState): SimFrame {
  const { cables, environment, controls = {} } = input;
  const active = activeCircuit(state, input.wires);
  const topology = recognizeSubsystems(input.components, active.wires, active.closedSwitchIds);
  const solved = solveSystem({
    topology,
    cables,
    environment,
    state: toSolverState(state, controls),
  });
  const point = readOperatingPoint(solved);
  const potentials = readPotentials(solved, point);
  return { environment, cables, controls, topology, solved, point, potentials };
}
