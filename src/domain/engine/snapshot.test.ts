import { describe, expect, it } from 'vitest';
import { OFFGRID_COMPONENTS, OFFGRID_WIRES, place } from '../circuit/validate-fixtures';
import { INVERTER_COMPONENTS, inverterWires, NOON } from './engine-fixtures';
import { buildSnapshot, componentStatus } from './snapshot';
import {
  BREAKER_COMPONENTS,
  BREAKER_WIRES,
  bmsBattery,
  directLoadWires,
  frameOf,
  fuse,
} from './step-fixtures';
import type { SimEvent, SimState } from './step-types';

type Init = Partial<SimState>;

/** Status komponen `id` rangkaian baterai → MCB → inverter → beban AC pada keadaan `init`. */
function breakerStatus(id: string, init: Init = {}) {
  const { frame, state } = frameOf(BREAKER_COMPONENTS, BREAKER_WIRES, { state: init });
  const component = BREAKER_COMPONENTS.find((candidate) => candidate.id === id);
  if (!component) throw new Error(`komponen uji ${id} tidak ada`);
  return componentStatus(component, frame, state);
}

describe('componentStatus', () => {
  it('rangkaian normal: semua `ok`, baterai membawa SoC, MCB membawa dosis', () => {
    expect(breakerStatus('bat1', { socPctByBatteryId: { bat1: 70 } })).toEqual({
      condition: 'ok',
      socPct: 70,
    });
    expect(breakerStatus('mcb1', { thermalDoseBySwitchId: { mcb1: 0.4 } })).toEqual({
      condition: 'ok',
      thermalDose: 0.4,
    });
    expect(breakerStatus('inv1')).toEqual({ condition: 'ok' });
    expect(breakerStatus('lamp1')).toEqual({ condition: 'ok' });
  });

  it('MCB: dimatikan tangan = `off`, trip = `tripped`, rusak = `damaged`', () => {
    expect(breakerStatus('mcb1', { closedSwitchIds: [] }).condition).toBe('off');
    const tripped = { closedSwitchIds: [], trippedSwitchIds: ['mcb1'] };
    expect(breakerStatus('mcb1', tripped).condition).toBe('tripped');
    expect(breakerStatus('mcb1', { damagedComponentIds: ['mcb1'] })).toEqual({
      condition: 'damaged',
    });
  });

  it('fuse: putus = `blown`, dicabut = `off`', () => {
    const components = [place('bat1', 'battery'), fuse('f1', 5), place('load1', 'load-dc')];
    const status = (init: Init) => {
      const { frame, state } = frameOf(components, directLoadWires('f1'), { state: init });
      return componentStatus(fuse('f1', 5), frame, state).condition;
    };
    expect(status({})).toBe('ok');
    expect(status({ closedSwitchIds: [], blownFuseIds: ['f1'] })).toBe('blown');
    expect(status({ closedSwitchIds: [], trippedSwitchIds: ['f1'] })).toBe('off');
  });

  it('inverter: tanpa DC = `off`, LVD = `lvd`, HVD = `hvd`, runtuh = `collapsed`', () => {
    expect(breakerStatus('inv1', { closedSwitchIds: [] }).condition).toBe('off');
    const off = (offReason: 'lvd' | 'hvd') => ({
      inverterById: { inv1: { on: false, lowVoltageS: 0, offReason } },
    });
    expect(breakerStatus('inv1', off('lvd')).condition).toBe('lvd');
    expect(breakerStatus('inv1', off('hvd')).condition).toBe('hvd');
    const [, inverter] = INVERTER_COMPONENTS;
    if (!inverter) throw new Error('inverter uji tidak ada');
    const collapsed = frameOf(INVERTER_COMPONENTS, inverterWires(5, 2.5), {
      state: { socPctByBatteryId: { bat1: 50 } },
    });
    expect(componentStatus(inverter, collapsed.frame, collapsed.state).condition).toBe('collapsed');
  });

  it('baterai yang diputus BMS = `cutoff`', () => {
    const battery = bmsBattery('bat1');
    const { frame, state } = frameOf([battery, place('load1', 'load-dc')], directLoadWires(), {
      state: { bmsById: { bat1: { open: true, reason: 'over-current', overCurrentS: 0 } } },
    });
    expect(componentStatus(battery, frame, state)).toEqual({ condition: 'cutoff', socPct: 100 });
  });

  it('SCC membawa tahap pengisian dan keadaan terminal beban', () => {
    const [, , scc] = OFFGRID_COMPONENTS;
    if (!scc) throw new Error('SCC uji tidak ada');
    const { frame, state } = frameOf(OFFGRID_COMPONENTS, OFFGRID_WIRES, {
      environment: NOON,
      state: { sccById: { scc1: { stage: 'float', absorptionElapsedS: 0, loadConnected: false } } },
    });
    expect(componentStatus(scc, frame, state)).toEqual({
      condition: 'ok',
      chargeStage: 'float',
      loadConnected: false,
    });
  });

  it('alat yang belum dimodelkan = `unsupported`', () => {
    const mppt = place('scc1', 'scc-mppt');
    const { frame, state } = frameOf([mppt], []);
    expect(componentStatus(mppt, frame, state)).toEqual({ condition: 'unsupported' });
  });
});

describe('buildSnapshot', () => {
  it('memuat waktu, V/I/P net dan terminal, status semua komponen, energi, dan kejadian', () => {
    const { frame, state } = frameOf(BREAKER_COMPONENTS, BREAKER_WIRES, {
      state: { timeS: 12 },
    });
    const events: SimEvent[] = [{ kind: 'mcb-trip', timeS: 10, componentId: 'mcb1' }];
    const snapshot = buildSnapshot(frame, state, events);
    expect(snapshot.timeS).toBe(12);
    expect(Object.keys(snapshot.components).sort()).toEqual(['bat1', 'inv1', 'lamp1', 'mcb1']);
    expect(snapshot.nets).toBe(frame.potentials.nets);
    expect(snapshot.terminals['bat1.pos']?.voltageV).toBeGreaterThan(12);
    expect(snapshot.energy).toBe(state.energy);
    expect(snapshot.events).toEqual(events);
    expect(snapshot.events).not.toBe(events);
    expect(snapshot.operatingPoint).toBe(frame.point);
  });
});
