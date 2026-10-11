// Alur trip/putus → reset → jalan lagi lewat `stepSimulation` dan fungsi reset.
import { describe, expect, it } from 'vitest';
import { OFFGRID_WIRES, place } from '../circuit/validate-fixtures';
import { within } from '../components/test-fixtures';
import { inverterWires } from './engine-fixtures';
import { overloadLoads } from './overload-events';
import {
  replaceFuse,
  replaceWire,
  resetBms,
  resetBreaker,
  resetInverter,
  resetSccLoad,
} from './reset';
import {
  BREAKER_COMPONENTS,
  BREAKER_WIRES,
  bmsBattery,
  directLoadWires,
  frameOf,
  fuse,
  OVERLOAD_INVERTER_COMPONENTS,
  OVERLOAD_SCC_COMPONENTS,
  runUntil,
  stepInput,
} from './step-fixtures';
import { stepSimulation } from './stepper';

describe('beban lebih inverter', () => {
  const input = stepInput(OVERLOAD_INVERTER_COMPONENTS, inverterWires(), { dtS: 1 });
  const tripTimeS = overloadLoads(frameOf(OVERLOAD_INVERTER_COMPONENTS, inverterWires()).frame)[0]
    ?.tripTimeS;
  const run = runUntil(input, 600, (result) => result.snapshot.events.length > 0);

  it('beban 600 W pada inverter 500 W: mati pada waktu kurva, status `overload`', () => {
    expect(run.events).toMatchObject([{ kind: 'inverter-overload', componentId: 'inv1' }]);
    expect(within(run.events[0]?.timeS ?? 0, tripTimeS ?? 0, 0.05)).toBe(true);
    expect(run.last.snapshot.components.inv1).toEqual({ condition: 'overload' });
    expect(run.last.snapshot.operatingPoint.loads.lamp1?.powerW).toBe(0);
  });

  it('percepatan 600× tidak menggeser waktu mati', () => {
    const fast = stepSimulation({ ...input, dtS: 1, speed: 600 });
    expect(fast.snapshot.events).toHaveLength(1);
    expect(fast.snapshot.events[0]?.timeS).toBeCloseTo(run.events[0]?.timeS ?? 0, 6);
  });

  it('tetap mati walau tegangan baterai pulih; hidup lagi setelah reset dengan beban dikurangi', () => {
    const later = runUntil({ ...input, state: run.state, dtS: 10 }, run.state.timeS + 120);
    expect(later.events).toEqual([]);
    expect(later.last.snapshot.components.inv1?.condition).toBe('overload');
    const reset = runUntil(
      {
        ...input,
        state: resetInverter(later.state, 'inv1'),
        controls: { powerSettingWByLoadId: { lamp1: 300 } },
        dtS: 10,
      },
      later.state.timeS + 600,
    );
    expect(reset.events).toEqual([]);
    expect(reset.last.snapshot.components.inv1).toEqual({ condition: 'ok' });
    expect(reset.last.snapshot.operatingPoint.loads.lamp1?.powerW).toBeGreaterThan(290);
  });
});

describe('beban lebih terminal beban SCC', () => {
  const input = stepInput(OVERLOAD_SCC_COMPONENTS, OFFGRID_WIRES, { dtS: 1 });
  const run = runUntil(input, 120, (result) => result.snapshot.events.length > 0);

  it('beban sekitar 13,5 A pada terminal 10 A: putus pada waktu kurva', () => {
    const tripTimeS = overloadLoads(frameOf(OVERLOAD_SCC_COMPONENTS, OFFGRID_WIRES).frame)[0]
      ?.tripTimeS;
    expect(run.events).toMatchObject([{ kind: 'scc-load-overload', componentId: 'scc1' }]);
    expect(within(run.events[0]?.timeS ?? 0, tripTimeS ?? 0, 0.1)).toBe(true);
    expect(run.last.snapshot.components.scc1).toMatchObject({
      condition: 'overload',
      loadConnected: false,
    });
    expect(run.last.snapshot.operatingPoint.loads.load1?.powerW).toBe(0);
  });

  it('tetap putus sampai direset; setelah reset dengan beban 80 W tersambung terus', () => {
    const later = runUntil({ ...input, state: run.state, dtS: 10 }, run.state.timeS + 300);
    expect(later.events).toEqual([]);
    expect(later.last.snapshot.components.scc1?.loadConnected).toBe(false);
    const reset = runUntil(
      {
        ...input,
        state: resetSccLoad(later.state, 'scc1'),
        controls: { powerSettingWByLoadId: { load1: 80 } },
        dtS: 10,
      },
      later.state.timeS + 300,
    );
    expect(reset.events).toEqual([]);
    expect(reset.last.snapshot.components.scc1).toMatchObject({
      condition: 'ok',
      loadConnected: true,
    });
    expect(reset.last.snapshot.operatingPoint.loads.load1?.powerW).toBeGreaterThan(70);
  });
});

describe('reset proteksi lain', () => {
  it('MCB trip → di-ON-kan lagi: rangkaian hidup, lalu trip lebih cepat karena masih panas', () => {
    const input = stepInput(BREAKER_COMPONENTS, BREAKER_WIRES, { dtS: 1 });
    const first = runUntil(input, 400, (result) => result.snapshot.events.length > 0);
    const firstTripS = first.events[0]?.timeS ?? 0;
    const state = resetBreaker(first.state, 'mcb1');
    const live = stepSimulation({ ...input, state, dtS: 0 });
    expect(live.snapshot.components.mcb1?.condition).toBe('ok');
    expect(live.snapshot.operatingPoint.loads.lamp1?.powerW).toBeGreaterThan(400);
    const second = runUntil(
      { ...input, state },
      state.timeS + 400,
      (result) => result.snapshot.events.length > 0,
    );
    expect(second.events).toMatchObject([{ kind: 'mcb-trip', componentId: 'mcb1' }]);
    expect((second.events[0]?.timeS ?? 0) - state.timeS).toBeLessThan(firstTripS / 4);
  });

  it('fuse putus → diganti: beban menyala lagi dan fuse baru putus pada waktu yang sama', () => {
    const components = [place('bat1', 'battery'), fuse('f1', 5), place('load1', 'load-dc')];
    const input = stepInput(components, directLoadWires('f1'), { dtS: 1 });
    const first = runUntil(input, 120, (result) => result.snapshot.events.length > 0);
    const state = replaceFuse(first.state, 'f1');
    const second = runUntil(
      { ...input, state },
      state.timeS + 120,
      (result) => result.snapshot.events.length > 0,
    );
    expect(second.events).toMatchObject([{ kind: 'fuse-blown', componentId: 'f1' }]);
    const firstS = first.events[0]?.timeS ?? 0;
    expect(within((second.events[0]?.timeS ?? 0) - state.timeS, firstS, 0.05)).toBe(true);
  });

  it('BMS memutus → direset: memutus lagi setelah tunda karena beban masih sama', () => {
    const components = [bmsBattery('bat1'), place('load1', 'load-dc')];
    const input = stepInput(components, directLoadWires(), { dtS: 1 });
    const first = runUntil(input, 60, (result) => result.snapshot.events.length > 0);
    const state = resetBms(first.state, 'bat1');
    const second = runUntil(
      { ...input, state },
      state.timeS + 60,
      (result) => result.snapshot.events.length > 0,
    );
    expect(second.events).toMatchObject([{ kind: 'bms-cutoff', cause: 'over-current' }]);
    expect((second.events[0]?.timeS ?? 0) - state.timeS).toBeCloseTo(10, 6);
  });

  it('kabel rusak → diganti: arus mengalir lagi', () => {
    const components = [place('bat1', 'battery'), place('load1', 'load-dc')];
    const wires = directLoadWires();
    const input = stepInput(components, wires, {
      dtS: 0,
      state: { damagedWireIds: wires.map((source) => source.id) },
    });
    expect(stepSimulation(input).snapshot.operatingPoint.loads.load1?.powerW).toBe(0);
    const state = wires.reduce((current, source) => replaceWire(current, source.id), input.state);
    const { snapshot } = stepSimulation({ ...input, state });
    expect(snapshot.operatingPoint.loads.load1?.powerW).toBeGreaterThan(150);
    expect(Object.values(snapshot.wires).every((status) => status.condition === 'ok')).toBe(true);
  });
});
