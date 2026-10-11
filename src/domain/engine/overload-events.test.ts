import { describe, expect, it } from 'vitest';
import { OFFGRID_COMPONENTS, OFFGRID_WIRES } from '../circuit/validate-fixtures';
import { inverterOverloadTimeS } from '../components/inverter';
import { pwmLoadOverloadTimeS } from '../components/scc';
import {
  INVERTER_500W,
  INVERTER_500W_PROTECTION,
  PWM_RBL_20A,
  PWM_RBL_20A_PROTECTION,
} from '../components/test-fixtures-bos';
import { advanceDevices } from './advance-state';
import {
  CHARGE_COMPONENTS,
  chargeWires,
  INVERTER_COMPONENTS,
  inverterWires,
  NIGHT,
} from './engine-fixtures';
import { overloadLoads, stepOverloads } from './overload-events';
import { frameOf, OVERLOAD_INVERTER_COMPONENTS, OVERLOAD_SCC_COMPONENTS } from './step-fixtures';

describe('overloadLoads', () => {
  it('inverter 500 W dengan beban 500 W: rasio 1, tidak menuju mati', () => {
    const { frame } = frameOf(INVERTER_COMPONENTS, inverterWires());
    const [load] = overloadLoads(frame);
    expect(load).toMatchObject({ id: 'inv1', kind: 'inverter', tripTimeS: Infinity });
    expect(load?.ratio).toBeCloseTo(1, 2);
  });

  it('inverter 500 W dengan beban 600 W: waktu mati dari kurva katalog', () => {
    const { frame } = frameOf(OVERLOAD_INVERTER_COMPONENTS, inverterWires());
    const [load] = overloadLoads(frame);
    const acPowerW = frame.point.inverters.inv1?.acPowerW ?? 0;
    expect(acPowerW).toBeGreaterThan(590);
    expect(load?.ratio).toBeCloseTo(acPowerW / 500, 9);
    expect(load?.tripTimeS).toBe(
      inverterOverloadTimeS(INVERTER_500W, INVERTER_500W_PROTECTION, acPowerW),
    );
    expect(load?.tripTimeS).toBeGreaterThan(60);
    expect(load?.tripTimeS).toBeLessThan(600);
    expect(load?.params).toEqual({ acPowerW });
  });

  it('inverter yang mati tidak dihitung', () => {
    const { frame } = frameOf(OVERLOAD_INVERTER_COMPONENTS, inverterWires(), {
      state: { inverterById: { inv1: { on: false, lowVoltageS: 0, offReason: 'overload' } } },
    });
    expect(overloadLoads(frame)).toEqual([]);
  });

  it('terminal beban SCC 10 A: beban 100 W aman, beban 160 W menuju putus', () => {
    const safe = frameOf(OFFGRID_COMPONENTS, OFFGRID_WIRES, {
      controls: { powerSettingWByLoadId: { load1: 100 } },
    });
    expect(overloadLoads(safe.frame)).toMatchObject([
      { id: 'scc1', kind: 'scc-load', tripTimeS: Infinity },
    ]);
    const { frame } = frameOf(OVERLOAD_SCC_COMPONENTS, OFFGRID_WIRES);
    const [load] = overloadLoads(frame);
    const currentA = frame.point.sccs.scc1?.loadCurrentA ?? 0;
    expect(currentA).toBeGreaterThan(12.5);
    expect(load?.ratio).toBeCloseTo(currentA / 10, 9);
    expect(load?.tripTimeS).toBe(
      pwmLoadOverloadTimeS(PWM_RBL_20A, PWM_RBL_20A_PROTECTION, currentA),
    );
    expect(load?.tripTimeS).toBeGreaterThan(5);
    expect(load?.tripTimeS).toBeLessThan(60);
  });
});

describe('stepOverloads', () => {
  const inverter = frameOf(OVERLOAD_INVERTER_COMPONENTS, inverterWires());
  const inverterLoads = overloadLoads(inverter.frame);
  const tripTimeS = inverterLoads[0]?.tripTimeS ?? 0;

  it('dosis bertambah dt/t; belum mati sebelum dosis 1', () => {
    const outcome = stepOverloads(inverterLoads, inverter.state, tripTimeS / 4);
    expect(outcome.state.overloadDoseById.inv1).toBeCloseTo(0.25, 9);
    expect(outcome.state.inverterById).toEqual({});
    expect(outcome).toMatchObject({ events: [], transition: false, instant: false });
  });

  it('dosis ≥ 1: inverter mati terkunci dengan kejadian `inverter-overload`', () => {
    const state = { ...inverter.state, timeS: 50, overloadDoseById: { inv1: 0.99 } };
    const outcome = stepOverloads(inverterLoads, state, tripTimeS / 50);
    expect(outcome.state.inverterById.inv1).toEqual({
      on: false,
      lowVoltageS: 0,
      offReason: 'overload',
    });
    expect(outcome.events).toEqual([
      {
        kind: 'inverter-overload',
        timeS: 50 + tripTimeS / 50,
        componentId: 'inv1',
        params: inverterLoads[0]?.params,
      },
    ]);
    expect(outcome.transition).toBe(true);
  });

  it('inverter yang sudah mati pada sub-langkah yang sama tidak dimatikan dua kali', () => {
    const state = {
      ...inverter.state,
      overloadDoseById: { inv1: 0.99 },
      inverterById: { inv1: { on: false, lowVoltageS: 0, offReason: 'lvd' as const } },
    };
    const outcome = stepOverloads(inverterLoads, state, tripTimeS);
    expect(outcome.state.inverterById.inv1?.offReason).toBe('lvd');
    expect(outcome.events).toEqual([]);
  });

  it('terminal beban SCC putus terkunci dengan kejadian `scc-load-overload`', () => {
    const { frame, state } = frameOf(OVERLOAD_SCC_COMPONENTS, OFFGRID_WIRES);
    const loads = overloadLoads(frame);
    const outcome = stepOverloads(loads, state, loads[0]?.tripTimeS ?? 0);
    expect(outcome.state.sccById.scc1).toMatchObject({
      loadConnected: false,
      loadOverloaded: true,
    });
    expect(outcome.events).toMatchObject([{ kind: 'scc-load-overload', componentId: 'scc1' }]);
    expect(outcome.events[0]?.params?.currentA).toBeGreaterThan(12.5);
    const again = stepOverloads(loads, outcome.state, 1);
    expect(again.events).toEqual([]);
  });

  it('tanpa beban lebih dosis mendingin; keadaan masukan tidak diubah', () => {
    const state = { ...inverter.state, overloadDoseById: { inv1: 0.5 } };
    const before = JSON.stringify(state);
    const outcome = stepOverloads([], state, 60);
    expect(outcome.state.overloadDoseById.inv1).toBeLessThan(0.5);
    expect(outcome.state.overloadDoseById.inv1).toBeGreaterThan(0);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('advanceDevices: kunci beban lebih', () => {
  it('mati karena beban lebih terkunci walau tegangan ≥ Vlvr', () => {
    const off = { inv1: { on: false, lowVoltageS: 0, offReason: 'overload' as const } };
    const { frame, state } = frameOf(INVERTER_COMPONENTS, inverterWires(), {
      state: { inverterById: off },
    });
    expect(frame.point.inverters.inv1?.dcVoltageV).toBeGreaterThan(12.5);
    const outcome = advanceDevices(frame, state, 60);
    expect(outcome.state.inverterById).toEqual(off);
    expect(outcome).toMatchObject({ events: [], transition: false });
  });

  it('terminal beban SCC yang putus karena arus lebih terkunci walau tegangan ≥ Vlvr', () => {
    const scc1 = {
      stage: 'bulk' as const,
      absorptionElapsedS: 0,
      loadConnected: false,
      loadOverloaded: true,
    };
    const { frame, state } = frameOf(CHARGE_COMPONENTS, chargeWires(), {
      environment: NIGHT,
      state: { sccById: { scc1 } },
    });
    expect(frame.point.sccs.scc1?.batteryVoltageV).toBeGreaterThan(12.6);
    expect(advanceDevices(frame, state, 60).state.sccById.scc1).toMatchObject({
      loadConnected: false,
      loadOverloaded: true,
    });
  });
});
