import { describe, expect, it } from 'vitest';
import { place } from '../circuit/validate-fixtures';
import { PV_240W_60P } from '../components/test-fixtures';
import { stepBms, stepDeviceDamage } from './device-events';
import { CHARGE_COMPONENTS, chargeWires, NOON } from './engine-fixtures';
import {
  bmsBattery,
  directLoadWires,
  frameOf,
  METER_COMPONENTS,
  meterWires,
  withProtection,
} from './step-fixtures';

/** LiFePO4 25,6 V ber-BMS (batas 20 A) dengan beban sekitar 36 A. */
const bmsCircuit = (protection: object = {}) => [
  bmsBattery('bat1', protection),
  place('load1', 'load-dc'),
];

describe('stepBms', () => {
  it('arus lebih: penghitung mulai dan ditandai sebagai perubahan', () => {
    const { frame, state } = frameOf(bmsCircuit(), directLoadWires());
    expect(frame.point.batteries.bat1?.currentA).toBeLessThan(-30);
    const outcome = stepBms(frame, state, 1);
    expect(outcome.state.bmsById.bat1).toEqual({ open: false, overCurrentS: 1 });
    expect(outcome).toMatchObject({ events: [], transition: true, instant: false });
  });

  it('setelah 10 s: BMS memutus dengan kejadian `bms-cutoff`', () => {
    const { frame, state } = frameOf(bmsCircuit(), directLoadWires(), {
      state: { timeS: 9, bmsById: { bat1: { open: false, overCurrentS: 9 } } },
    });
    const outcome = stepBms(frame, state, 1);
    expect(outcome.state.bmsById.bat1).toMatchObject({ open: true, reason: 'over-current' });
    expect(outcome.events).toMatchObject([
      { kind: 'bms-cutoff', timeS: 10, componentId: 'bat1', cause: 'over-current' },
    ]);
    expect(outcome.events[0]?.params?.currentA).toBeLessThan(-30);
    expect(outcome.instant).toBe(false);
  });

  it('hubung singkat (> faktor × batas): seketika', () => {
    const { frame, state } = frameOf(bmsCircuit({ shortCircuitFactor: 1.5 }), directLoadWires());
    const outcome = stepBms(frame, state, 0.02);
    expect(outcome.events).toMatchObject([{ kind: 'bms-cutoff', cause: 'short-circuit' }]);
    expect(outcome).toMatchObject({ transition: true, instant: true });
  });

  it('tegangan kurang: seketika', () => {
    const { frame, state } = frameOf(
      bmsCircuit({ underVoltageCutoffV: 27.5, overCurrentDischargeA: 100 }),
      directLoadWires(),
    );
    expect(stepBms(frame, state, 1).events).toMatchObject([{ cause: 'under-voltage' }]);
  });

  it('baterai tanpa BMS atau arus di bawah batas: tidak ada apa-apa', () => {
    const plain = frameOf([place('bat1', 'battery'), place('load1', 'load-dc')], directLoadWires());
    expect(stepBms(plain.frame, plain.state, 60).state.bmsById).toEqual({});
    const ok = frameOf(bmsCircuit({ overCurrentDischargeA: 100 }), directLoadWires());
    const outcome = stepBms(ok.frame, ok.state, 60);
    expect(outcome.state.bmsById.bat1).toEqual({ open: false, overCurrentS: 0 });
    expect(outcome).toMatchObject({ events: [], transition: false });
  });

  it('yang sudah putus tidak memberi kejadian lagi', () => {
    const open = { open: true, reason: 'over-current' as const, overCurrentS: 0 };
    const { frame, state } = frameOf(bmsCircuit(), directLoadWires(), {
      state: { bmsById: { bat1: open } },
    });
    expect(frame.point.loads.load1?.powerW).toBe(0);
    expect(stepBms(frame, state, 60)).toMatchObject({ events: [], transition: false });
  });
});

describe('stepDeviceDamage', () => {
  it('rangkaian wajar: tidak ada yang rusak', () => {
    const { frame, state } = frameOf(CHARGE_COMPONENTS, chargeWires(), { environment: NOON });
    expect(stepDeviceDamage(frame, state, 1)).toMatchObject({
      events: [],
      transition: false,
      instant: false,
    });
  });

  it('panel 60 sel (Voc 37 V) pada SCC PWM 12 V: SCC rusak seketika', () => {
    const components = [
      place('pv1', 'pv-module', PV_240W_60P),
      place('scc1', 'scc-pwm'),
      place('bat1', 'battery'),
    ];
    const { frame, state } = frameOf(components, chargeWires(), {
      environment: NOON,
      state: { timeS: 3 },
    });
    expect(frame.point.sccs.scc1?.status).toBe('damaged');
    const outcome = stepDeviceDamage(frame, state, 0.02);
    expect(outcome.state.damagedComponentIds).toEqual(['scc1']);
    expect(outcome.events).toMatchObject([
      { kind: 'component-damaged', timeS: 3.02, componentId: 'scc1', cause: 'pv-overvoltage' },
    ]);
    expect(outcome).toMatchObject({ transition: true, instant: true });
    const after = frameOf(components, chargeWires(), { environment: NOON, state: outcome.state });
    expect(stepDeviceDamage(after.frame, after.state, 1).events).toEqual([]);
  });

  it('kWh meter dengan arus di atas batas rusaknya: rusak', () => {
    const [grid, meter, lamp] = METER_COMPONENTS;
    if (!grid || !meter || !lamp) throw new Error('rangkaian meter uji tidak lengkap');
    const weak = withProtection(meter, { currentMaxA: 1, overCurrentDamageA: 1, ipRating: 'IP51' });
    const { frame, state } = frameOf([grid, weak, lamp], meterWires());
    const outcome = stepDeviceDamage(frame, state, 1);
    expect(outcome.events).toMatchObject([
      { kind: 'component-damaged', componentId: 'm1', cause: 'overcurrent' },
    ]);
    expect(outcome.events[0]?.params?.currentA).toBeGreaterThan(2);
  });
});
