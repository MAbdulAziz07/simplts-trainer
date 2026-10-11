import { describe, expect, it } from 'vitest';
import { busbar, pair, place, wire } from '../circuit/validate-fixtures';
import { inverterDcInputW } from '../components/inverter';
import { pwmChargePoint } from '../components/scc';
import { PV_JS185CB_48P, within } from '../components/test-fixtures';
import { INVERTER_500W, PWM_RBL_20A } from '../components/test-fixtures-bos';
import {
  CHARGE_COMPONENTS,
  chargeWires,
  INVERTER_COMPONENTS,
  inverterWires,
  NIGHT,
  NOON,
  operatingPoint,
  solverInput,
} from './engine-fixtures';
import { solveOperatingPoint, solveSystem, VOLTAGE_DROP_ROUNDS } from './solver';

const HALF = { socPctByBatteryId: { bat1: 50 } };

describe('solveOperatingPoint: baterai → inverter → beban AC', () => {
  const point = operatingPoint(INVERTER_COMPONENTS, inverterWires(), {
    environment: NIGHT,
    state: HALF,
  });
  const inverter = point.inverters.inv1;

  it('contoh §4.7: 47,9 A dan 11,86 V di masukan inverter', () => {
    expect(point.status).toBe('ok');
    expect(within(inverter?.dcCurrentA ?? 0, 47.9)).toBe(true);
    expect(within(inverter?.dcVoltageV ?? 0, 11.86)).toBe(true);
    expect(point.batteries.bat1?.currentA).toBeCloseTo(-(inverter?.dcCurrentA ?? 0), 9);
  });

  it('contoh §5.4: beban 500 W menarik sekitar 568 W DC', () => {
    expect(within(inverter?.dcPowerW ?? 0, 568.2)).toBe(true);
    expect(within(point.loads.lamp1?.powerW ?? 0, 500)).toBe(true);
    expect(point.acBuses).toEqual([{ id: 'ac1', status: 'ok', voltageV: 220, sourceId: 'inv1' }]);
  });

  it('putaran jatuh tegangan konvergen: daya DC = model inverter, beban = V²/R', () => {
    const modelW = inverterDcInputW(INVERTER_500W, inverter?.acPowerW ?? 0);
    expect(within(inverter?.dcPowerW ?? 0, modelW, 0.005)).toBe(true);
    const lamp = point.loads.lamp1;
    expect(within(lamp?.powerW ?? 0, (lamp?.voltageV ?? 0) ** 2 / 96.8, 0.005)).toBe(true);
  });

  it('kabel DC panjang dan tipis: daya tidak tersedia, inverter runtuh dan bus AC mati', () => {
    const collapsed = operatingPoint(INVERTER_COMPONENTS, inverterWires(5, 2.5), {
      environment: NIGHT,
      state: HALF,
    });
    expect(collapsed.status).toBe('collapsed');
    expect(collapsed.inverters.inv1).toMatchObject({ status: 'collapsed', dcCurrentA: 0 });
    expect(collapsed.acBuses[0]).toMatchObject({ status: 'dead', voltageV: 0 });
    expect(collapsed.loads.lamp1?.powerW).toBe(0);
    expect(collapsed.dcBuses[0]).toMatchObject({ status: 'ok', batteryCurrentA: 0 });
  });

  it('kabel 4 m masih sanggup: arus lebih besar karena tegangan turun', () => {
    const strained = operatingPoint(INVERTER_COMPONENTS, inverterWires(4, 2.5), {
      environment: NIGHT,
      state: HALF,
    });
    expect(strained.status).toBe('ok');
    expect(strained.inverters.inv1?.dcCurrentA).toBeGreaterThan(inverter?.dcCurrentA ?? 0);
    expect(strained.inverters.inv1?.dcVoltageV).toBeLessThan(10.5);
  });

  it('inverter dimatikan proteksi: tanpa arus DC, bus AC mati', () => {
    const off = operatingPoint(INVERTER_COMPONENTS, inverterWires(), {
      state: { inverterOnById: { inv1: false } },
    });
    expect(off.inverters.inv1).toMatchObject({ status: 'off', dcPowerW: 0, acPowerW: 0 });
    expect(off.acBuses[0]?.status).toBe('dead');
    expect(off.status).toBe('ok');
  });

  it('setelan daya beban dipakai', () => {
    const light = operatingPoint(INVERTER_COMPONENTS, inverterWires(), {
      state: { ...HALF, powerSettingWByLoadId: { lamp1: 100 } },
    });
    expect(within(light.loads.lamp1?.powerW ?? 0, 100)).toBe(true);
    expect(within(light.inverters.inv1?.dcPowerW ?? 0, 113.4)).toBe(true);
  });
});

describe('solveOperatingPoint: PV → SCC PWM → baterai', () => {
  it('kabel sangat pendek: arus isi = pwmChargePoint pada tegangan baterai (§2.2)', () => {
    const input = solverInput(CHARGE_COMPONENTS, chargeWires(0.001), { state: HALF });
    const solved = solveSystem(input);
    const point = solveOperatingPoint(input);
    const scc = point.sccs.scc1;
    const array = solved.buses[0]?.sccs[0]?.strings ?? [];
    const expected = pwmChargePoint(PWM_RBL_20A, array, scc?.batteryVoltageV ?? 0);
    expect(scc?.status).toBe('charging');
    expect(scc?.chargeCurrentA).toBeCloseTo(expected.chargeCurrentA, 3);
    expect(scc?.pvVoltageV).toBeCloseTo(expected.pvVoltageV, 6);
  });

  it('tiga modul paralel melebihi SCC 20 A: arus isi dibatasi 20 A (§2.4)', () => {
    const components = [
      place('pv1', 'pv-module', PV_JS185CB_48P),
      place('pv2', 'pv-module', PV_JS185CB_48P),
      place('pv3', 'pv-module', PV_JS185CB_48P),
      busbar('bp', 'pv+'),
      busbar('bn', 'pv-'),
      place('scc1', 'scc-pwm'),
      place('bat1', 'battery'),
    ];
    const wires = [
      wire('pv1.pos', 'bp.t1'),
      wire('pv2.pos', 'bp.t2'),
      wire('pv3.pos', 'bp.t3'),
      wire('bp.t4', 'scc1.pv-pos'),
      wire('pv1.neg', 'bn.t1'),
      wire('pv2.neg', 'bn.t2'),
      wire('pv3.neg', 'bn.t3'),
      wire('bn.t4', 'scc1.pv-neg'),
      ...pair('bat1', 'scc1', 'bat'),
    ];
    const point = operatingPoint(components, wires, { state: HALF });
    expect(point.sccs.scc1?.chargeCurrentA).toBeCloseTo(20, 6);
    expect(point.pvModules.pv1?.currentA).toBeCloseTo(20 / 3, 6);
    expect(point.currentAByWireId['bp.t4>scc1.pv-pos']).toBeCloseTo(20, 6);
  });

  it('malam: SCC diam, baterai hanya menanggung konsumsi SCC', () => {
    const point = operatingPoint(CHARGE_COMPONENTS, chargeWires(), { environment: NIGHT });
    expect(point.sccs.scc1).toMatchObject({ status: 'idle', chargeCurrentA: 0, pvVoltageV: 0 });
    expect(point.batteries.bat1?.currentA).toBeCloseTo(-0.01, 6);
  });
});

describe('solveOperatingPoint: keadaan khusus', () => {
  it('tanpa baterai: no-source, SCC berstatus no-battery', () => {
    const components = [place('pv1', 'pv-module'), place('scc1', 'scc-pwm')];
    const point = operatingPoint(components, pair('pv1', 'scc1', 'pv'));
    expect(point.status).toBe('no-source');
    expect(point.sccs.scc1?.status).toBe('no-battery');
    expect(point.dcBuses).toEqual([]);
  });

  it('SCC MPPT: unsupported, tanpa angka bus', () => {
    const components = [place('mppt1', 'scc-mppt'), place('bat1', 'battery')];
    const point = operatingPoint(components, pair('bat1', 'mppt1', 'bat'));
    expect(point.status).toBe('unsupported');
    expect(point.dcBuses).toEqual([
      { id: 'dc1', status: 'unsupported', voltageV: 0, batteryCurrentA: 0 },
    ]);
    expect(point.sccs).toEqual({});
  });

  it('jaringan PLN ke beban AC: impor = beban + rugi kabel', () => {
    const components = [
      place('grid1', 'grid', { nominalVoltageV: 220 }),
      place('lamp1', 'load-ac'),
    ];
    const wires = [
      wire('grid1.l', 'lamp1.a', 2.5, 'cable-nyy'),
      wire('grid1.n', 'lamp1.b', 2.5, 'cable-nyy'),
    ];
    const state = { gridAvailableById: { grid1: true } };
    const point = operatingPoint(components, wires, { state });
    expect(point.status).toBe('ok');
    expect(point.grids.grid1?.voltageV).toBe(220);
    expect(point.balance.gridImportW).toBeCloseTo(point.balance.loadW + point.balance.wireLossW, 6);
    const outage = operatingPoint(components, wires, {
      state: { gridAvailableById: { grid1: false } },
    });
    expect(outage.status).toBe('no-source');
    expect(outage.grids.grid1).toEqual({ voltageV: 0, currentA: 0, powerW: 0 });
  });

  it('hasil sama untuk masukan sama dan tidak bergantung urutan masukan', () => {
    const options = { state: HALF };
    const expected = operatingPoint(INVERTER_COMPONENTS, inverterWires(), options);
    const again = operatingPoint(INVERTER_COMPONENTS, inverterWires(), options);
    const shuffled = operatingPoint(
      [...INVERTER_COMPONENTS].reverse(),
      inverterWires().reverse(),
      options,
    );
    expect(again).toEqual(expected);
    expect(shuffled).toEqual(expected);
  });
});

describe('solveSystem', () => {
  it('mengembalikan satu hasil per bus dan memakai 5 putaran jatuh tegangan', () => {
    const solved = solveSystem(solverInput(INVERTER_COMPONENTS, inverterWires(), { state: HALF }));
    expect(VOLTAGE_DROP_ROUNDS).toBe(5);
    expect(solved.buses).toHaveLength(1);
    expect(solved.dcRounds).toHaveLength(1);
    expect(solved.acRounds).toHaveLength(1);
    expect(solved.inverterStatus.get('inv1')).toBe('on');
    expect(solved.edges).toHaveLength(4);
    expect(solved.flow.currentA).toHaveLength(4);
  });

  it('putaran tambahan tidak mengubah hasil lebih dari 0,1%', () => {
    const point = operatingPoint(INVERTER_COMPONENTS, inverterWires(3, 2.5), {
      environment: NOON,
      state: HALF,
    });
    const inverter = point.inverters.inv1;
    const modelW = inverterDcInputW(INVERTER_500W, inverter?.acPowerW ?? 0);
    expect(within(inverter?.dcPowerW ?? 0, modelW, 0.001)).toBe(true);
  });
});
