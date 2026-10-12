// Pembantu uji: menghitung snapshot sebuah rangkaian kecil dari item katalog asli. Hanya dipakai
// berkas *.test.ts.
import {
  createSimState,
  stepSimulation,
  type CatalogItem,
  type PlacedComponent,
  type SimState,
  type Snapshot,
  type SolverEnvironment,
  type Wire,
} from '@/domain';
import { cableItems, findCatalogItem } from '@/store';

export const SUNNY: SolverEnvironment = { irradianceWm2: 1000, ambientTempC: 25 };
export const NIGHT: SolverEnvironment = { irradianceWm2: 0, ambientTempC: 25 };

export function catalogItem(catalogId: string): CatalogItem {
  const item = findCatalogItem(catalogId);
  if (!item) throw new Error(`item ${catalogId} tidak ada di katalog`);
  return item;
}

export const place = (id: string, catalogId: string): PlacedComponent => ({
  id,
  item: catalogItem(catalogId),
});

/** Kabel PV 4 mm² 1 m; `from`/`to` = `komponen.terminal`, id = `from>to`. */
export function wire(from: string, to: string): Wire {
  const [fromComponent = '', fromTerminal = ''] = from.split('.');
  const [toComponent = '', toTerminal = ''] = to.split('.');
  return {
    id: `${from}>${to}`,
    from: { componentId: fromComponent, terminalId: fromTerminal },
    to: { componentId: toComponent, terminalId: toTerminal },
    cableId: 'cable-pv-h1z2z2k',
    areaMm2: 4,
    lengthM: 1,
  };
}

export interface Solved {
  snapshot: Snapshot;
  state: SimState;
}

/** Snapshot rangkaian setelah `dtS` detik (bawaan 0: hanya titik kerja). */
export function solve(
  components: readonly PlacedComponent[],
  wires: readonly Wire[],
  environment: SolverEnvironment = SUNNY,
  init: Partial<SimState> = {},
  dtS = 0,
): Solved {
  const state = createSimState(components, init);
  const result = stepSimulation({ components, wires, cables: cableItems, environment, state, dtS });
  return { snapshot: result.snapshot, state: result.state };
}

/** PV 100 Wp → SCC PWM ← VRLA 12 V, beban DC 12 V di terminal beban SCC. */
export const SCC_COMPONENTS: PlacedComponent[] = [
  place('pv', 'pv-generic-100wp'),
  place('scc', 'scc-pwm-rbl-20a'),
  place('bat', 'bat-vrla-agm-12v-100ah'),
];
export const SCC_WIRES: Wire[] = [
  wire('pv.pos', 'scc.pv-pos'),
  wire('pv.neg', 'scc.pv-neg'),
  wire('scc.bat-pos', 'bat.pos'),
  wire('scc.bat-neg', 'bat.neg'),
];

/** VRLA 12 V → inverter 500 W → kipas 50 W. */
export const INVERTER_COMPONENTS: PlacedComponent[] = [
  place('bat', 'bat-vrla-agm-12v-100ah'),
  place('inv', 'inv-offgrid-500w-12v'),
  place('fan', 'load-ac-fan-50w'),
];
export const INVERTER_WIRES: Wire[] = [
  wire('bat.pos', 'inv.dc-pos'),
  wire('bat.neg', 'inv.dc-neg'),
  wire('inv.ac-l', 'fan.a'),
  wire('inv.ac-n', 'fan.b'),
];
