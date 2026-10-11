// Skenario ujung-ke-ujung: rangkaian benar pada 1000 W/m², 25 °C diperiksa lalu dijalankan 10 menit.
import { describe, expect, it } from 'vitest';
import { PV_GENERIC_100WP, within } from '../components/test-fixtures';
import {
  AC_COMPONENTS,
  AC_WIRES,
  inspect,
  simulate,
  SMALL_COMPONENTS,
  SMALL_WIRES,
} from './scenario-fixtures';
import type { Run } from './step-fixtures';

const START = { state: { socPctByBatteryId: { bat1: 60 } }, stopOnEvent: false };

function point(run: Run) {
  return run.last.snapshot.operatingPoint;
}

/** Daya sesaat dan energi kumulatif: sumber = beban + isi baterai + rugi, dalam 0,5% (§12 butir 5). */
function expectBalanced(run: Run) {
  const { balance } = point(run);
  const sourceW = balance.pvW + Math.max(balance.batteryDischargeW, 0);
  expect(Math.abs(balance.residualW) / sourceW).toBeLessThan(0.005);
  const { pvWh, batteryDischargeWh, loadWh, batteryChargeWh, lossWh } = run.state.energy;
  const sourceWh = pvWh + batteryDischargeWh;
  expect(sourceWh).toBeGreaterThan(0);
  expect(Math.abs(sourceWh - loadWh - batteryChargeWh - lossWh) / sourceWh).toBeLessThan(0.005);
}

/** PV 100 Wp di SCC PWM: tegangan modul ditahan dekat tegangan baterai, arus dekat Isc. */
function expectReasonablePv(run: Run) {
  const pv = point(run).pvModules.pv1;
  expect(within(pv?.currentA ?? 0, PV_GENERIC_100WP.iscA, 0.05)).toBe(true);
  expect(pv?.voltageV).toBeGreaterThan(12);
  expect(pv?.voltageV).toBeLessThan(PV_GENERIC_100WP.vmpV);
  expect(pv?.powerW).toBeGreaterThan(70);
  expect(pv?.powerW).toBeLessThan(0.9 * PV_GENERIC_100WP.pmaxW);
  expect(point(run).sccs.scc1?.status).toBe('charging');
}

function expectQuiet(run: Run) {
  expect(run.events).toEqual([]);
  expect(run.state.timeS).toBeCloseTo(600, 6);
  const conditions = Object.values(run.last.snapshot.components).map((status) => status.condition);
  expect(new Set(conditions)).toEqual(new Set(['ok']));
  const wires = Object.values(run.last.snapshot.wires).map((status) => status.condition);
  expect(new Set(wires)).toEqual(new Set(['ok']));
}

/** Temuan setelah arus terukur engine diteruskan ke pemeriksaan rangkaian. */
function measuredFindings(run: Run, components: typeof AC_COMPONENTS, wires: typeof AC_WIRES) {
  const { currentAByWireId, currentAByComponentId } = point(run);
  return inspect(components, wires, { currentAByWireId, currentAByComponentId, ambientTempC: 25 });
}

describe('off-grid kecil yang benar (PV 100 Wp, SCC PWM, VRLA 12 V, beban DC 60 W)', () => {
  const run = simulate(SMALL_COMPONENTS, SMALL_WIRES, START);

  it('tanpa temuan, dengan taksiran statis maupun arus terukur', () => {
    expect(inspect(SMALL_COMPONENTS, SMALL_WIRES)).toEqual([]);
    expect(measuredFindings(run, SMALL_COMPONENTS, SMALL_WIRES)).toEqual([]);
  });

  it('daya PV masuk akal: sekitar 80 W dari 100 Wp', () => {
    expectReasonablePv(run);
  });

  it('beban menyala di tegangan baterai dan sisanya mengisi baterai', () => {
    const { loads, batteries, status } = point(run);
    expect(status).toBe('ok');
    expect(loads.load1?.voltageV).toBeGreaterThan(12);
    expect(loads.load1?.voltageV).toBeLessThan(13.5);
    expect(loads.load1?.powerW).toBeGreaterThan(55);
    expect(loads.load1?.powerW).toBeLessThan(75);
    expect(batteries.bat1?.currentA).toBeGreaterThan(0);
    expect(run.state.socPctByBatteryId.bat1).toBeGreaterThan(60);
    expect(run.last.snapshot.components.scc1).toMatchObject({ loadConnected: true });
  });

  it('neraca daya dan energi tertutup', () => {
    expectBalanced(run);
  });

  it('10 menit tanpa kejadian; semua komponen dan kabel `ok`', () => {
    expectQuiet(run);
  });
});

describe('off-grid dengan inverter yang benar (beban AC 200 W, MCB AC, PE terpasang)', () => {
  const run = simulate(AC_COMPONENTS, AC_WIRES, START);

  it('tanpa temuan, dengan taksiran statis maupun arus terukur', () => {
    expect(inspect(AC_COMPONENTS, AC_WIRES)).toEqual([]);
    expect(measuredFindings(run, AC_COMPONENTS, AC_WIRES)).toEqual([]);
  });

  it('daya PV masuk akal: sekitar 80 W dari 100 Wp', () => {
    expectReasonablePv(run);
  });

  it('keluaran AC 220 V, beban 200 W, efisiensi inverter 85–95%', () => {
    const { loads, inverters, acBuses, status } = point(run);
    const inverter = inverters.inv1;
    expect(status).toBe('ok');
    expect(acBuses.map((bus) => bus.status)).toEqual(['ok']);
    expect(within(loads.lamp1?.voltageV ?? 0, 220, 0.02)).toBe(true);
    expect(within(loads.lamp1?.powerW ?? 0, 200, 0.02)).toBe(true);
    expect(inverter?.status).toBe('on');
    const efficiency = (inverter?.acPowerW ?? 0) / (inverter?.dcPowerW ?? 1);
    expect(efficiency).toBeGreaterThan(0.85);
    expect(efficiency).toBeLessThan(0.95);
  });

  it('beban melebihi PV: baterai melepas sekitar 200 W dan SoC turun', () => {
    const { batteries, balance } = point(run);
    expect(batteries.bat1?.currentA).toBeLessThan(-10);
    expect(balance.batteryDischargeW).toBeGreaterThan(150);
    expect(balance.batteryDischargeW).toBeLessThan(260);
    expect(run.state.socPctByBatteryId.bat1).toBeLessThan(60);
    expect(run.state.socPctByBatteryId.bat1).toBeGreaterThan(50);
  });

  it('neraca daya dan energi tertutup', () => {
    expectBalanced(run);
  });

  it('10 menit tanpa kejadian; semua komponen dan kabel `ok`', () => {
    expectQuiet(run);
  });
});
