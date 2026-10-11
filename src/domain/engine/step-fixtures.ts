// Rangkaian dan pembantu uji untuk langkah waktu (stepper dan bagian-bagiannya). Hanya dipakai
// berkas *.test.ts.
import type { PlacedComponent, Wire } from '../circuit/types';
import { CABLES, OFFGRID_COMPONENTS, place, wire } from '../circuit/validate-fixtures';
import { BATTERY_LFP_24V_100AH } from '../components/test-fixtures';
import { FUSE_POINTS, GRID_PLN, KWH_METER_SDM230 } from '../components/test-fixtures-bos';
import type { CableItem, CatalogItem } from '../types';
import { INVERTER_COMPONENTS, NIGHT } from './engine-fixtures';
import { solveFrame } from './frame';
import { createSimState } from './sim-state';
import type { SimEvent, SimFrame, SimState, StepInput, StepResult } from './step-types';
import { stepSimulation } from './stepper';

/** Kabel uji dengan batas rusak karena panas: Tmax + 20 K selama 60 s (§8.2). */
export const STEP_CABLES: CableItem[] = CABLES.map((cable) => ({
  ...cable,
  protection: {
    maxConductorTempC: cable.electrical.maxConductorTempC,
    overheatDamageMarginK: 20,
    overheatDamageDelayS: 60,
  },
}));

export function withProtection(component: PlacedComponent, protection: object): PlacedComponent {
  return { ...component, item: { ...component.item, protection } as CatalogItem };
}

/** LiFePO4 25,6 V dengan BMS di dalam; batas arus dipilih kecil supaya terlampaui beban uji. */
export function bmsBattery(id: string, protection: object = {}): PlacedComponent {
  return withProtection(place(id, 'battery', BATTERY_LFP_24V_100AH), {
    internalBms: true,
    overVoltageCutoffV: 29.2,
    underVoltageCutoffV: 20,
    overCurrentDischargeA: 20,
    overCurrentDelayS: 10,
    shortCircuitFactor: 3,
    ...protection,
  });
}

export function fuse(id: string, ratedCurrentA: number): PlacedComponent {
  const electrical = {
    poles: 1,
    ratedCurrentA,
    ratedVoltageDcV: 58,
    breakingCapacityKa: 6,
    class: 'ANL',
  };
  const terminals: Parameters<typeof place>[3] = [
    ['in', 'dc+'],
    ['out', 'dc+'],
  ];
  return withProtection(place(id, 'fuse', electrical, terminals), {
    ratedCurrentA,
    ratedVoltageDcV: 58,
    timeCurrentPoints: FUSE_POINTS,
    blowsPermanently: true,
  });
}

/** Sumber → beban DC 200 W (0,72 Ω) lewat `seriesId` di kutub positif bila ada. */
export function directLoadWires(seriesId?: string, areaMm2 = 4, cableId = 'cable-pv'): Wire[] {
  const make = (from: string, to: string) => wire(from, to, areaMm2, cableId);
  const positive = !seriesId
    ? [make('bat1.pos', 'load1.a')]
    : seriesId.startsWith('mcb')
      ? [make('bat1.pos', `${seriesId}.pos-in`), make(`${seriesId}.pos-out`, 'load1.a')]
      : [make('bat1.pos', `${seriesId}.in`), make(`${seriesId}.out`, 'load1.a')];
  return [...positive, make('bat1.neg', 'load1.b')];
}

/** Baterai → MCB DC 2 kutub → inverter 500 W → beban AC 500 W; kabel DC 25 mm². */
export const BREAKER_COMPONENTS: PlacedComponent[] = [
  place('bat1', 'battery'),
  place('mcb1', 'mcb-dc'),
  place('inv1', 'inverter-offgrid'),
  place('lamp1', 'load-ac'),
];
export const BREAKER_WIRES: Wire[] = [
  wire('bat1.pos', 'mcb1.pos-in', 25),
  wire('mcb1.pos-out', 'inv1.dc-pos', 25),
  wire('bat1.neg', 'mcb1.neg-in', 25),
  wire('mcb1.neg-out', 'inv1.dc-neg', 25),
  wire('inv1.ac-l', 'lamp1.a', 2.5, 'cable-nyy'),
  wire('inv1.ac-n', 'lamp1.b', 2.5, 'cable-nyy'),
];

function swap(
  components: readonly PlacedComponent[],
  replacement: PlacedComponent,
): PlacedComponent[] {
  return components.map((component) => (component.id === replacement.id ? replacement : component));
}

/** Baterai → inverter 500 W → beban AC 600 W (P/Pr = 1,2). */
export const OVERLOAD_INVERTER_COMPONENTS: PlacedComponent[] = swap(
  INVERTER_COMPONENTS,
  place('lamp1', 'load-ac', { maxPowerW: 600 }),
);

/** Off-grid kecil dengan beban DC 160 W (sekitar 13,5 A) di terminal beban SCC 10 A. */
export const OVERLOAD_SCC_COMPONENTS: PlacedComponent[] = swap(
  OFFGRID_COMPONENTS,
  place('load1', 'load-dc', { maxPowerW: 160 }),
);

/** Jaringan → kWh meter → beban AC 500 W. */
export const METER_COMPONENTS: PlacedComponent[] = [
  place('grid1', 'grid', GRID_PLN),
  withProtection(
    place('m1', 'kwh-meter', KWH_METER_SDM230, [
      ['l-in', 'acL'],
      ['l-out', 'acL'],
      ['n-in', 'acN'],
      ['n-out', 'acN'],
    ]),
    { currentMaxA: 100, overCurrentDamageA: 100, ipRating: 'IP51' },
  ),
  place('lamp1', 'load-ac'),
];
export function meterWires(reversed = false): Wire[] {
  const [gridSide, loadSide] = reversed ? ['out', 'in'] : ['in', 'out'];
  return [
    wire('grid1.l', `m1.l-${gridSide}`, 2.5, 'cable-nyy'),
    wire(`m1.l-${loadSide}`, 'lamp1.a', 2.5, 'cable-nyy'),
    wire('grid1.n', `m1.n-${gridSide}`, 2.5, 'cable-nyy'),
    wire(`m1.n-${loadSide}`, 'lamp1.b', 2.5, 'cable-nyy'),
  ];
}

type StepOptions = Partial<Omit<StepInput, 'components' | 'wires' | 'state'>> & {
  state?: Partial<SimState>;
};

export function stepInput(
  components: readonly PlacedComponent[],
  wires: readonly Wire[],
  { state, ...options }: StepOptions = {},
): StepInput {
  return {
    components,
    wires,
    cables: STEP_CABLES,
    environment: NIGHT,
    dtS: 1,
    ...options,
    state: createSimState(components, state),
  };
}

export function frameOf(
  components: readonly PlacedComponent[],
  wires: readonly Wire[],
  options: StepOptions = {},
): { frame: SimFrame; state: SimState } {
  const input = stepInput(components, wires, options);
  return { frame: solveFrame(input, input.state), state: input.state };
}

export interface Run {
  state: SimState;
  events: SimEvent[];
  last: StepResult;
}

/** Memanggil `stepSimulation` berulang (`dtS × speed` tiap panggilan) sampai `untilS` atau `stop`. */
export function runUntil(
  input: StepInput,
  untilS: number,
  stop: (result: StepResult) => boolean = () => false,
): Run {
  let last = stepSimulation({ ...input, dtS: 0 });
  const events: SimEvent[] = [];
  while (last.state.timeS < untilS - 1e-9) {
    last = stepSimulation({ ...input, state: last.state });
    events.push(...last.snapshot.events);
    if (stop(last)) break;
  }
  return { state: last.state, events, last };
}
