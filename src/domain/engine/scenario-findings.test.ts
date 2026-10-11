// Skenario ujung-ke-ujung: satu salah rangkai per kode temuan, dibuat dengan mengubah rangkaian
// benar. Tiap salah rangkai hanya boleh memunculkan kodenya sendiri.
import { describe, expect, it } from 'vitest';
import { FINDING_CODES } from '../circuit/types';
import type {
  FindingCode,
  FindingSeverity,
  PlacedComponent,
  ValidationInput,
  Wire,
  WiringEvent,
} from '../circuit/types';
import {
  OFFGRID_BATTERY_WIRES,
  OFFGRID_PV_WIRES,
  pair,
  place,
  wire,
} from '../circuit/validate-fixtures';
import {
  AC_COMPONENTS,
  AC_SIDE_WIRES,
  AC_WIRES,
  inspect,
  INVERTER_ONLY_COMPONENTS,
  inverterOnlyWires,
  PE_WIRES,
  SMALL_COMPONENTS,
  SMALL_WIRES,
  withComponents,
  withoutWires,
} from './scenario-fixtures';

interface FaultCase {
  name: string;
  code: FindingCode;
  severity: FindingSeverity;
  /** Komponen pada temuan pertama. */
  componentIds: string[];
  count: number;
  components: PlacedComponent[];
  wires: Wire[];
  extra?: Partial<ValidationInput>;
}

function connect(wires: readonly Wire[], closedSwitchIds: readonly string[]): WiringEvent[] {
  return wires.map((source) => ({ action: 'connect', wire: source, closedSwitchIds }));
}

const CASES: FaultCase[] = [
  {
    name: 'baterai terbalik di masukan inverter',
    code: 'reverse-polarity',
    severity: 'danger',
    componentIds: ['bat1', 'inv1'],
    count: 1,
    components: AC_COMPONENTS,
    wires: [
      ...SMALL_WIRES,
      wire('bat1.pos', 'inv1.dc-neg'),
      wire('bat1.neg', 'inv1.dc-pos'),
      ...AC_SIDE_WIRES,
      ...PE_WIRES,
    ],
  },
  {
    name: 'kedua kutub baterai disatukan',
    code: 'short-circuit',
    severity: 'danger',
    componentIds: ['bat1'],
    count: 1,
    components: SMALL_COMPONENTS,
    wires: [...SMALL_WIRES, wire('bat1.pos', 'bat1.neg')],
  },
  {
    name: 'PV langsung ke beban tanpa SCC',
    code: 'pv-direct',
    severity: 'danger',
    componentIds: ['load1', 'pv1'],
    count: 1,
    components: SMALL_COMPONENTS,
    wires: [...OFFGRID_BATTERY_WIRES, wire('pv1.pos', 'load1.a'), wire('pv1.neg', 'load1.b')],
  },
  {
    name: 'dua modul seri di SCC PWM sistem 12 V',
    code: 'pv-voc-over-limit',
    severity: 'danger',
    componentIds: ['pv1', 'pv2', 'scc1'],
    count: 1,
    components: withComponents(SMALL_COMPONENTS, place('pv2', 'pv-module')),
    wires: [
      ...withoutWires(SMALL_WIRES, 'pv1.pos'),
      wire('pv1.pos', 'pv2.neg'),
      wire('pv2.pos', 'mcb1.pos-in'),
    ],
  },
  {
    name: 'MCB PV 6 A untuk arus rancangan 7,5 A',
    code: 'breaker-overcurrent',
    severity: 'warning',
    componentIds: ['mcb1'],
    count: 1,
    components: withComponents(SMALL_COMPONENTS, place('mcb1', 'mcb-dc', { ratedCurrentA: 6 })),
    wires: SMALL_WIRES,
  },
  {
    name: 'kabel inverter 500 W hanya 2,5 mm²',
    code: 'cable-overcurrent',
    severity: 'danger',
    componentIds: ['bat1', 'inv1'],
    count: 2,
    components: INVERTER_ONLY_COMPONENTS,
    wires: inverterOnlyWires(2.5),
  },
  {
    name: 'kabel yang tidak ada di katalog',
    code: 'cable-unknown',
    severity: 'warning',
    componentIds: ['mcb1', 'pv1'],
    count: 1,
    components: SMALL_COMPONENTS,
    wires: SMALL_WIRES.map((source) =>
      source.id === 'pv1.pos>mcb1.pos-in' ? { ...source, cableId: 'cable-lain' } : source,
    ),
  },
  {
    name: 'dua baterai seri (24 V) di inverter 12 V',
    code: 'system-voltage-mismatch',
    severity: 'danger',
    componentIds: ['bat1', 'bat2', 'inv1'],
    count: 1,
    components: withComponents(INVERTER_ONLY_COMPONENTS, place('bat2', 'battery')),
    wires: [
      wire('bat1.pos', 'bat2.neg'),
      wire('bat2.pos', 'inv1.dc-pos'),
      wire('bat1.neg', 'inv1.dc-neg'),
      ...withoutWires(inverterOnlyWires(), 'bat1'),
    ],
  },
  {
    name: 'PV dipasang, baterai belum',
    code: 'pv-before-battery',
    severity: 'warning',
    componentIds: ['scc1'],
    count: 1,
    components: SMALL_COMPONENTS,
    wires: withoutWires(SMALL_WIRES, 'bat1'),
  },
  {
    name: 'kabel negatif beban belum dipasang',
    code: 'open-circuit',
    severity: 'info',
    componentIds: ['load1'],
    count: 2,
    components: SMALL_COMPONENTS,
    wires: withoutWires(SMALL_WIRES, 'load1.b'),
  },
  {
    name: 'beban AC di terminal beban SCC',
    code: 'ac-load-on-dc',
    severity: 'warning',
    componentIds: ['lamp1', 'scc1'],
    count: 1,
    components: withComponents(
      SMALL_COMPONENTS.filter((component) => component.id !== 'load1'),
      place('lamp1', 'load-ac'),
    ),
    wires: [
      ...withoutWires(SMALL_WIRES, 'load1'),
      wire('scc1.load-pos', 'lamp1.a'),
      wire('scc1.load-neg', 'lamp1.b'),
    ],
  },
  {
    name: 'inverter grid-tie tanpa sambungan jaringan',
    code: 'gridtie-without-grid',
    severity: 'warning',
    componentIds: ['gt1'],
    count: 1,
    components: [
      place('pv1', 'pv-module'),
      place('gt1', 'inverter-gridtie'),
      place('gnd1', 'grounding'),
    ],
    wires: [...pair('pv1', 'gt1', 'pv'), wire('gt1.pe', 'gnd1.pe')],
  },
  {
    name: 'PE inverter tidak sampai ke elektrode',
    code: 'pe-not-connected',
    severity: 'warning',
    componentIds: ['inv1'],
    count: 1,
    components: AC_COMPONENTS,
    wires: withoutWires(AC_WIRES, 'pe1'),
  },
  {
    name: 'kabel PV dipasang saat MCB PV ON',
    code: 'live-rewiring',
    severity: 'danger',
    componentIds: ['mcb1'],
    count: 4,
    components: SMALL_COMPONENTS,
    wires: SMALL_WIRES,
    extra: {
      wiringLog: [...connect(OFFGRID_BATTERY_WIRES, []), ...connect(OFFGRID_PV_WIRES, ['mcb1'])],
    },
  },
];

describe('salah rangkai → temuan', () => {
  it('daftar skenario mencakup semua kode temuan', () => {
    expect(CASES.map((fault) => fault.code).sort()).toEqual([...FINDING_CODES].sort());
  });

  it.each(CASES)('$name → $code ($severity)', (fault) => {
    const found = inspect(fault.components, fault.wires, fault.extra);
    expect(found.map((finding) => finding.code)).toEqual(Array(fault.count).fill(fault.code));
    expect(found[0]).toMatchObject({
      code: fault.code,
      severity: fault.severity,
      componentIds: fault.componentIds,
    });
    expect(found.every((finding) => finding.severity === fault.severity)).toBe(true);
  });
});
