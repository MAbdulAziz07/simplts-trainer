import { describe, expect, it } from 'vitest';
import { place } from '../circuit/validate-fixtures';
import { mcbTripTimeS } from '../components/protection';
import { BATTERY_LFP_24V_100AH } from '../components/test-fixtures';
import { MCB_AC_10A, MCB_DC_20A } from '../components/test-fixtures-bos';
import { stepSwitches, switchLoads } from './protection-events';
import {
  BREAKER_COMPONENTS,
  BREAKER_WIRES,
  directLoadWires,
  frameOf,
  fuse,
  METER_COMPONENTS,
  meterWires,
} from './step-fixtures';

const FUSED = [place('bat1', 'battery'), fuse('f1', 5), place('load1', 'load-dc')];
/** MCB AC 10 A dipasang di sirkuit DC 25,6 V dengan arus sekitar 36 A (> 3·In). */
const AC_MCB_ON_DC = [
  place('bat1', 'battery', BATTERY_LFP_24V_100AH),
  place('mcb1', 'mcb-ac', MCB_AC_10A, [
    ['pos-in', 'acL'],
    ['pos-out', 'acL'],
  ]),
  place('load1', 'load-dc'),
];
const TINY_MCB = [
  place('bat1', 'battery'),
  place('mcb1', 'mcb-dc', { ...MCB_DC_20A, ratedCurrentA: 1 }),
  place('load1', 'load-dc'),
];

describe('switchLoads', () => {
  it('MCB DC 20 A dengan sekitar 46 A: In dikoreksi suhu, waktu trip dari kurva termal', () => {
    const { frame } = frameOf(BREAKER_COMPONENTS, BREAKER_WIRES);
    const [load, ...rest] = switchLoads(frame);
    expect(rest).toEqual([]);
    // Ta 20 °C, Tref 55 °C: In efektif 20·(1 + 0,005·35) = 23,5 A.
    expect(load).toMatchObject({ id: 'mcb1', isDc: true });
    expect(load?.ratio).toBeCloseTo((load?.currentA ?? 0) / 23.5, 9);
    expect(load?.tripTimeS).toBeCloseTo(mcbTripTimeS(load?.currentA ?? 0, 23.5, 'C', true), 9);
    expect(load?.tripTimeS).toBeGreaterThan(20);
    expect(load?.tripTimeS).toBeLessThan(1800);
  });

  it('fuse 5 A dengan sekitar 17 A: waktu lebur beberapa detik', () => {
    const [load] = switchLoads(frameOf(FUSED, directLoadWires('f1')).frame);
    expect(load?.ratio).toBeCloseTo((load?.currentA ?? 0) / 5, 9);
    expect(load?.tripTimeS).toBeGreaterThan(1);
    expect(load?.tripTimeS).toBeLessThan(10);
  });

  it('MCB yang OFF tidak punya beban', () => {
    const { frame } = frameOf(BREAKER_COMPONENTS, BREAKER_WIRES, {
      state: { closedSwitchIds: [] },
    });
    expect(switchLoads(frame)).toEqual([]);
  });

  it('MCB AC di sirkuit DC dihitung sebagai DC; di sirkuit AC tidak', () => {
    const [onDc] = switchLoads(frameOf(AC_MCB_ON_DC, directLoadWires('mcb1')).frame);
    expect(onDc?.isDc).toBe(true);
    const acComponents = [
      ...METER_COMPONENTS.slice(0, 1),
      place('mcb1', 'mcb-ac'),
      place('lamp1', 'load-ac'),
    ];
    const acWires = meterWires().map((source) => ({
      ...source,
      from: { ...source.from, componentId: source.from.componentId.replace('m1', 'mcb1') },
      to: { ...source.to, componentId: source.to.componentId.replace('m1', 'mcb1') },
    }));
    const [onAc] = switchLoads(frameOf(acComponents, acWires).frame);
    expect(onAc).toMatchObject({ id: 'mcb1', isDc: false });
    expect(onAc?.tripTimeS).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('stepSwitches', () => {
  it('dosis termal bertambah dt/t_trip; belum trip di bawah 1', () => {
    const { frame, state } = frameOf(BREAKER_COMPONENTS, BREAKER_WIRES);
    const loads = switchLoads(frame);
    const tripTimeS = loads[0]?.tripTimeS ?? 0;
    const outcome = stepSwitches(frame, loads, state, tripTimeS / 4);
    expect(outcome.state.thermalDoseBySwitchId.mcb1).toBeCloseTo(0.25, 9);
    expect(outcome).toMatchObject({ events: [], transition: false, instant: false });
    expect(outcome.state.closedSwitchIds).toEqual(['mcb1']);
  });

  it('dosis mencapai 1: MCB trip termal, OFF, dan tercatat sebagai trip', () => {
    const { frame, state } = frameOf(BREAKER_COMPONENTS, BREAKER_WIRES, {
      state: { timeS: 40, thermalDoseBySwitchId: { mcb1: 0.99 } },
    });
    const loads = switchLoads(frame);
    const outcome = stepSwitches(frame, loads, state, 5);
    expect(outcome.state.closedSwitchIds).toEqual([]);
    expect(outcome.state.trippedSwitchIds).toEqual(['mcb1']);
    expect(outcome.state.damagedComponentIds).toEqual([]);
    expect(outcome.events).toEqual([
      {
        kind: 'mcb-trip',
        timeS: 45,
        componentId: 'mcb1',
        cause: 'thermal',
        params: { currentA: loads[0]?.currentA },
      },
    ]);
    expect(outcome).toMatchObject({ transition: true, instant: false });
  });

  it('arus di daerah magnetik: trip seketika tanpa menunggu dosis', () => {
    const { frame, state } = frameOf(TINY_MCB, directLoadWires('mcb1'));
    const loads = switchLoads(frame);
    expect(loads[0]?.tripTimeS).toBe(0.02);
    const outcome = stepSwitches(frame, loads, state, 0.01);
    expect(outcome.events).toMatchObject([{ kind: 'mcb-trip', cause: 'magnetic', timeS: 0.01 }]);
    expect(outcome).toMatchObject({ transition: true, instant: true });
  });

  it('fuse putus: tidak tercatat sebagai trip MCB dan masuk daftar fuse putus', () => {
    const { frame, state } = frameOf(FUSED, directLoadWires('f1'), {
      state: { thermalDoseBySwitchId: { f1: 0.95 } },
    });
    const outcome = stepSwitches(frame, switchLoads(frame), state, 1);
    expect(outcome.events).toMatchObject([{ kind: 'fuse-blown', componentId: 'f1' }]);
    expect(outcome.state.blownFuseIds).toEqual(['f1']);
    expect(outcome.state.trippedSwitchIds).toEqual([]);
    expect(outcome.state.closedSwitchIds).toEqual([]);
  });

  it('MCB AC tanpa rating DC memutus > 3·In di DC: trip lalu rusak', () => {
    const { frame, state } = frameOf(AC_MCB_ON_DC, directLoadWires('mcb1'), {
      state: { thermalDoseBySwitchId: { mcb1: 0.99 } },
    });
    const loads = switchLoads(frame);
    expect(loads[0]?.currentA).toBeGreaterThan(30);
    const outcome = stepSwitches(frame, loads, state, 1);
    expect(outcome.events.map((event) => [event.kind, event.cause])).toEqual([
      ['mcb-trip', 'thermal'],
      ['component-damaged', 'cannot-interrupt'],
    ]);
    expect(outcome.state.damagedComponentIds).toEqual(['mcb1']);
  });

  it('MCB OFF mendingin dengan τ = 300 s', () => {
    const { frame, state } = frameOf(BREAKER_COMPONENTS, BREAKER_WIRES, {
      state: { closedSwitchIds: [], thermalDoseBySwitchId: { mcb1: 0.8 } },
    });
    const outcome = stepSwitches(frame, switchLoads(frame), state, 300);
    expect(outcome.state.thermalDoseBySwitchId.mcb1).toBeCloseTo(0.8 * Math.exp(-1), 9);
    expect(outcome.transition).toBe(false);
  });
});
