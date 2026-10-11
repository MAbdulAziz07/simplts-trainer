import { describe, expect, it } from 'vitest';
import { place } from '../circuit/validate-fixtures';
import { BATTERY_LFP_24V_100AH, within } from '../components/test-fixtures';
import { MCB_DC_20A } from '../components/test-fixtures-bos';
import {
  CHARGE_COMPONENTS,
  chargeWires,
  INVERTER_COMPONENTS,
  inverterWires,
  NOON,
} from './engine-fixtures';
import { switchLoads } from './protection-events';
import {
  BREAKER_COMPONENTS,
  BREAKER_WIRES,
  bmsBattery,
  directLoadWires,
  frameOf,
  fuse,
  runUntil,
  stepInput,
} from './step-fixtures';
import { advanceSubstep, stepSimulation } from './stepper';

const HOUR_S = 3600;

describe('advanceSubstep', () => {
  it('memajukan waktu dan menggabungkan semua bagian pembaruan', () => {
    const { frame, state } = frameOf(BREAKER_COMPONENTS, BREAKER_WIRES);
    const outcome = advanceSubstep(frame, switchLoads(frame), state, 10);
    expect(outcome.state.timeS).toBe(10);
    expect(outcome.state.socPctByBatteryId.bat1).toBeLessThan(100);
    expect(outcome.state.thermalDoseBySwitchId.mcb1).toBeGreaterThan(0);
    expect(outcome.state.energy.loadWh).toBeGreaterThan(1);
    expect(outcome.state.inverterById.inv1).toEqual({ on: true, lowVoltageS: 0 });
    expect(outcome).toMatchObject({ events: [], transition: false, instant: false });
    expect(state.timeS).toBe(0);
  });

  it('kejadian dari bagian mana pun ikut terkumpul', () => {
    const { frame, state } = frameOf(BREAKER_COMPONENTS, BREAKER_WIRES, {
      state: { thermalDoseBySwitchId: { mcb1: 0.999 } },
    });
    const outcome = advanceSubstep(frame, switchLoads(frame), state, 1);
    expect(outcome.events).toMatchObject([{ kind: 'mcb-trip', timeS: 1 }]);
    expect(outcome.transition).toBe(true);
  });
});

describe('stepSimulation: waktu dan kecepatan', () => {
  it('dtS 0 hanya menghasilkan snapshot keadaan saat ini', () => {
    const input = stepInput(INVERTER_COMPONENTS, inverterWires(), { dtS: 0 });
    const result = stepSimulation(input);
    expect(result.state).toBe(input.state);
    expect(result.simulatedS).toBe(0);
    expect(result.snapshot).toMatchObject({ timeS: 0, events: [] });
    expect(result.snapshot.operatingPoint.inverters.inv1?.status).toBe('on');
  });

  it('waktu simulasi = dtS × kecepatan; keadaan masukan tidak diubah', () => {
    const input = stepInput(INVERTER_COMPONENTS, inverterWires(), { dtS: 0.5, speed: 600 });
    const before = JSON.stringify(input.state);
    const result = stepSimulation(input);
    expect(result.simulatedS).toBeCloseTo(300, 9);
    expect(result.state.timeS).toBeCloseTo(300, 9);
    expect(result.snapshot.timeS).toBe(result.state.timeS);
    expect(JSON.stringify(input.state)).toBe(before);
  });

  it('satu panggilan panjang ≈ banyak panggilan pendek', () => {
    const long = stepSimulation(
      stepInput(INVERTER_COMPONENTS, inverterWires(), { dtS: 1, speed: 600 }),
    );
    const short = runUntil(stepInput(INVERTER_COMPONENTS, inverterWires(), { dtS: 1 }), 600);
    expect(short.state.timeS).toBeCloseTo(600, 9);
    const socDropPct = 100 - (short.state.socPctByBatteryId.bat1 ?? 0);
    expect(socDropPct).toBeGreaterThan(5);
    expect(within(100 - (long.state.socPctByBatteryId.bat1 ?? 0), socDropPct, 0.01)).toBe(true);
    expect(within(long.state.energy.loadWh, short.state.energy.loadWh, 0.001)).toBe(true);
  });

  it('batas sub-langkah tercapai: berhenti lebih awal dan melaporkan waktu yang ditempuh', () => {
    const input = stepInput(INVERTER_COMPONENTS, inverterWires(), {
      dtS: 1,
      speed: 600,
      maxSubsteps: 3,
    });
    const result = stepSimulation(input);
    expect(result.simulatedS).toBeCloseTo(180, 9);
    expect(result.state.timeS).toBeCloseTo(180, 9);
  });
});

describe('stepSimulation: SoC, energi, dan LVD', () => {
  const run = runUntil(
    stepInput(INVERTER_COMPONENTS, inverterWires(), { dtS: 60, speed: 60 }),
    3 * HOUR_S,
    (result) => result.snapshot.events.length > 0,
  );

  it('contoh §4.7: beban 500 W menguras VRLA 100 Ah sampai LVD dalam sekitar 1,2–1,3 jam', () => {
    expect(run.events).toMatchObject([{ kind: 'inverter-lvd', componentId: 'inv1' }]);
    const hours = (run.events[0]?.timeS ?? 0) / HOUR_S;
    // 1,33 jam sampai kosong (±10%); LVD memutus sebelum SoC 0%.
    expect(hours).toBeGreaterThan(1.33 * 0.9);
    expect(hours).toBeLessThan(1.33);
  });

  it('LVD tercapai sebelum SoC 0% (US9)', () => {
    const socPct = run.state.socPctByBatteryId.bat1 ?? 0;
    expect(socPct).toBeGreaterThan(2);
    expect(socPct).toBeLessThan(12);
    expect(run.events[0]?.params?.voltageV).toBeLessThan(10.5);
  });

  it('setelah LVD: inverter mati, beban padam, status `lvd`', () => {
    const { snapshot } = run.last;
    expect(snapshot.components.inv1).toEqual({ condition: 'lvd' });
    expect(snapshot.operatingPoint.loads.lamp1?.powerW).toBe(0);
    expect(snapshot.terminals['inv1.ac-l']?.voltageV).toBe(0);
  });

  it('neraca energi kumulatif tertutup dalam 0,5% (§12 butir 5)', () => {
    const { energy } = run.state;
    expect(energy.loadWh).toBeGreaterThan(550);
    const residualWh = energy.batteryDischargeWh - energy.loadWh - energy.lossWh;
    expect(Math.abs(residualWh) / energy.batteryDischargeWh).toBeLessThan(0.005);
  });

  it('mengisi dari PV: SoC naik dan energi PV = energi baterai + rugi', () => {
    const charge = runUntil(
      stepInput(CHARGE_COMPONENTS, chargeWires(), {
        environment: NOON,
        dtS: 60,
        speed: 60,
        state: { socPctByBatteryId: { bat1: 60 } },
      }),
      4 * HOUR_S,
    );
    expect(charge.state.socPctByBatteryId.bat1).toBeGreaterThan(70);
    const { pvWh, batteryChargeWh, lossWh } = charge.state.energy;
    expect(Math.abs(pvWh - batteryChargeWh - lossWh) / pvWh).toBeLessThan(0.005);
    expect(charge.last.snapshot.components.scc1).toMatchObject({ chargeStage: 'bulk' });
  });
});

describe('stepSimulation: proteksi', () => {
  const tripTimeS =
    switchLoads(frameOf(BREAKER_COMPONENTS, BREAKER_WIRES).frame)[0]?.tripTimeS ?? 0;

  it('MCB 20 A dengan sekitar 46 A trip pada waktu kurva, lalu rangkaian mati', () => {
    const run = runUntil(stepInput(BREAKER_COMPONENTS, BREAKER_WIRES, { dtS: 1 }), 400);
    expect(run.events).toMatchObject([{ kind: 'mcb-trip', componentId: 'mcb1', cause: 'thermal' }]);
    expect(within(run.events[0]?.timeS ?? 0, tripTimeS, 0.05)).toBe(true);
    const { snapshot } = run.last;
    expect(snapshot.components.mcb1?.condition).toBe('tripped');
    expect(snapshot.components.inv1?.condition).toBe('off');
    expect(snapshot.operatingPoint.loads.lamp1?.powerW).toBe(0);
    expect(run.state.closedSwitchIds).toEqual([]);
  });

  it('percepatan 600× tidak melompati trip: waktu trip sama dengan 1×', () => {
    const slow = runUntil(stepInput(BREAKER_COMPONENTS, BREAKER_WIRES, { dtS: 1 }), 400);
    const fast = stepSimulation(
      stepInput(BREAKER_COMPONENTS, BREAKER_WIRES, { dtS: 2, speed: 600 }),
    );
    expect(fast.state.timeS).toBeCloseTo(1200, 9);
    expect(fast.snapshot.events).toHaveLength(1);
    expect(fast.snapshot.events[0]?.timeS).toBeCloseTo(slow.events[0]?.timeS ?? 0, 6);
    // Setelah trip baterai tidak dikuras lagi.
    expect(fast.state.socPctByBatteryId.bat1).toBeCloseTo(
      slow.state.socPctByBatteryId.bat1 ?? 0,
      1,
    );
  });

  it('trip magnetik selesai dalam 0,02 s walau langkahnya 10 menit', () => {
    const components = [
      place('bat1', 'battery'),
      place('mcb1', 'mcb-dc', { ...MCB_DC_20A, ratedCurrentA: 1 }),
      place('load1', 'load-dc'),
    ];
    const result = stepSimulation(
      stepInput(components, directLoadWires('mcb1'), { dtS: 1, speed: 600 }),
    );
    expect(result.snapshot.events).toMatchObject([{ kind: 'mcb-trip', cause: 'magnetic' }]);
    expect(result.snapshot.events[0]?.timeS).toBeLessThanOrEqual(0.02);
    expect(result.state.energy.loadWh).toBeLessThan(0.01);
    expect(result.state.timeS).toBeCloseTo(600, 9);
  });

  it('fuse 5 A dengan sekitar 17 A putus dalam beberapa detik dan tetap putus', () => {
    const components = [place('bat1', 'battery'), fuse('f1', 5), place('load1', 'load-dc')];
    const run = runUntil(stepInput(components, directLoadWires('f1'), { dtS: 1, speed: 60 }), 120);
    expect(run.events).toMatchObject([{ kind: 'fuse-blown', componentId: 'f1' }]);
    expect(run.events[0]?.timeS).toBeGreaterThan(4);
    expect(run.events[0]?.timeS).toBeLessThan(8);
    expect(run.last.snapshot.components.f1?.condition).toBe('blown');
    expect(run.state.blownFuseIds).toEqual(['f1']);
  });

  it('BMS memutus arus lebih tepat setelah tunda 10 s, lalu baterai terlepas', () => {
    const components = [bmsBattery('bat1'), place('load1', 'load-dc')];
    const run = runUntil(stepInput(components, directLoadWires(), { dtS: 1, speed: 60 }), 120);
    expect(run.events).toMatchObject([{ kind: 'bms-cutoff', cause: 'over-current' }]);
    expect(run.events[0]?.timeS).toBeCloseTo(10, 6);
    expect(run.last.snapshot.components.bat1?.condition).toBe('cutoff');
    expect(run.last.snapshot.operatingPoint.loads.load1?.powerW).toBe(0);
  });

  it('kabel NYY 2,5 mm² dialiri 35 A: isolasi rusak setelah suhu melewati Tmax + 20 K', () => {
    const components = [place('bat1', 'battery', BATTERY_LFP_24V_100AH), place('load1', 'load-dc')];
    const wires = directLoadWires(undefined, 2.5, 'cable-nyy');
    const run = runUntil(stepInput(components, wires, { dtS: 1, speed: 600 }), HOUR_S);
    expect(run.events).toHaveLength(2);
    expect(run.events[0]).toMatchObject({ kind: 'component-damaged', cause: 'cable-overheat' });
    // Suhu mencapai 90 °C setelah sekitar 1200 s (τ 10 menit), lalu 60 s di zona rusak.
    expect(run.events[0]?.timeS).toBeGreaterThan(1100);
    expect(run.events[0]?.timeS).toBeLessThan(1400);
    expect(run.state.damagedWireIds.sort()).toEqual(wires.map((source) => source.id).sort());
    expect(run.last.snapshot.operatingPoint.loads.load1?.powerW).toBe(0);
  });
});
