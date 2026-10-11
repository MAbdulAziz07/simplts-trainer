// Rangkaian uji untuk engine/*.test.ts, disusun dari circuit/validate-fixtures. Hanya dipakai
// berkas *.test.ts.
import { recognizeSubsystems } from '../circuit/subsystems';
import type { PlacedComponent, Wire } from '../circuit/types';
import { CABLES, pair, place, wire } from '../circuit/validate-fixtures';
import { solveOperatingPoint } from './solver';
import type { OperatingPoint, SolverEnvironment, SolverInput, SolverState } from './types';

/** Siang cerah contoh §2.4: G = 800 W/m², Ta = 30 °C. */
export const NOON: SolverEnvironment = { irradianceWm2: 800, ambientTempC: 30 };
/** Malam pada 20 °C: tahanan kabel sama dengan nilai acuan §8.3. */
export const NIGHT: SolverEnvironment = { irradianceWm2: 0, ambientTempC: 20 };

export interface SolveOptions {
  environment?: SolverEnvironment;
  state?: SolverState;
  closedSwitchIds?: readonly string[];
}

export function solverInput(
  components: readonly PlacedComponent[],
  wires: readonly Wire[],
  { environment = NOON, state, closedSwitchIds }: SolveOptions = {},
): SolverInput {
  const topology = recognizeSubsystems(components, wires, closedSwitchIds);
  return { topology, cables: CABLES, environment, ...(state && { state }) };
}

export function operatingPoint(
  components: readonly PlacedComponent[],
  wires: readonly Wire[],
  options: SolveOptions = {},
): OperatingPoint {
  return solveOperatingPoint(solverInput(components, wires, options));
}

/** Kabel yang sama dengan panjang lain. */
export function withLength(source: Wire, lengthM: number): Wire {
  return { ...source, lengthM };
}

/** Contoh §4.7: baterai → inverter 500 W lewat kabel 25 mm² 1 m, beban AC 500 W. */
export const INVERTER_COMPONENTS: PlacedComponent[] = [
  place('bat1', 'battery'),
  place('inv1', 'inverter-offgrid'),
  place('lamp1', 'load-ac'),
];
export function inverterWires(dcLengthM = 1, dcAreaMm2 = 25): Wire[] {
  return [
    withLength(wire('bat1.pos', 'inv1.dc-pos', dcAreaMm2), dcLengthM),
    withLength(wire('bat1.neg', 'inv1.dc-neg', dcAreaMm2), dcLengthM),
    wire('inv1.ac-l', 'lamp1.a', 2.5, 'cable-nyy'),
    wire('inv1.ac-n', 'lamp1.b', 2.5, 'cable-nyy'),
  ];
}

/** PV → SCC PWM → baterai dengan kabel `lengthM`; tanpa beban. */
export const CHARGE_COMPONENTS: PlacedComponent[] = [
  place('pv1', 'pv-module'),
  place('scc1', 'scc-pwm'),
  place('bat1', 'battery'),
];
export function chargeWires(lengthM = 2): Wire[] {
  return [...pair('pv1', 'scc1', 'pv'), ...pair('bat1', 'scc1', 'bat')].map((source) =>
    withLength(source, lengthM),
  );
}
