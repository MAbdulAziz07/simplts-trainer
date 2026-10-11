// Rangkaian dan pembantu uji skenario ujung-ke-ujung: pemeriksaan rangkaian (`validateCircuit`)
// lalu simulasi (`stepSimulation`) atas rangkaian yang sama. Hanya dipakai berkas *.test.ts.
import type { Finding, PlacedComponent, ValidationInput, Wire } from '../circuit/types';
import { validateCircuit } from '../circuit/validate';
import {
  busbar,
  OFFGRID_COMPONENTS,
  OFFGRID_WIRES,
  pair,
  place,
  wire,
} from '../circuit/validate-fixtures';
import { MCB_AC_10A } from '../components/test-fixtures-bos';
import { runUntil, STEP_CABLES, stepInput } from './step-fixtures';
import type { Run } from './step-fixtures';
import type { SimState, StepInput } from './step-types';
import type { SolverEnvironment } from './types';

/** Kondisi uji tugas: G = 1000 W/m², suhu sekitar 25 °C (suhu sel sekitar 56 °C lewat NOCT). */
export const STC_SITE: SolverEnvironment = { irradianceWm2: 1000, ambientTempC: 25 };

/** Mengganti komponen ber-id sama; yang id-nya belum ada ditambahkan di belakang. */
export function withComponents(
  base: readonly PlacedComponent[],
  ...changed: PlacedComponent[]
): PlacedComponent[] {
  const ids = new Set(base.map((component) => component.id));
  const replaced = base.map((component) => changed.find((c) => c.id === component.id) ?? component);
  return [...replaced, ...changed.filter((component) => !ids.has(component.id))];
}

/** Membuang kabel yang menyentuh salah satu terminal `komponen.terminal` atau komponen `id`. */
export function withoutWires(wires: readonly Wire[], ...targets: string[]): Wire[] {
  const touches = ({ componentId, terminalId }: Wire['from']) =>
    targets.includes(componentId) || targets.includes(`${componentId}.${terminalId}`);
  return wires.filter((source) => !touches(source.from) && !touches(source.to));
}

/** Off-grid kecil yang benar: PV 100 Wp → MCB → SCC PWM, VRLA 12 V, beban DC 60 W di terminal beban. */
export const SMALL_COMPONENTS: PlacedComponent[] = withComponents(
  OFFGRID_COMPONENTS,
  place('load1', 'load-dc', { maxPowerW: 60 }),
);
export const SMALL_WIRES: Wire[] = OFFGRID_WIRES;

/** Off-grid kecil + inverter 500 W, MCB AC, beban AC 200 W, dan PE ke elektrode lewat rel PE. */
export const AC_COMPONENTS: PlacedComponent[] = [
  ...SMALL_COMPONENTS,
  place('inv1', 'inverter-offgrid'),
  place('mcb2', 'mcb-ac'),
  place('lamp1', 'load-ac', { maxPowerW: 200 }),
  place('gnd1', 'grounding'),
  busbar('pe1', 'pe'),
];
export const AC_SIDE_WIRES: Wire[] = [
  wire('inv1.ac-l', 'mcb2.l-in'),
  wire('mcb2.l-out', 'lamp1.a'),
  wire('inv1.ac-n', 'mcb2.n-in'),
  wire('mcb2.n-out', 'lamp1.b'),
];
export const PE_WIRES: Wire[] = [wire('inv1.pe', 'pe1.t1'), wire('pe1.t2', 'gnd1.pe')];
export const AC_WIRES: Wire[] = [
  ...SMALL_WIRES,
  ...pair('bat1', 'inv1', 'dc'),
  ...AC_SIDE_WIRES,
  ...PE_WIRES,
];

/** Baterai → inverter 500 W → beban AC 500 W dengan PE terpasang; kabel DC bawaan 4 mm² 1 m. */
export const INVERTER_ONLY_COMPONENTS: PlacedComponent[] = [
  place('bat1', 'battery'),
  place('inv1', 'inverter-offgrid'),
  place('lamp1', 'load-ac'),
  place('gnd1', 'grounding'),
];
export function inverterOnlyWires(areaMm2 = 4, lengthM = 1): Wire[] {
  const dc = [
    wire('bat1.pos', 'inv1.dc-pos', areaMm2),
    wire('bat1.neg', 'inv1.dc-neg', areaMm2),
  ].map((source) => ({ ...source, lengthM }));
  return [
    ...dc,
    wire('inv1.ac-l', 'lamp1.a', 2.5, 'cable-nyy'),
    wire('inv1.ac-n', 'lamp1.b', 2.5, 'cable-nyy'),
    wire('inv1.pe', 'gnd1.pe'),
  ];
}

/** MCB AC 10 A satu kutub yang dipasang di kutub positif sirkuit DC. */
export function acBreakerOnDc(id: string): PlacedComponent {
  return place(id, 'mcb-ac', MCB_AC_10A, [
    ['pos-in', 'acL'],
    ['pos-out', 'acL'],
  ]);
}

type ValidationExtra = Partial<Omit<ValidationInput, 'components' | 'wires' | 'cables'>>;

/** Semua temuan `validateCircuit` untuk rangkaian itu, dengan kabel katalog uji. */
export function inspect(
  components: readonly PlacedComponent[],
  wires: readonly Wire[],
  extra: ValidationExtra = {},
): Finding[] {
  return validateCircuit({ components, wires, cables: STEP_CABLES, ...extra });
}

export interface SimulateOptions extends Partial<Pick<StepInput, 'controls' | 'dtS' | 'speed'>> {
  environment?: SolverEnvironment;
  state?: Partial<SimState>;
  untilS?: number;
  /** Berhenti pada kejadian pertama; bawaan `true`. */
  stopOnEvent?: boolean;
}

/** Menjalankan rangkaian pada 1000 W/m², 25 °C sampai `untilS` (bawaan 10 menit). */
export function simulate(
  components: readonly PlacedComponent[],
  wires: readonly Wire[],
  { untilS = 600, stopOnEvent = true, environment = STC_SITE, ...options }: SimulateOptions = {},
): Run {
  const input = stepInput(components, wires, { environment, dtS: 1, speed: 10, ...options });
  return runUntil(input, untilS, (result) => stopOnEvent && result.snapshot.events.length > 0);
}
