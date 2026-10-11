import { describe, expect, it } from 'vitest';
import type { PlacedComponent } from './types';
import { buildContext } from './validate-context';
import {
  cableUnknown,
  DEFAULT_AMBIENT_TEMP_C,
  designCurrentA,
  PV_DESIGN_CURRENT_FACTOR,
  wireAmpacityA,
} from './validate-current';
import {
  CABLES,
  findingsOf,
  OFFGRID_COMPONENTS,
  OFFGRID_WIRES,
  place,
  wire,
} from './validate-fixtures';

describe('designCurrentA', () => {
  const at = (component: PlacedComponent, terminalId: string) =>
    designCurrentA(component.item, terminalId);

  it('menaksir dari parameter katalog', () => {
    expect(at(place('p', 'pv-module'), 'pos')).toBeCloseTo(5.97 * PV_DESIGN_CURRENT_FACTOR, 6);
    expect(at(place('l', 'load-dc'), 'a')).toBeCloseTo(200 / 12, 6);
    expect(at(place('l', 'load-ac'), 'b')).toBeCloseTo(500 / 220, 6);
    expect(at(place('i', 'inverter-offgrid'), 'dc-pos')).toBeCloseTo(500 / (0.88 * 12), 6);
    expect(at(place('i', 'inverter-offgrid'), 'ac-l')).toBeCloseTo(500 / 220, 6);
    expect(at(place('g', 'inverter-gridtie'), 'pv-pos')).toBe(12);
    expect(at(place('g', 'inverter-gridtie'), 'ac-n')).toBeCloseTo(1000 / 220, 6);
    expect(at(place('s', 'scc-pwm'), 'load-pos')).toBe(10);
    expect(at(place('s', 'scc-pwm'), 'bat-pos')).toBe(20);
    expect(at(place('m', 'scc-mppt'), 'pv-pos')).toBe(30);
    expect(at(place('m', 'scc-mppt'), 'bat-neg')).toBe(40);
  });

  it('PE, terminal tak dikenal, dan komponen tanpa taksiran: undefined', () => {
    expect(at(place('i', 'inverter-offgrid'), 'pe')).toBeUndefined();
    expect(at(place('i', 'inverter-offgrid'), 'x')).toBeUndefined();
    expect(at(place('b', 'battery'), 'pos')).toBeUndefined();
  });
});

describe('wireAmpacityA', () => {
  const context = (ambientTempC?: number) =>
    buildContext({ components: [], wires: [], cables: CABLES, ambientTempC });

  it('kabel PV 4 mm² 55 A dan 2,5 mm² 41 A; NYY 2,5 mm² 25 A', () => {
    expect(DEFAULT_AMBIENT_TEMP_C).toBe(30);
    expect(wireAmpacityA(context(), wire('a.x', 'b.y'))).toBe(55);
    expect(wireAmpacityA(context(), wire('a.x', 'b.y', 2.5))).toBe(41);
    expect(wireAmpacityA(context(), wire('a.x', 'b.y', 2.5, 'cable-nyy'))).toBe(25);
  });

  it('suhu sekitar 70 °C menurunkan KHA kabel PV menjadi 92%', () => {
    expect(wireAmpacityA(context(70), wire('a.x', 'b.y'))).toBeCloseTo(55 * 0.92, 10);
  });

  it('kabel atau penampang tak dikenal: undefined', () => {
    expect(wireAmpacityA(context(), wire('a.x', 'b.y', 4, 'cable-lain'))).toBeUndefined();
    expect(wireAmpacityA(context(), wire('a.x', 'b.y', 3))).toBeUndefined();
  });
});

describe('overcurrent', () => {
  const small = OFFGRID_COMPONENTS.map((c) =>
    c.id === 'mcb1' ? place('mcb1', 'mcb-dc', { ratedCurrentA: 6 }) : c,
  );
  const inverter = [place('bat1', 'battery'), place('inv1', 'inverter-offgrid')];
  const dcWires = (areaMm2: number) => [
    wire('bat1.pos', 'inv1.dc-pos', areaMm2),
    wire('bat1.neg', 'inv1.dc-neg', areaMm2),
  ];

  it('MCB 20 A di jalur PV 7,46 A: tanpa temuan', () => {
    expect(findingsOf('breaker-overcurrent', OFFGRID_COMPONENTS, OFFGRID_WIRES)).toEqual([]);
    expect(findingsOf('cable-overcurrent', OFFGRID_COMPONENTS, OFFGRID_WIRES)).toEqual([]);
  });

  it('MCB 6 A di jalur PV: peringatan dari taksiran', () => {
    expect(findingsOf('breaker-overcurrent', small, OFFGRID_WIRES)).toEqual([
      {
        code: 'breaker-overcurrent',
        severity: 'warning',
        componentIds: ['mcb1'],
        params: { currentA: 5.97 * PV_DESIGN_CURRENT_FACTOR, estimated: 1, ratedCurrentA: 6 },
      },
    ]);
  });

  it('arus terukur menggantikan taksiran pada MCB', () => {
    const calm = { currentAByComponentId: { mcb1: -5 } };
    expect(findingsOf('breaker-overcurrent', small, OFFGRID_WIRES, calm)).toEqual([]);
    const high = { currentAByComponentId: { mcb1: -25 } };
    const [found] = findingsOf('breaker-overcurrent', OFFGRID_COMPONENTS, OFFGRID_WIRES, high);
    expect(found?.params).toEqual({ currentA: 25, estimated: 0, ratedCurrentA: 20 });
  });

  it('kabel inverter 47,3 A: bahaya pada 2,5 mm² (41 A), aman pada 4 mm² (55 A)', () => {
    const found = findingsOf('cable-overcurrent', inverter, dcWires(2.5));
    expect(found).toHaveLength(2);
    expect(found[0]).toMatchObject({
      severity: 'danger',
      componentIds: ['bat1', 'inv1'],
      wireIds: ['bat1.neg>inv1.dc-neg'],
      params: { estimated: 1, ampacityA: 41 },
    });
    expect(findingsOf('cable-overcurrent', inverter, dcWires(4))).toEqual([]);
  });

  it('suhu sekitar tinggi menurunkan KHA: 4 mm² tidak lagi cukup pada 80 °C', () => {
    const hot = { ambientTempC: 80 };
    expect(findingsOf('cable-overcurrent', inverter, dcWires(4), hot)).toHaveLength(2);
  });

  it('arus terukur menggantikan taksiran pada kabel', () => {
    const wires = dcWires(2.5);
    const measured = { currentAByWireId: Object.fromEntries(wires.map((w) => [w.id, 10])) };
    expect(findingsOf('cable-overcurrent', inverter, wires, measured)).toEqual([]);
  });

  it('net bercabang tidak ditaksir', () => {
    const components = [...inverter, place('scc1', 'scc-pwm')];
    const wires = [
      ...dcWires(2.5),
      wire('bat1.pos', 'scc1.bat-pos', 2.5),
      wire('bat1.neg', 'scc1.bat-neg', 2.5),
    ];
    expect(findingsOf('cable-overcurrent', components, wires)).toEqual([]);
  });
});

describe('cableUnknown', () => {
  const components = [place('bat1', 'battery'), place('inv1', 'inverter-offgrid')];

  it('kabel katalog dengan penampang di tabel: tanpa temuan', () => {
    expect(findingsOf('cable-unknown', OFFGRID_COMPONENTS, OFFGRID_WIRES)).toEqual([]);
  });

  it('id kabel tak dikenal atau penampang di luar tabel: peringatan', () => {
    const wires = [
      wire('bat1.pos', 'inv1.dc-pos', 4, 'cable-lain'),
      wire('bat1.neg', 'inv1.dc-neg', 3),
    ];
    expect(findingsOf('cable-unknown', components, wires)).toEqual([
      {
        code: 'cable-unknown',
        severity: 'warning',
        componentIds: ['bat1', 'inv1'],
        wireIds: ['bat1.neg>inv1.dc-neg'],
        params: { areaMm2: 3 },
      },
      {
        code: 'cable-unknown',
        severity: 'warning',
        componentIds: ['bat1', 'inv1'],
        wireIds: ['bat1.pos>inv1.dc-pos'],
        params: { areaMm2: 4 },
      },
    ]);
  });

  it('kabel yang ditolak netlist tidak dilaporkan dua kali', () => {
    const ctx = buildContext({
      components,
      wires: [wire('bat1.pos', 'tidak-ada.x', 3)],
      cables: CABLES,
    });
    expect(cableUnknown(ctx)).toEqual([]);
  });
});
