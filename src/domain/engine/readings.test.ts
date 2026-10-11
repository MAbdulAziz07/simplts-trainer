import { describe, expect, it } from 'vitest';
import { OFFGRID_COMPONENTS, OFFGRID_WIRES, pair, place, wire } from '../circuit/validate-fixtures';
import {
  CHARGE_COMPONENTS,
  chargeWires,
  INVERTER_COMPONENTS,
  inverterWires,
  NIGHT,
  operatingPoint,
  solverInput,
} from './engine-fixtures';
import { readOperatingPoint } from './readings';
import { solveSystem } from './solver';
import type { OperatingPoint } from './types';

const SOC_60 = { socPctByBatteryId: { bat1: 60 } };

/** Neraca daya §12 butir 5: selisih terhadap daya yang mengalir di bawah 0,5%. */
function expectBalanced({ balance }: OperatingPoint): void {
  const lossW = balance.wireLossW + balance.sccLossW + balance.inverterLossW;
  const sourcesW = balance.pvW + balance.batteryDischargeW + balance.gridImportW;
  expect(sourcesW).toBeCloseTo(balance.loadW + lossW + balance.residualW, 9);
  const throughputW = balance.pvW + Math.abs(balance.batteryDischargeW) + balance.gridImportW;
  expect(Math.abs(balance.residualW)).toBeLessThanOrEqual(0.005 * throughputW + 1e-9);
}

describe('readOperatingPoint: off-grid kecil siang hari', () => {
  const point = readOperatingPoint(
    solveSystem(solverInput(OFFGRID_COMPONENTS, OFFGRID_WIRES, { state: SOC_60 })),
  );

  it('beban 200 W melebihi PV 100 Wp: PV dan baterai sama-sama memasok', () => {
    expect(point.status).toBe('ok');
    expect(point.sccs.scc1?.status).toBe('charging');
    expect(point.pvModules.pv1?.powerW).toBeGreaterThan(40);
    expect(point.batteries.bat1?.currentA).toBeLessThan(0);
    expect(point.loads.load1?.powerW).toBeGreaterThan(150);
    expect(point.dcBuses[0]?.batteryCurrentA).toBe(point.batteries.bat1?.currentA);
  });

  it('neraca daya tertutup', () => {
    expectBalanced(point);
    expect(point.balance.pvW).toBeGreaterThan(0);
    expect(point.balance.batteryDischargeW).toBeGreaterThan(0);
    expect(point.balance.sccLossW).toBeGreaterThan(0);
    expect(point.balance.wireLossW).toBeGreaterThan(0);
  });

  it('tegangan turun di sepanjang jalur: baterai > SCC > beban', () => {
    const batteryV = point.batteries.bat1?.voltageV ?? 0;
    const sccV = point.sccs.scc1?.batteryVoltageV ?? 0;
    const loadV = point.loads.load1?.voltageV ?? 0;
    expect(batteryV).toBeGreaterThan(sccV);
    expect(sccV).toBeGreaterThan(loadV);
    expect(point.pvModules.pv1?.voltageV).toBeGreaterThan(point.sccs.scc1?.pvVoltageV ?? 0);
  });

  it('arus tiap kabel dan MCB: jalur PV = arus isi, jalur beban = arus beban', () => {
    const chargeA = point.sccs.scc1?.chargeCurrentA ?? 0;
    expect(Object.keys(point.currentAByWireId)).toHaveLength(OFFGRID_WIRES.length);
    expect(point.currentAByWireId['pv1.pos>mcb1.pos-in']).toBeCloseTo(chargeA, 9);
    expect(point.currentAByComponentId).toEqual({ mcb1: expect.closeTo(chargeA, 9) });
    expect(point.currentAByWireId['scc1.load-pos>load1.a']).toBeCloseTo(
      point.loads.load1?.currentA ?? 0,
      9,
    );
    expect(point.sccs.scc1?.loadCurrentA).toBe(point.loads.load1?.currentA);
    expect(point.loopWireIds).toEqual([]);
  });

  it('terminal beban SCC diputus: beban tanpa arus, PV mengisi baterai', () => {
    const state = { ...SOC_60, sccById: { scc1: { loadConnected: false } } };
    const cut = operatingPoint(OFFGRID_COMPONENTS, OFFGRID_WIRES, { state });
    expect(cut.loads.load1).toEqual({ voltageV: 0, currentA: 0, powerW: 0 });
    expect(cut.batteries.bat1?.currentA).toBeGreaterThan(0);
    expectBalanced(cut);
  });

  it('MCB PV OFF: SCC diam, modul di Voc tanpa arus', () => {
    const open = operatingPoint(OFFGRID_COMPONENTS, OFFGRID_WIRES, {
      state: SOC_60,
      closedSwitchIds: [],
    });
    expect(open.sccs.scc1).toMatchObject({ status: 'idle', chargeCurrentA: 0 });
    expect(open.pvModules.pv1?.voltageV).toBeGreaterThan(17);
    expect(open.pvModules.pv1?.currentA).toBe(0);
    expectBalanced(open);
  });
});

describe('readOperatingPoint: jatuh tegangan kabel (§8.3)', () => {
  it('kabel 4 mm² 2 m pada 20 °C: ΔV = I · 8,75 mΩ per penghantar', () => {
    const point = operatingPoint(INVERTER_COMPONENTS, inverterWires(2, 4), {
      environment: NIGHT,
      state: SOC_60,
      closedSwitchIds: [],
    });
    const currentA = point.currentAByWireId['bat1.pos>inv1.dc-pos'] ?? 0;
    expect(currentA).toBeGreaterThan(40);
    expect(point.voltageDropVByWireId['bat1.pos>inv1.dc-pos']).toBeCloseTo(currentA * 0.00875, 6);
    const dropV = (point.batteries.bat1?.voltageV ?? 0) - (point.inverters.inv1?.dcVoltageV ?? 0);
    expect(dropV).toBeCloseTo(2 * currentA * 0.00875, 6);
    expectBalanced(point);
  });

  it('kabel ganda dilaporkan sebagai lingkaran', () => {
    const extra = { ...wire('bat1.pos', 'inv1.dc-pos', 25), id: 'ganda' };
    const point = operatingPoint(INVERTER_COMPONENTS, [...inverterWires(), extra]);
    expect(point.loopWireIds).toHaveLength(1);
  });
});

describe('readOperatingPoint: pengisian', () => {
  it('baterai penuh: SCC menahan 14,4 V; tahap float menahan 13,7 V', () => {
    const full = operatingPoint(CHARGE_COMPONENTS, chargeWires());
    expect(full.sccs.scc1?.status).toBe('regulating');
    expect(full.sccs.scc1?.batteryVoltageV).toBeCloseTo(14.4, 3);
    expect(full.batteries.bat1?.currentA).toBeCloseTo(0, 6);
    const float = operatingPoint(CHARGE_COMPONENTS, chargeWires(), {
      state: { sccById: { scc1: { stage: 'float' } } },
    });
    expect(float.sccs.scc1?.batteryVoltageV).toBeCloseTo(13.7, 3);
    expectBalanced(full);
  });

  it('modul yang teduh menurunkan arus isi', () => {
    const state = { socPctByBatteryId: { bat1: 50 } };
    const clear = operatingPoint(CHARGE_COMPONENTS, chargeWires(), { state });
    const shaded = operatingPoint(CHARGE_COMPONENTS, chargeWires(), {
      state: { ...state, shadedFractionByPvId: { pv1: 0.5 } },
    });
    const clearA = clear.sccs.scc1?.chargeCurrentA ?? 0;
    expect(clearA).toBeGreaterThan(3);
    expect(shaded.sccs.scc1?.chargeCurrentA).toBeLessThan(clearA * 0.7);
    expectBalanced(clear);
    expectBalanced(shaded);
  });

  it('dua modul seri dan dua baterai seri: tegangan terbagi rata', () => {
    const components = [
      place('pvA', 'pv-module'),
      place('pvB', 'pv-module'),
      place('scc1', 'scc-pwm'),
      place('batA', 'battery'),
      place('batB', 'battery'),
    ];
    const wires = [
      wire('pvA.neg', 'scc1.pv-neg'),
      wire('pvA.pos', 'pvB.neg'),
      wire('pvB.pos', 'scc1.pv-pos'),
      wire('batA.neg', 'scc1.bat-neg'),
      wire('batA.pos', 'batB.neg'),
      wire('batB.pos', 'scc1.bat-pos'),
    ];
    const state = { socPctByBatteryId: { batA: 50, batB: 50 } };
    const point = operatingPoint(components, wires, { state });
    expect(point.sccs.scc1?.status).toBe('charging');
    expect(point.dcBuses[0]?.voltageV).toBeGreaterThan(24);
    expect(point.batteries.batA).toEqual(point.batteries.batB);
    expect(point.pvModules.pvA?.voltageV).toBeCloseTo(point.pvModules.pvB?.voltageV ?? 0, 9);
    expect(point.pvModules.pvA?.currentA).toBe(point.sccs.scc1?.chargeCurrentA);
    // Saat mengisi, tegangan bank = jumlah tegangan baterai + jatuh tegangan kabel antarbaterai.
    const cellsV = (point.batteries.batA?.voltageV ?? 0) * 2;
    const linkDropV = point.voltageDropVByWireId['batA.pos>batB.neg'] ?? 0;
    expect(linkDropV).toBeGreaterThan(0);
    expect(cellsV + linkDropV).toBeCloseTo(point.dcBuses[0]?.voltageV ?? 0, 9);
    expectBalanced(point);
  });
});

describe('readOperatingPoint: tanpa arus', () => {
  it('komponen lepas: PV di Voc, baterai di OCV, beban nol', () => {
    const components = [
      place('pv1', 'pv-module'),
      place('bat1', 'battery'),
      place('load1', 'load-dc'),
      place('lamp1', 'load-ac'),
    ];
    const point = operatingPoint(components, [], { state: { socPctByBatteryId: { bat1: 50 } } });
    expect(point.status).toBe('no-source');
    expect(point.pvModules.pv1?.voltageV).toBeGreaterThan(17);
    expect(point.batteries.bat1).toEqual({ voltageV: 12.3, currentA: 0, powerW: 0 });
    expect(point.loads).toEqual({
      load1: { voltageV: 0, currentA: 0, powerW: 0 },
      lamp1: { voltageV: 0, currentA: 0, powerW: 0 },
    });
    expect(point.balance.residualW).toBe(0);
  });

  it('inverter di terminal beban SCC: dihitung lewat SCC', () => {
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
    const point = operatingPoint(components, wires, { environment: NIGHT });
    // Tanpa beban AC inverter menarik daya tanpa beban 8 W lewat terminal beban SCC.
    expect(point.inverters.inv1?.status).toBe('on');
    expect(point.inverters.inv1?.dcPowerW).toBeCloseTo(8, 3);
    expect(point.sccs.scc1?.loadCurrentA).toBe(point.inverters.inv1?.dcCurrentA);
    expectBalanced(point);
  });
});
