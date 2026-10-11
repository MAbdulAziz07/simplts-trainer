// Rangkaian uji untuk validate-*.test.ts. Terminal meniru katalog (src/data/catalog); parameter
// listrik diambil dari components/test-fixtures*. Hanya dipakai berkas *.test.ts.
import {
  CABLE_NYY,
  CABLE_PV,
  INVERTER_500W,
  INVERTER_500W_PROTECTION,
  LOAD_AC_500W,
  LOAD_DC_200W,
  MCB_AC_10A,
  MCB_DC_20A,
  PWM_RBL_20A,
  PWM_RBL_20A_PROTECTION,
} from '../components/test-fixtures-bos';
import { BATTERY_VRLA_100AH, PV_GENERIC_100WP } from '../components/test-fixtures';
import type { CableItem, CatalogItem, ComponentCategory, TerminalKind } from '../types';
import type {
  Finding,
  FindingCode,
  PlacedComponent,
  TerminalRef,
  ValidationInput,
  Wire,
} from './types';
import { validateCircuit } from './validate';

type TerminalSpec = [id: string, kind: TerminalKind, maxWires?: number];

const POLAR_DC: TerminalSpec[] = [
  ['pos', 'dc+', 2],
  ['neg', 'dc-', 2],
];
const AC_OUT: TerminalSpec[] = [
  ['ac-l', 'acL'],
  ['ac-n', 'acN'],
  ['pe', 'pe'],
];
const PV_IN: TerminalSpec[] = [
  ['pv-pos', 'pv+'],
  ['pv-neg', 'pv-'],
];
const BAT_IN: TerminalSpec[] = [
  ['bat-pos', 'dc+'],
  ['bat-neg', 'dc-'],
];

const TERMINALS: Partial<Record<ComponentCategory, TerminalSpec[]>> = {
  'pv-module': [
    ['pos', 'pv+'],
    ['neg', 'pv-'],
  ],
  battery: POLAR_DC,
  'scc-pwm': [...PV_IN, ...BAT_IN, ['load-pos', 'dc+'], ['load-neg', 'dc-']],
  'scc-mppt': [...PV_IN, ...BAT_IN],
  'inverter-offgrid': [['dc-pos', 'dc+'], ['dc-neg', 'dc-'], ...AC_OUT],
  'inverter-gridtie': [...PV_IN, ...AC_OUT],
  'mcb-dc': [
    ['pos-in', 'dc+'],
    ['pos-out', 'dc+'],
    ['neg-in', 'dc-'],
    ['neg-out', 'dc-'],
  ],
  'mcb-ac': [
    ['l-in', 'acL'],
    ['l-out', 'acL'],
    ['n-in', 'acN'],
    ['n-out', 'acN'],
  ],
  'load-dc': [
    ['a', 'dc+'],
    ['b', 'dc-'],
  ],
  'load-ac': [
    ['a', 'acL'],
    ['b', 'acN'],
  ],
  grid: [
    ['l', 'acL'],
    ['n', 'acN'],
    ['pe', 'pe'],
  ],
  grounding: [['pe', 'pe', 6]],
};

const PARAMS: Partial<Record<ComponentCategory, { electrical: object; protection?: object }>> = {
  'pv-module': { electrical: PV_GENERIC_100WP },
  battery: { electrical: BATTERY_VRLA_100AH },
  'scc-pwm': { electrical: PWM_RBL_20A, protection: PWM_RBL_20A_PROTECTION },
  'scc-mppt': {
    electrical: { batteryNominalV: 24, chargeCurrentMaxA: 40, inputCurrentMaxA: 30 },
    protection: { vocMaxV: 100, vocFaultFactor: 1.1, features: ['reverse-polarity'] },
  },
  'inverter-offgrid': { electrical: INVERTER_500W, protection: INVERTER_500W_PROTECTION },
  'inverter-gridtie': {
    electrical: { ratedAcPowerW: 1000, acOutputVoltageV: 220, dcCurrentMaxA: 12 },
    protection: { dcVocMaxV: 60, reversePolarityDamages: false },
  },
  'mcb-dc': { electrical: MCB_DC_20A },
  'mcb-ac': { electrical: MCB_AC_10A },
  'load-dc': { electrical: LOAD_DC_200W },
  'load-ac': { electrical: LOAD_AC_500W },
};

/** Komponen uji; `electrical` menimpa sebagian parameter bawaan kategori itu. */
export function place(
  id: string,
  category: ComponentCategory,
  electrical: object = {},
  terminals: TerminalSpec[] = TERMINALS[category] ?? [],
): PlacedComponent {
  const params = PARAMS[category];
  const item = {
    id: `catalog-${category}`,
    category,
    name: category,
    packages: ['min'],
    electrical: { ...params?.electrical, ...electrical },
    protection: params?.protection ?? {},
    terminals: terminals.map(([terminalId, kind, maxWires = 1]) => {
      return { id: terminalId, label: terminalId, kind, xPct: 0, yPct: 0, maxWires };
    }),
    image: '',
    datasheet: { source: '', coverage: 'generic', verify: [] },
  };
  return { id, item: item as unknown as CatalogItem };
}

export function busbar(id: string, kind: TerminalKind, positions = 4): PlacedComponent {
  const terminals = Array.from({ length: positions }, (_, i): TerminalSpec => [`t${i + 1}`, kind]);
  return place(id, 'busbar', {}, terminals);
}

export function ref(text: string): TerminalRef {
  const [componentId = '', terminalId = ''] = text.split('.');
  return { componentId, terminalId };
}

/** Kabel katalog uji: `cable-pv` (2,5 mm² 41 A; 4 mm² 55 A) dan `cable-nyy` (2,5 mm² 25 A). */
export const CABLES: CableItem[] = [
  place('cable-pv', 'cable', {
    ...CABLE_PV,
    sizes: [
      {
        areaMm2: 2.5,
        rMaxOhmPerKm: 8.21,
        ampacityAirA: 41,
        ampacitySurfaceA: 39,
        ampacityTouchingA: 33,
      },
      ...CABLE_PV.sizes,
    ],
  }),
  place('cable-nyy', 'cable', CABLE_NYY),
].map((cable, index) => ({ ...cable.item, id: ['cable-pv', 'cable-nyy'][index] }) as CableItem);

/** Kabel `from>to`, mis. `wire('pv1.pos', 'scc1.pv-pos')`; bawaan kabel PV 4 mm². */
export function wire(from: string, to: string, areaMm2 = 4, cableId = 'cable-pv'): Wire {
  return { id: `${from}>${to}`, from: ref(from), to: ref(to), cableId, areaMm2, lengthM: 2 };
}

/** Kabel + dan − sekaligus: `pair('pv1', 'scc1', 'pv')` = pv1.pos→scc1.pv-pos, pv1.neg→scc1.pv-neg. */
export function pair(source: string, device: string, port: string): Wire[] {
  return [
    wire(`${source}.pos`, `${device}.${port}-pos`),
    wire(`${source}.neg`, `${device}.${port}-neg`),
  ];
}

/** Off-grid kecil yang benar: PV → MCB → SCC PWM, baterai 12 V, beban DC di keluaran beban. */
export const OFFGRID_COMPONENTS: PlacedComponent[] = [
  place('pv1', 'pv-module'),
  place('mcb1', 'mcb-dc'),
  place('scc1', 'scc-pwm'),
  place('bat1', 'battery'),
  place('load1', 'load-dc'),
];
export const OFFGRID_PV_WIRES: Wire[] = [
  wire('pv1.pos', 'mcb1.pos-in'),
  wire('mcb1.pos-out', 'scc1.pv-pos'),
  wire('pv1.neg', 'mcb1.neg-in'),
  wire('mcb1.neg-out', 'scc1.pv-neg'),
];
export const OFFGRID_BATTERY_WIRES: Wire[] = pair('bat1', 'scc1', 'bat');
export const OFFGRID_LOAD_WIRES: Wire[] = [
  wire('scc1.load-pos', 'load1.a'),
  wire('scc1.load-neg', 'load1.b'),
];
export const OFFGRID_WIRES: Wire[] = [
  ...OFFGRID_PV_WIRES,
  ...OFFGRID_BATTERY_WIRES,
  ...OFFGRID_LOAD_WIRES,
];

type ExtraInput = Partial<Omit<ValidationInput, 'components' | 'wires'>>;

/** Temuan dengan kode tertentu dari `validateCircuit`; kabel katalog bawaan `CABLES`. */
export function findingsOf(
  code: FindingCode,
  components: readonly PlacedComponent[],
  wires: readonly Wire[],
  extra: ExtraInput = {},
): Finding[] {
  const input = { components, wires, cables: CABLES, ...extra };
  return validateCircuit(input).filter((found) => found.code === code);
}
