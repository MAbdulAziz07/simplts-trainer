import { describe, expect, it } from 'vitest';
import { batteryStepSocPct } from '../components/battery';
import { place } from '../circuit/validate-fixtures';
import { BATTERY_LFP_24V_100AH, BATTERY_VRLA_100AH } from '../components/test-fixtures';
import { advanceDevices, advanceEnergy, advanceSoc } from './advance-state';
import {
  CHARGE_COMPONENTS,
  chargeWires,
  INVERTER_COMPONENTS,
  inverterWires,
  NIGHT,
  NOON,
} from './engine-fixtures';
import { createSimState } from './sim-state';
import { frameOf } from './step-fixtures';
import type { SccSimState } from './step-types';

const HALF = { socPctByBatteryId: { bat1: 50 } };

describe('advanceSoc', () => {
  const { frame, state } = frameOf(INVERTER_COMPONENTS, inverterWires(), { state: HALF });

  it('SoC turun menurut arus titik kerja dan suhu sekitar (Peukert)', () => {
    const currentA = frame.point.batteries.bat1?.currentA ?? 0;
    expect(currentA).toBeLessThan(-40);
    const expected = batteryStepSocPct(BATTERY_VRLA_100AH, 50, currentA, 60, NIGHT.ambientTempC);
    expect(advanceSoc(frame, state, 60).bat1).toBeCloseTo(expected, 12);
    expect(expected).toBeLessThan(50);
  });

  it('dt 0 tidak mengubah SoC dan tidak mengubah keadaan masukan', () => {
    expect(advanceSoc(frame, state, 0)).toEqual({ bat1: 50 });
    advanceSoc(frame, state, 600);
    expect(state.socPctByBatteryId).toEqual({ bat1: 50 });
  });

  it('SoC naik saat diisi', () => {
    const charging = frameOf(CHARGE_COMPONENTS, chargeWires(), { environment: NOON, state: HALF });
    expect(advanceSoc(charging.frame, charging.state, 60).bat1).toBeGreaterThan(50);
  });
});

describe('advanceEnergy', () => {
  it('daya × waktu; neraca energi tertutup dalam 0,5% (§12 butir 5)', () => {
    const { frame, state } = frameOf(INVERTER_COMPONENTS, inverterWires(), { state: HALF });
    const energy = advanceEnergy(state.energy, frame.point, 1800);
    expect(energy.loadWh).toBeCloseTo((frame.point.loads.lamp1?.powerW ?? 0) / 2, 9);
    expect(energy.batteryChargeWh).toBe(0);
    const sourceWh = energy.pvWh + energy.batteryDischargeWh + energy.gridImportWh;
    const useWh = energy.loadWh + energy.lossWh + energy.batteryChargeWh + energy.gridExportWh;
    expect(Math.abs(sourceWh - useWh) / sourceWh).toBeLessThan(0.005);
  });

  it('mengisi: energi PV = energi ke baterai + rugi', () => {
    const { frame, state } = frameOf(CHARGE_COMPONENTS, chargeWires(), {
      environment: NOON,
      state: HALF,
    });
    const energy = advanceEnergy(state.energy, frame.point, 3600);
    expect(energy.pvWh).toBeGreaterThan(50);
    expect(energy.batteryDischargeWh).toBe(0);
    expect(
      Math.abs(energy.pvWh - energy.batteryChargeWh - energy.lossWh) / energy.pvWh,
    ).toBeLessThan(0.005);
  });

  it('menambah ke nilai sebelumnya', () => {
    const { frame, state } = frameOf(INVERTER_COMPONENTS, inverterWires());
    const once = advanceEnergy(state.energy, frame.point, 60);
    const twice = advanceEnergy(once, frame.point, 60);
    expect(twice.loadWh).toBeCloseTo(2 * once.loadWh, 9);
  });
});

describe('advanceDevices: SCC PWM', () => {
  const scc = (overrides: Partial<SccSimState>): { scc1: SccSimState } => ({
    scc1: { stage: 'bulk', absorptionElapsedS: 0, loadConnected: true, ...overrides },
  });

  it('langkah pertama mengunci skala tegangan 12 V dan tetap bulk selama mengisi', () => {
    const { frame, state } = frameOf(CHARGE_COMPONENTS, chargeWires(), {
      environment: NOON,
      state: HALF,
    });
    const outcome = advanceDevices(frame, state, 60);
    expect(outcome.state.sccById.scc1).toEqual(scc({ voltageScale: 1 }).scc1);
    expect(outcome.transition).toBe(false);
    expect(outcome.events).toEqual([]);
  });

  it('baterai penuh: SCC menahan tegangan, bulk → absorption', () => {
    const { frame, state } = frameOf(CHARGE_COMPONENTS, chargeWires(), { environment: NOON });
    expect(frame.point.sccs.scc1?.status).toBe('regulating');
    const outcome = advanceDevices(frame, state, 1);
    expect(outcome.state.sccById.scc1?.stage).toBe('absorption');
    expect(outcome.transition).toBe(true);
  });

  it('absorption menghitung waktu, lalu float setelah 120 menit', () => {
    const start = frameOf(CHARGE_COMPONENTS, chargeWires(), {
      environment: NOON,
      state: { sccById: scc({ stage: 'absorption', absorptionElapsedS: 7000 }) },
    });
    const counting = advanceDevices(start.frame, start.state, 60);
    expect(counting.state.sccById.scc1).toMatchObject({
      stage: 'absorption',
      absorptionElapsedS: 7060,
    });
    expect(counting.transition).toBe(false);
    const done = advanceDevices(start.frame, start.state, 200);
    expect(done.state.sccById.scc1).toMatchObject({ stage: 'float', absorptionElapsedS: 0 });
    expect(done.transition).toBe(true);
  });

  it('float kembali ke bulk saat tegangan baterai di bawah tegangan isi ulang', () => {
    const { frame, state } = frameOf(CHARGE_COMPONENTS, chargeWires(), {
      environment: NIGHT,
      state: { ...HALF, sccById: scc({ stage: 'float' }) },
    });
    expect(advanceDevices(frame, state, 1).state.sccById.scc1?.stage).toBe('bulk');
  });

  it('terminal beban diputus saat tegangan baterai ≤ 10,7 V dan tetap putus di bawah 12,6 V', () => {
    const empty = frameOf(CHARGE_COMPONENTS, chargeWires(), {
      environment: NIGHT,
      state: { socPctByBatteryId: { bat1: 0 } },
    });
    const cut = advanceDevices(empty.frame, empty.state, 1);
    expect(cut.state.sccById.scc1?.loadConnected).toBe(false);
    expect(cut.transition).toBe(true);
    const half = frameOf(CHARGE_COMPONENTS, chargeWires(), {
      environment: NIGHT,
      state: { ...HALF, sccById: scc({ loadConnected: false }) },
    });
    expect(advanceDevices(half.frame, half.state, 1).state.sccById.scc1?.loadConnected).toBe(false);
  });
});

describe('advanceDevices: inverter', () => {
  const LOW = { socPctByBatteryId: { bat1: 5 } };

  it('tegangan cukup: tetap hidup tanpa kejadian', () => {
    const { frame, state } = frameOf(INVERTER_COMPONENTS, inverterWires(), { state: HALF });
    const outcome = advanceDevices(frame, state, 60);
    expect(outcome.state.inverterById.inv1).toEqual({ on: true, lowVoltageS: 0 });
    expect(outcome.transition).toBe(false);
  });

  it('di bawah Vlvd: penghitung tunda mulai, belum mati', () => {
    const { frame, state } = frameOf(INVERTER_COMPONENTS, inverterWires(), { state: LOW });
    expect(frame.point.inverters.inv1?.dcVoltageV).toBeLessThan(10.5);
    const outcome = advanceDevices(frame, state, 1);
    expect(outcome.state.inverterById.inv1).toEqual({ on: true, lowVoltageS: 1 });
    expect(outcome.transition).toBe(true);
    expect(outcome.events).toEqual([]);
  });

  it('setelah tunda 10 s: mati dengan kejadian `inverter-lvd`', () => {
    const { frame, state } = frameOf(INVERTER_COMPONENTS, inverterWires(), {
      state: { ...LOW, timeS: 100, inverterById: { inv1: { on: true, lowVoltageS: 9 } } },
    });
    const outcome = advanceDevices(frame, state, 1);
    expect(outcome.state.inverterById.inv1).toEqual({
      on: false,
      lowVoltageS: 0,
      offReason: 'lvd',
    });
    expect(outcome.events).toEqual([
      {
        kind: 'inverter-lvd',
        timeS: 101,
        componentId: 'inv1',
        params: { voltageV: frame.point.inverters.inv1?.dcVoltageV },
      },
    ]);
  });

  it('yang sudah mati tetap mati di bawah Vlvr dan menyimpan sebabnya', () => {
    const off = { inv1: { on: false, lowVoltageS: 0, offReason: 'lvd' as const } };
    const { frame, state } = frameOf(INVERTER_COMPONENTS, inverterWires(), {
      state: { ...HALF, inverterById: off },
    });
    const outcome = advanceDevices(frame, state, 60);
    expect(outcome.state.inverterById).toEqual(off);
    expect(outcome.events).toEqual([]);
  });

  it('hidup lagi saat tegangan ≥ Vlvr', () => {
    const { frame, state } = frameOf(INVERTER_COMPONENTS, inverterWires(), {
      state: { inverterById: { inv1: { on: false, lowVoltageS: 0, offReason: 'lvd' } } },
    });
    expect(frame.point.inverters.inv1?.dcVoltageV).toBeGreaterThan(12.5);
    const outcome = advanceDevices(frame, state, 1);
    expect(outcome.state.inverterById.inv1).toEqual({ on: true, lowVoltageS: 0 });
    expect(outcome.transition).toBe(true);
  });

  it('tegangan di atas Vhvd: mati seketika dengan kejadian `inverter-hvd`', () => {
    const components = [
      place('bat1', 'battery', BATTERY_LFP_24V_100AH),
      place('inv1', 'inverter-offgrid'),
      place('lamp1', 'load-ac'),
    ];
    const { frame, state } = frameOf(components, inverterWires());
    const dcVoltageV = frame.point.inverters.inv1?.dcVoltageV ?? 0;
    expect(dcVoltageV).toBeGreaterThan(15.5);
    const outcome = advanceDevices(frame, state, 1);
    expect(outcome.state.inverterById.inv1).toEqual({
      on: false,
      lowVoltageS: 0,
      offReason: 'hvd',
    });
    expect(outcome.events).toEqual([
      { kind: 'inverter-hvd', timeS: 1, componentId: 'inv1', params: { voltageV: dcVoltageV } },
    ]);
  });

  it('daya tidak tersedia (runtuh) dihitung sebagai tegangan rendah', () => {
    const { frame, state } = frameOf(INVERTER_COMPONENTS, inverterWires(5, 2.5), { state: HALF });
    expect(frame.point.inverters.inv1?.status).toBe('collapsed');
    expect(advanceDevices(frame, state, 1).state.inverterById.inv1?.lowVoltageS).toBe(1);
  });

  it('keadaan masukan tidak diubah', () => {
    const { frame } = frameOf(INVERTER_COMPONENTS, inverterWires(), { state: LOW });
    const state = createSimState(INVERTER_COMPONENTS, LOW);
    const before = JSON.stringify(state);
    advanceDevices(frame, state, 30);
    expect(JSON.stringify(state)).toBe(before);
  });
});
