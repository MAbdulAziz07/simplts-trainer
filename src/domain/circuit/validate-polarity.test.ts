import { describe, expect, it } from 'vitest';
import {
  findingsOf,
  OFFGRID_COMPONENTS,
  OFFGRID_PV_WIRES,
  OFFGRID_WIRES,
  pair,
  place,
  ref,
  wire,
} from './validate-fixtures';

describe('reversePolarity', () => {
  it('rangkaian benar: tanpa temuan', () => {
    expect(findingsOf('reverse-polarity', OFFGRID_COMPONENTS, OFFGRID_WIRES)).toEqual([]);
  });

  it('baterai terbalik di SCC PWM yang berproteksi: peringatan', () => {
    const wires = [wire('bat1.pos', 'scc1.bat-neg'), wire('bat1.neg', 'scc1.bat-pos')];
    expect(findingsOf('reverse-polarity', OFFGRID_COMPONENTS, wires)).toEqual([
      {
        code: 'reverse-polarity',
        severity: 'warning',
        componentIds: ['bat1', 'scc1'],
        terminals: [ref('scc1.bat-pos'), ref('scc1.bat-neg')],
      },
    ]);
  });

  it('baterai terbalik di inverter tanpa proteksi: bahaya', () => {
    const components = [place('bat1', 'battery'), place('inv1', 'inverter-offgrid')];
    const wires = [wire('bat1.pos', 'inv1.dc-neg'), wire('bat1.neg', 'inv1.dc-pos')];
    const [found] = findingsOf('reverse-polarity', components, wires);
    expect(found?.severity).toBe('danger');
    expect(found?.componentIds).toEqual(['bat1', 'inv1']);
  });

  it('cukup satu kabel yang salah kutub', () => {
    const components = [place('bat1', 'battery'), place('inv1', 'inverter-offgrid')];
    expect(
      findingsOf('reverse-polarity', components, [wire('bat1.neg', 'inv1.dc-pos')]),
    ).toHaveLength(1);
  });

  it('PV terbalik lewat MCB tetap terdeteksi', () => {
    const wires = [
      wire('pv1.pos', 'mcb1.pos-in'),
      wire('mcb1.pos-out', 'scc1.pv-neg'),
      wire('pv1.neg', 'mcb1.neg-in'),
      wire('mcb1.neg-out', 'scc1.pv-pos'),
    ];
    const [found] = findingsOf('reverse-polarity', OFFGRID_COMPONENTS, wires);
    expect(found?.componentIds).toEqual(['pv1', 'scc1']);
    expect(found?.terminals).toEqual([ref('scc1.pv-pos'), ref('scc1.pv-neg')]);
  });

  it('beban DC terbalik di keluaran beban SCC: peringatan', () => {
    const wires = [wire('scc1.load-pos', 'load1.b'), wire('scc1.load-neg', 'load1.a')];
    const [found] = findingsOf('reverse-polarity', OFFGRID_COMPONENTS, wires);
    expect(found?.severity).toBe('warning');
    expect(found?.componentIds).toEqual(['load1', 'scc1']);
  });

  it('SCC MPPT dan grid-tie berproteksi: peringatan', () => {
    const components = [
      place('pv1', 'pv-module'),
      place('pv2', 'pv-module'),
      place('mppt1', 'scc-mppt'),
      place('gt1', 'inverter-gridtie'),
    ];
    const wires = [
      wire('pv1.pos', 'mppt1.pv-neg'),
      wire('pv1.neg', 'mppt1.pv-pos'),
      wire('pv2.pos', 'gt1.pv-neg'),
      wire('pv2.neg', 'gt1.pv-pos'),
    ];
    const found = findingsOf('reverse-polarity', components, wires);
    expect(found.map((f) => [f.severity, f.componentIds])).toEqual([
      ['warning', ['gt1', 'pv2']],
      ['warning', ['mppt1', 'pv1']],
    ]);
  });

  it('titik tengah deret seri tidak dianggap terbalik', () => {
    const components = [
      place('b1', 'battery'),
      place('b2', 'battery'),
      place('inv1', 'inverter-offgrid'),
    ];
    const wires = [
      wire('b1.pos', 'b2.neg'),
      wire('b2.pos', 'inv1.dc-pos'),
      wire('b1.pos', 'inv1.dc-neg'),
    ];
    expect(findingsOf('reverse-polarity', components, wires)).toEqual([]);
  });
});

describe('shortCircuit', () => {
  const batteries = [place('b1', 'battery'), place('b2', 'battery'), place('b3', 'battery')];

  it('rangkaian benar, baterai seri, dan baterai paralel: tanpa temuan', () => {
    expect(findingsOf('short-circuit', OFFGRID_COMPONENTS, OFFGRID_WIRES)).toEqual([]);
    expect(findingsOf('short-circuit', batteries, [wire('b1.pos', 'b2.neg')])).toEqual([]);
    const parallel = [wire('b1.pos', 'b2.pos'), wire('b1.neg', 'b2.neg')];
    expect(findingsOf('short-circuit', batteries, parallel)).toEqual([]);
  });

  it('kedua kutub baterai disatukan: bahaya', () => {
    expect(findingsOf('short-circuit', batteries, [wire('b1.pos', 'b1.neg')])).toEqual([
      { code: 'short-circuit', severity: 'danger', componentIds: ['b1'] },
    ]);
  });

  it('lewat MCB terdeteksi walau MCB masih OFF', () => {
    const components = [place('b1', 'battery'), place('mcb1', 'mcb-dc')];
    const wires = [wire('b1.pos', 'mcb1.pos-in'), wire('mcb1.pos-out', 'b1.neg')];
    expect(findingsOf('short-circuit', components, wires, { closedSwitchIds: [] })).toHaveLength(1);
  });

  it('deret seri yang ujungnya disatukan (paralel terbalik)', () => {
    const wires = [wire('b1.pos', 'b2.neg'), wire('b2.pos', 'b1.neg')];
    const [found] = findingsOf('short-circuit', batteries, wires);
    expect(found?.componentIds).toEqual(['b1', 'b2']);
  });

  it('baterai 12 V diparalel dengan deret 24 V', () => {
    const wires = [wire('b1.pos', 'b2.neg'), wire('b3.neg', 'b1.neg'), wire('b3.pos', 'b2.pos')];
    const [found] = findingsOf('short-circuit', batteries, wires);
    expect(found?.componentIds).toEqual(['b1', 'b2', 'b3']);
  });

  it('modul PV dihubung singkat: peringatan', () => {
    const [found] = findingsOf(
      'short-circuit',
      [place('pv1', 'pv-module')],
      [wire('pv1.pos', 'pv1.neg')],
    );
    expect(found?.severity).toBe('warning');
  });

  it('L dan N jaringan atau keluaran inverter disatukan: bahaya', () => {
    const components = [place('grid1', 'grid'), place('inv1', 'inverter-offgrid')];
    const wires = [wire('grid1.l', 'grid1.n'), wire('inv1.ac-l', 'inv1.ac-n')];
    const found = findingsOf('short-circuit', components, wires);
    expect(found.map((f) => [f.severity, f.componentIds])).toEqual([
      ['danger', ['grid1']],
      ['danger', ['inv1']],
    ]);
  });

  it('PV dan baterai tidak saling dianggap hubung singkat', () => {
    const wires = [...OFFGRID_PV_WIRES, ...pair('bat1', 'scc1', 'pv')];
    expect(findingsOf('short-circuit', OFFGRID_COMPONENTS, wires)).toEqual([]);
  });
});
