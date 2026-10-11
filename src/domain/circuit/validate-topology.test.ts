import { describe, expect, it } from 'vitest';
import {
  busbar,
  findingsOf,
  OFFGRID_BATTERY_WIRES,
  OFFGRID_COMPONENTS,
  OFFGRID_PV_WIRES,
  OFFGRID_WIRES,
  pair,
  place,
  ref,
  wire,
} from './validate-fixtures';

describe('pvDirect', () => {
  const components = [
    place('pv1', 'pv-module'),
    place('mcb1', 'mcb-dc'),
    place('inv1', 'inverter-offgrid'),
    place('load1', 'load-dc'),
  ];

  it('PV lewat SCC: tanpa temuan', () => {
    expect(findingsOf('pv-direct', OFFGRID_COMPONENTS, OFFGRID_WIRES)).toEqual([]);
  });

  it('PV ke inverter off-grid: bahaya', () => {
    expect(findingsOf('pv-direct', components, pair('pv1', 'inv1', 'dc'))).toEqual([
      { code: 'pv-direct', severity: 'danger', componentIds: ['inv1', 'pv1'] },
    ]);
  });

  it('PV ke beban lewat MCB: tetap terdeteksi', () => {
    const wires = [wire('pv1.pos', 'mcb1.pos-in'), wire('mcb1.pos-out', 'load1.a')];
    const [found] = findingsOf('pv-direct', components, wires);
    expect(found?.componentIds).toEqual(['load1', 'pv1']);
  });
});

describe('openCircuit', () => {
  it('rangkaian lengkap dan port yang tidak dipakai: tanpa temuan', () => {
    expect(findingsOf('open-circuit', OFFGRID_COMPONENTS, OFFGRID_WIRES)).toEqual([]);
    const withoutLoad = [...OFFGRID_PV_WIRES, ...OFFGRID_BATTERY_WIRES];
    expect(findingsOf('open-circuit', OFFGRID_COMPONENTS, withoutLoad)).toEqual([]);
  });

  it('baru satu kutub yang dipasangi kabel: info pada kedua komponen', () => {
    const found = findingsOf('open-circuit', OFFGRID_COMPONENTS, [
      wire('bat1.pos', 'scc1.bat-pos'),
    ]);
    expect(found).toEqual([
      {
        code: 'open-circuit',
        severity: 'info',
        componentIds: ['bat1'],
        terminals: [ref('bat1.neg')],
      },
      {
        code: 'open-circuit',
        severity: 'info',
        componentIds: ['scc1'],
        terminals: [ref('scc1.bat-neg')],
      },
    ]);
  });

  it('MCB baru dipasangi kabel di sisi masuk', () => {
    const found = findingsOf('open-circuit', OFFGRID_COMPONENTS, [wire('pv1.pos', 'mcb1.pos-in')]);
    expect(found.find((f) => f.componentIds[0] === 'mcb1')?.terminals).toEqual([
      ref('mcb1.pos-out'),
    ]);
  });
});

describe('acLoadOnDc', () => {
  const components = [
    ...OFFGRID_COMPONENTS,
    place('inv1', 'inverter-offgrid'),
    place('lamp1', 'load-ac'),
    place('mcb2', 'mcb-dc'),
  ];

  it('beban AC di keluaran AC inverter, juga lewat MCB DC: tanpa temuan', () => {
    const direct = [wire('inv1.ac-l', 'lamp1.a'), wire('inv1.ac-n', 'lamp1.b')];
    expect(findingsOf('ac-load-on-dc', components, direct)).toEqual([]);
    const viaMcb = [
      wire('inv1.ac-l', 'mcb2.pos-in'),
      wire('mcb2.pos-out', 'lamp1.a'),
      wire('inv1.ac-n', 'lamp1.b'),
    ];
    expect(findingsOf('ac-load-on-dc', components, viaMcb)).toEqual([]);
  });

  it('beban AC di keluaran beban SCC: peringatan', () => {
    const wires = [wire('scc1.load-pos', 'lamp1.a'), wire('scc1.load-neg', 'lamp1.b')];
    expect(findingsOf('ac-load-on-dc', components, wires)).toEqual([
      { code: 'ac-load-on-dc', severity: 'warning', componentIds: ['lamp1', 'scc1'] },
    ]);
  });

  it('beban AC langsung ke baterai', () => {
    const wires = [wire('bat1.pos', 'lamp1.a'), wire('bat1.neg', 'lamp1.b')];
    const [found] = findingsOf('ac-load-on-dc', components, wires);
    expect(found?.componentIds).toEqual(['bat1', 'lamp1']);
  });
});

describe('gridtieWithoutGrid', () => {
  const components = [
    place('pv1', 'pv-module'),
    place('gt1', 'inverter-gridtie'),
    place('mcb1', 'mcb-ac'),
    place('grid1', 'grid'),
  ];
  const acWires = [
    wire('gt1.ac-l', 'mcb1.l-in'),
    wire('mcb1.l-out', 'grid1.l'),
    wire('gt1.ac-n', 'mcb1.n-in'),
    wire('mcb1.n-out', 'grid1.n'),
  ];

  it('tersambung ke jaringan lewat MCB AC, atau belum dirangkai: tanpa temuan', () => {
    expect(findingsOf('gridtie-without-grid', components, acWires)).toEqual([]);
    expect(findingsOf('gridtie-without-grid', components, [])).toEqual([]);
  });

  it('hanya sisi PV yang dirangkai: peringatan', () => {
    expect(findingsOf('gridtie-without-grid', components, pair('pv1', 'gt1', 'pv'))).toEqual([
      { code: 'gridtie-without-grid', severity: 'warning', componentIds: ['gt1'] },
    ]);
  });

  it('hanya L yang sampai ke jaringan', () => {
    expect(findingsOf('gridtie-without-grid', components, acWires.slice(0, 2))).toHaveLength(1);
  });
});

describe('peNotConnected', () => {
  const components = [
    place('bat1', 'battery'),
    place('inv1', 'inverter-offgrid'),
    place('grid1', 'grid'),
    place('gnd1', 'grounding'),
    busbar('pe1', 'pe'),
  ];
  const dcWires = pair('bat1', 'inv1', 'dc');

  it('PE ke elektrode langsung atau lewat rel PE: tanpa temuan', () => {
    expect(
      findingsOf('pe-not-connected', components, [...dcWires, wire('inv1.pe', 'gnd1.pe')]),
    ).toEqual([]);
    const viaBar = [...dcWires, wire('inv1.pe', 'pe1.t1'), wire('pe1.t2', 'gnd1.pe')];
    expect(findingsOf('pe-not-connected', components, viaBar)).toEqual([]);
  });

  it('komponen yang belum dirangkai dan jaringan tidak diperiksa', () => {
    expect(findingsOf('pe-not-connected', components, [wire('grid1.l', 'pe1.t3')])).toEqual([]);
  });

  it('PE tidak dipasang, atau hanya sampai rel PE: peringatan', () => {
    const expected = [
      {
        code: 'pe-not-connected',
        severity: 'warning',
        componentIds: ['inv1'],
        terminals: [ref('inv1.pe')],
      },
    ];
    expect(findingsOf('pe-not-connected', components, dcWires)).toEqual(expected);
    expect(
      findingsOf('pe-not-connected', components, [...dcWires, wire('inv1.pe', 'pe1.t1')]),
    ).toEqual(expected);
  });
});
