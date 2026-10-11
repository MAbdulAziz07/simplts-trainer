import { describe, expect, it } from 'vitest';
import { OFFGRID_COMPONENTS, OFFGRID_WIRES, place } from '../circuit/validate-fixtures';
import {
  CHARGE_COMPONENTS,
  chargeWires,
  INVERTER_COMPONENTS,
  inverterWires,
  NOON,
} from './engine-fixtures';
import { BREAKER_COMPONENTS, BREAKER_WIRES, frameOf } from './step-fixtures';
import type { CircuitPotentials } from './step-types';

const HALF = { socPctByBatteryId: { bat1: 50 } };

/** Beda potensial `a − b`. */
function between(potentials: CircuitPotentials, a: string, b: string): number {
  return (potentials.terminals[a]?.voltageV ?? 0) - (potentials.terminals[b]?.voltageV ?? 0);
}

describe('readPotentials: baterai → inverter → beban AC (contoh §4.7)', () => {
  const { frame } = frameOf(INVERTER_COMPONENTS, inverterWires(), { state: HALF });
  const { potentials, point } = frame;
  const { terminals, nets } = potentials;
  const dcCurrentA = point.inverters.inv1?.dcCurrentA ?? 0;

  it('kutub negatif baterai dan netral inverter menjadi acuan 0 V', () => {
    expect(terminals['bat1.neg']).toMatchObject({ voltageV: 0, floating: false });
    expect(terminals['inv1.ac-n']).toMatchObject({ voltageV: 0, floating: false });
    expect(terminals['inv1.ac-l']?.voltageV).toBe(220);
  });

  it('beda potensial dua terminal alat = bacaan tegangannya', () => {
    expect(between(potentials, 'inv1.dc-pos', 'inv1.dc-neg')).toBeCloseTo(
      point.inverters.inv1?.dcVoltageV ?? 0,
      9,
    );
    expect(between(potentials, 'lamp1.a', 'lamp1.b')).toBeCloseTo(
      point.loads.lamp1?.voltageV ?? 0,
      9,
    );
    expect(terminals['bat1.pos']?.voltageV).toBeCloseTo(point.batteries.bat1?.voltageV ?? 0, 9);
  });

  it('beda potensial sepanjang kabel = jatuh tegangannya', () => {
    const dropV = between(potentials, 'bat1.pos', 'inv1.dc-pos');
    expect(dropV).toBeCloseTo(point.voltageDropVByWireId['bat1.pos>inv1.dc-pos'] ?? 0, 9);
    expect(dropV).toBeGreaterThan(0);
    expect(terminals['inv1.dc-neg']?.voltageV).toBeGreaterThan(0);
  });

  it('arus terminal: positif keluar dari sumber, negatif masuk ke pemakai', () => {
    expect(dcCurrentA).toBeGreaterThan(40);
    expect(terminals['bat1.pos']?.currentA).toBeCloseTo(dcCurrentA, 9);
    expect(terminals['bat1.neg']?.currentA).toBeCloseTo(-dcCurrentA, 9);
    expect(terminals['inv1.dc-pos']?.currentA).toBeCloseTo(-dcCurrentA, 9);
    const inputV = terminals['inv1.dc-pos']?.voltageV ?? 0;
    expect(terminals['inv1.dc-pos']?.powerW).toBeCloseTo(-dcCurrentA * inputV, 9);
  });

  it('terminal tanpa kabel mengambang dengan 0 V dan 0 A', () => {
    expect(terminals['inv1.pe']).toEqual({ voltageV: 0, currentA: 0, powerW: 0, floating: true });
  });

  it('net: tegangan rata-rata terminal, arus kabel terbesar, P = V·I', () => {
    const net = nets[frame.topology.netlist.netIdByTerminal.bat1?.pos ?? ''];
    const batV = terminals['bat1.pos']?.voltageV ?? 0;
    const meanV = (batV + (terminals['inv1.dc-pos']?.voltageV ?? 0)) / 2;
    expect(net?.voltageV).toBeCloseTo(meanV, 9);
    expect(net?.currentA).toBeCloseTo(dcCurrentA, 9);
    expect(net?.powerW).toBeCloseTo(meanV * dcCurrentA, 9);
    expect(Object.keys(nets)).toHaveLength(frame.topology.netlist.nets.length);
  });
});

describe('readPotentials: MCB, SCC, dan PV', () => {
  it('terminal MCB ON: potensial sama di kedua sisi, arus masuk = arus keluar', () => {
    const { terminals } = frameOf(BREAKER_COMPONENTS, BREAKER_WIRES).frame.potentials;
    expect(terminals['mcb1.pos-in']?.voltageV).toBe(terminals['mcb1.pos-out']?.voltageV);
    const outA = terminals['mcb1.pos-out']?.currentA ?? 0;
    expect(terminals['mcb1.pos-in']?.currentA).toBeCloseTo(-outA, 9);
    expect(outA).toBeGreaterThan(40);
  });

  it('MCB OFF: sisi baterai bertegangan, sisi inverter 0 V', () => {
    const { terminals } = frameOf(BREAKER_COMPONENTS, BREAKER_WIRES, {
      state: { closedSwitchIds: [] },
    }).frame.potentials;
    expect(terminals['mcb1.pos-in']?.voltageV).toBeGreaterThan(12);
    expect(terminals['mcb1.pos-out']?.voltageV).toBe(0);
    expect(terminals['inv1.dc-pos']?.voltageV).toBe(0);
  });

  it('SCC mengisi: tegangan terminal PV = bacaan SCC, PV− = BAT−', () => {
    const { frame } = frameOf(CHARGE_COMPONENTS, chargeWires(), { environment: NOON, state: HALF });
    const scc = frame.point.sccs.scc1;
    expect(scc?.status).toBe('charging');
    expect(between(frame.potentials, 'scc1.pv-neg', 'scc1.bat-neg')).toBe(0);
    const pvV = between(frame.potentials, 'scc1.pv-pos', 'scc1.pv-neg');
    expect(pvV).toBeCloseTo(scc?.pvVoltageV ?? 0, 9);
    expect(between(frame.potentials, 'pv1.pos', 'pv1.neg')).toBeGreaterThan(pvV);
  });

  it('terminal beban SCC: tersambung = tegangan baterai; diputus = beban 0 V', () => {
    const on = frameOf(OFFGRID_COMPONENTS, OFFGRID_WIRES, { environment: NOON }).frame;
    expect(between(on.potentials, 'scc1.load-pos', 'scc1.load-neg')).toBeCloseTo(
      on.point.sccs.scc1?.batteryVoltageV ?? 0,
      9,
    );
    expect(between(on.potentials, 'load1.a', 'load1.b')).toBeGreaterThan(10);
    const off = frameOf(OFFGRID_COMPONENTS, OFFGRID_WIRES, {
      environment: NOON,
      state: { sccById: { scc1: { stage: 'bulk', absorptionElapsedS: 0, loadConnected: false } } },
    }).frame;
    expect(between(off.potentials, 'load1.a', 'load1.b')).toBe(0);
  });

  it('modul PV lepas: kutub negatif 0 V, kutub positif di Voc', () => {
    const { frame } = frameOf([place('pv1', 'pv-module')], [], { environment: NOON });
    const { terminals } = frame.potentials;
    expect(terminals['pv1.neg']).toMatchObject({ voltageV: 0, floating: false });
    expect(terminals['pv1.pos']?.voltageV).toBeCloseTo(frame.point.pvModules.pv1?.voltageV ?? 0, 9);
    expect(terminals['pv1.pos']?.voltageV).toBeGreaterThan(15);
  });
});
