// Rangkaian dan konteks uji aturan skenario. Hanya dipakai berkas *.test.ts.
import type { PlacedComponent, Wire } from '../circuit/types';
import { busbar, wire } from '../circuit/validate-fixtures';
import { SMALL_COMPONENTS, SMALL_WIRES, STC_SITE } from '../engine/scenario-fixtures';
import { stepInput } from '../engine/step-fixtures';
import type { Snapshot, StepInput } from '../engine/step-types';
import { stepSimulation } from '../engine/stepper';
import { referencesOf } from './quantities';
import type { RuleContext } from './rules';

/** Off-grid kecil: pv1 → mcb1 → scc1, bat1 di scc1, load1 60 W di terminal beban; semua ON. */
export const COMPONENTS: PlacedComponent[] = SMALL_COMPONENTS;
export const WIRES: Wire[] = SMALL_WIRES;
export const CLOSED = ['mcb1'];

/** Baterai ke SCC lewat busbar positif `bus1`. */
export const BUS_COMPONENTS: PlacedComponent[] = [...COMPONENTS, busbar('bus1', 'dc+')];
export const BUS_WIRES: Wire[] = [
  ...WIRES.filter((w) => w.id !== 'bat1.pos>scc1.bat-pos'),
  wire('bat1.pos', 'bus1.t1'),
  wire('bus1.t2', 'scc1.bat-pos'),
];

/** Snapshot setelah `seconds` detik simulasi pada 1000 W/m². */
export function snapshotAfter(
  seconds: number,
  options: Partial<StepInput> = {},
  components: readonly PlacedComponent[] = COMPONENTS,
  wires: readonly Wire[] = WIRES,
): Snapshot {
  const input = { ...stepInput(components, wires, { environment: STC_SITE }), ...options };
  let result = stepSimulation({ ...input, dtS: 0 });
  while (result.state.timeS < seconds - 1e-9) {
    result = stepSimulation({ ...input, state: result.state, dtS: 1, speed: 10 });
  }
  return result.snapshot;
}

/** Konteks aturan dengan alat ukur tertutup; `patch` menimpa sebagian. */
export function contextOf(snapshot: Snapshot, patch: Partial<RuleContext> = {}): RuleContext {
  return {
    components: COMPONENTS,
    wires: WIRES,
    closedSwitchIds: CLOSED,
    snapshot,
    findings: [],
    multimeter: { open: false, fn: 'vdc', reading: { kind: 'value', value: 0 } },
    clamp: { open: false, mode: 'dc', reading: { kind: 'value', value: 0 } },
    references: referencesOf(COMPONENTS, STC_SITE, snapshot),
    history: [],
    faultFound: false,
    ...patch,
  };
}
