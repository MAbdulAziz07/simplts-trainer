import { describe, expect, it } from 'vitest';
import { recognizeSubsystems } from './subsystems';
import {
  busbar,
  OFFGRID_COMPONENTS,
  OFFGRID_WIRES,
  pair,
  place,
  ref,
  wire,
} from './validate-fixtures';

/** Off-grid dengan inverter: baterai → busbar → SCC dan inverter; beban AC lewat MCB AC. */
const INVERTER_COMPONENTS = [
  ...OFFGRID_COMPONENTS,
  busbar('bus-pos', 'dc+'),
  busbar('bus-neg', 'dc-'),
  place('inv1', 'inverter-offgrid'),
  place('mcb-ac', 'mcb-ac'),
  place('lamp1', 'load-ac'),
];
const INVERTER_WIRES = [
  wire('pv1.pos', 'mcb1.pos-in'),
  wire('mcb1.pos-out', 'scc1.pv-pos'),
  wire('pv1.neg', 'mcb1.neg-in'),
  wire('mcb1.neg-out', 'scc1.pv-neg'),
  wire('bat1.pos', 'bus-pos.t1'),
  wire('bat1.neg', 'bus-neg.t1'),
  wire('bus-pos.t2', 'scc1.bat-pos'),
  wire('bus-neg.t2', 'scc1.bat-neg'),
  wire('bus-pos.t3', 'inv1.dc-pos'),
  wire('bus-neg.t3', 'inv1.dc-neg'),
  wire('scc1.load-pos', 'load1.a'),
  wire('scc1.load-neg', 'load1.b'),
  wire('inv1.ac-l', 'mcb-ac.l-in'),
  wire('inv1.ac-n', 'mcb-ac.n-in'),
  wire('mcb-ac.l-out', 'lamp1.a'),
  wire('mcb-ac.n-out', 'lamp1.b'),
];

describe('recognizeSubsystems', () => {
  it('off-grid kecil: satu bus, SCC dengan satu string PV, beban di terminal beban SCC', () => {
    const topology = recognizeSubsystems(OFFGRID_COMPONENTS, OFFGRID_WIRES);
    expect(topology.dcBuses).toHaveLength(1);
    expect(topology.dcBuses[0]).toMatchObject({
      id: 'dc1',
      battery: { strings: [['bat1']], irregular: false },
    });
    expect(topology.sccs).toHaveLength(1);
    expect(topology.sccs[0]).toMatchObject({
      id: 'scc1',
      category: 'scc-pwm',
      busId: 'dc1',
      pv: { strings: [['pv1']], irregular: false },
      batPort: { pos: ref('scc1.bat-pos'), neg: ref('scc1.bat-neg') },
      loadPort: { pos: ref('scc1.load-pos'), neg: ref('scc1.load-neg') },
    });
    expect(topology.dcConsumers).toEqual([
      {
        id: 'load1',
        category: 'load-dc',
        port: { pos: ref('load1.a'), neg: ref('load1.b') },
        sccId: 'scc1',
      },
    ]);
    expect(topology.acBuses).toEqual([]);
    expect(topology.unsupportedIds).toEqual([]);
  });

  it('rangkaian kosong: tanpa subsistem', () => {
    const empty = { dcBuses: [], sccs: [], dcConsumers: [], acBuses: [] };
    expect(recognizeSubsystems([], [])).toMatchObject(empty);
  });

  it('MCB PV OFF: array PV tidak lagi dikenali, bus baterai tetap ada', () => {
    const topology = recognizeSubsystems(OFFGRID_COMPONENTS, OFFGRID_WIRES, []);
    expect(topology.sccs[0]?.pv.strings).toEqual([]);
    expect(topology.sccs[0]?.busId).toBe('dc1');
  });

  it('dua modul seri menjadi satu string, urut dari negatif ke positif', () => {
    const components = [
      place('pvA', 'pv-module'),
      place('pvB', 'pv-module'),
      place('scc1', 'scc-pwm'),
    ];
    const wires = [
      wire('pvB.pos', 'scc1.pv-pos'),
      wire('pvA.pos', 'pvB.neg'),
      wire('pvA.neg', 'scc1.pv-neg'),
    ];
    expect(recognizeSubsystems(components, wires).sccs[0]?.pv).toEqual({
      strings: [['pvA', 'pvB']],
      irregular: false,
    });
  });

  it('dua modul paralel menjadi dua string', () => {
    const components = [
      place('pv1', 'pv-module'),
      place('pv2', 'pv-module'),
      busbar('bp', 'pv+'),
      busbar('bn', 'pv-'),
      place('scc1', 'scc-pwm'),
    ];
    const wires = [
      wire('pv1.pos', 'bp.t1'),
      wire('pv2.pos', 'bp.t2'),
      wire('bp.t3', 'scc1.pv-pos'),
      wire('pv1.neg', 'bn.t1'),
      wire('pv2.neg', 'bn.t2'),
      wire('bn.t3', 'scc1.pv-neg'),
    ];
    expect(recognizeSubsystems(components, wires).sccs[0]?.pv.strings).toEqual([['pv1'], ['pv2']]);
  });

  it('seri-paralel campuran ditandai irregular', () => {
    // pv1 dan pv2 paralel, lalu seri dengan pv3: pv3 dipakai dua jalur.
    const components = [
      place('pv1', 'pv-module'),
      place('pv2', 'pv-module'),
      place('pv3', 'pv-module'),
      busbar('mid', 'pv+'),
      busbar('bn', 'pv-'),
      place('scc1', 'scc-pwm'),
    ];
    const wires = [
      wire('pv1.neg', 'bn.t1'),
      wire('pv2.neg', 'bn.t2'),
      wire('bn.t3', 'scc1.pv-neg'),
      wire('pv1.pos', 'mid.t1'),
      wire('pv2.pos', 'mid.t2'),
      wire('mid.t3', 'pv3.neg'),
      wire('pv3.pos', 'scc1.pv-pos'),
    ];
    expect(recognizeSubsystems(components, wires).sccs[0]?.pv).toEqual({
      strings: [
        ['pv1', 'pv3'],
        ['pv2', 'pv3'],
      ],
      irregular: true,
    });
  });

  it('dua baterai seri menjadi bank 24 V', () => {
    const components = [
      place('batA', 'battery'),
      place('batB', 'battery'),
      place('scc1', 'scc-pwm'),
    ];
    const wires = [
      wire('batA.neg', 'scc1.bat-neg'),
      wire('batA.pos', 'batB.neg'),
      wire('batB.pos', 'scc1.bat-pos'),
    ];
    expect(recognizeSubsystems(components, wires).dcBuses[0]?.battery.strings).toEqual([
      ['batA', 'batB'],
    ]);
  });

  it('baterai terbalik: tidak ada bus, SCC tanpa busId', () => {
    const wires = [wire('bat1.pos', 'scc1.bat-neg'), wire('bat1.neg', 'scc1.bat-pos')];
    const topology = recognizeSubsystems(OFFGRID_COMPONENTS, wires);
    expect(topology.dcBuses).toEqual([]);
    expect(topology.sccs[0]?.busId).toBeUndefined();
  });

  it('inverter di busbar baterai dan beban AC lewat MCB AC', () => {
    const topology = recognizeSubsystems(INVERTER_COMPONENTS, INVERTER_WIRES);
    expect(topology.dcBuses).toHaveLength(1);
    expect(topology.dcConsumers.find((consumer) => consumer.id === 'inv1')).toMatchObject({
      category: 'inverter-offgrid',
      busId: 'dc1',
    });
    expect(topology.dcConsumers.find((consumer) => consumer.id === 'load1')?.sccId).toBe('scc1');
    expect(topology.acBuses[0]).toMatchObject({
      id: 'ac1',
      sources: [{ id: 'inv1', category: 'inverter-offgrid' }],
      loads: [{ id: 'lamp1', port: { pos: ref('lamp1.a'), neg: ref('lamp1.b') } }],
    });
    expect(topology.idleAcLoadIds).toEqual([]);
  });

  it('MCB AC OFF: beban AC tidak lagi di bus AC', () => {
    const topology = recognizeSubsystems(INVERTER_COMPONENTS, INVERTER_WIRES, ['mcb1']);
    expect(topology.acBuses[0]?.loads).toEqual([]);
    expect(topology.idleAcLoadIds).toEqual(['lamp1']);
  });

  it('beban DC langsung di baterai dengan kutub tertukar tetap dikenali', () => {
    const components = [place('bat1', 'battery'), place('load1', 'load-dc')];
    const wires = [wire('bat1.pos', 'load1.b'), wire('bat1.neg', 'load1.a')];
    expect(recognizeSubsystems(components, wires).dcConsumers).toEqual([
      {
        id: 'load1',
        category: 'load-dc',
        port: { pos: ref('load1.b'), neg: ref('load1.a') },
        busId: 'dc1',
      },
    ]);
  });

  it('inverter di terminal beban SCC tercatat lewat sccId', () => {
    const components = [
      place('bat1', 'battery'),
      place('scc1', 'scc-pwm'),
      place('inv1', 'inverter-offgrid'),
    ];
    const wires = [
      ...pair('bat1', 'scc1', 'bat'),
      wire('scc1.load-pos', 'inv1.dc-pos'),
      wire('scc1.load-neg', 'inv1.dc-neg'),
    ];
    expect(recognizeSubsystems(components, wires).dcConsumers[0]).toMatchObject({
      id: 'inv1',
      sccId: 'scc1',
    });
  });

  it('jaringan PLN dengan beban AC menjadi bus AC bersumber grid', () => {
    const components = [place('grid1', 'grid'), place('lamp1', 'load-ac')];
    const wires = [wire('grid1.l', 'lamp1.a'), wire('grid1.n', 'lamp1.b')];
    expect(recognizeSubsystems(components, wires).acBuses[0]).toMatchObject({
      sources: [{ id: 'grid1', category: 'grid' }],
      loads: [{ id: 'lamp1' }],
    });
  });

  it('SCC MPPT dan inverter grid-tie masuk unsupportedIds', () => {
    const components = [
      place('mppt1', 'scc-mppt'),
      place('gti1', 'inverter-gridtie'),
      place('bat1', 'battery'),
    ];
    const topology = recognizeSubsystems(components, pair('bat1', 'mppt1', 'bat'));
    expect(topology.unsupportedIds).toEqual(['gti1', 'mppt1']);
    expect(topology.sccs[0]).toMatchObject({ id: 'mppt1', category: 'scc-mppt', busId: 'dc1' });
    expect(topology.sccs[0]?.loadPort).toBeUndefined();
  });

  it('hasil tidak bergantung pada urutan masukan', () => {
    const expected = recognizeSubsystems(INVERTER_COMPONENTS, INVERTER_WIRES);
    const shuffled = recognizeSubsystems(
      [...INVERTER_COMPONENTS].reverse(),
      [...INVERTER_WIRES].reverse(),
    );
    expect(shuffled).toEqual(expected);
  });
});
