import { describe, expect, it } from 'vitest';
import { place, wire } from '../circuit/validate-fixtures';
import { activeCircuit, createSimState, hasPendingTimers, toSolverState } from './sim-state';
import { BREAKER_COMPONENTS, BREAKER_WIRES, fuse } from './step-fixtures';

describe('createSimState', () => {
  it('semua MCB/fuse ON, baterai penuh, penghitung nol', () => {
    const state = createSimState([...BREAKER_COMPONENTS, fuse('f1', 10), place('bat2', 'battery')]);
    expect(state.timeS).toBe(0);
    expect(state.closedSwitchIds).toEqual(['f1', 'mcb1']);
    expect(state.socPctByBatteryId).toEqual({ bat1: 100, bat2: 100 });
    expect(state.energy.loadWh).toBe(0);
    expect(state.trippedSwitchIds).toEqual([]);
  });

  it('`init` menimpa sebagian; baterai yang tidak disebut tetap 100%', () => {
    const components = [...BREAKER_COMPONENTS, place('bat2', 'battery')];
    const state = createSimState(components, {
      socPctByBatteryId: { bat1: 40 },
      closedSwitchIds: [],
      timeS: 30,
    });
    expect(state.socPctByBatteryId).toEqual({ bat1: 40, bat2: 100 });
    expect(state.closedSwitchIds).toEqual([]);
    expect(state.timeS).toBe(30);
  });
});

describe('activeCircuit', () => {
  const base = createSimState(BREAKER_COMPONENTS);

  it('tanpa kejadian: semua kabel dan sakelar dipakai', () => {
    const active = activeCircuit(base, BREAKER_WIRES);
    expect(active.wires).toEqual(BREAKER_WIRES);
    expect(active.closedSwitchIds).toEqual(['mcb1']);
  });

  it('kabel rusak dan kabel ke komponen rusak dibuang', () => {
    const active = activeCircuit(
      { ...base, damagedWireIds: ['inv1.ac-l>lamp1.a'], damagedComponentIds: ['mcb1'] },
      BREAKER_WIRES,
    );
    expect(active.wires.map((w) => w.id)).toEqual(['inv1.ac-n>lamp1.b']);
    expect(active.closedSwitchIds).toEqual([]);
  });

  it('baterai yang diputus BMS terlepas; fuse putus dianggap OFF', () => {
    const state = {
      ...base,
      closedSwitchIds: ['f1', 'mcb1'],
      blownFuseIds: ['f1'],
      bmsById: { bat1: { open: true, overCurrentS: 0 } },
    };
    const active = activeCircuit(state, [...BREAKER_WIRES, wire('bat1.pos', 'f1.in')]);
    expect(active.wires.some((w) => w.from.componentId === 'bat1')).toBe(false);
    expect(active.wires).toHaveLength(4);
    expect(active.closedSwitchIds).toEqual(['mcb1']);
  });
});

describe('toSolverState', () => {
  it('meneruskan SoC, keadaan SCC dan inverter, suhu kabel, dan setelan pengguna', () => {
    const state = createSimState(BREAKER_COMPONENTS, {
      sccById: {
        scc1: { stage: 'float', absorptionElapsedS: 0, loadConnected: false, voltageScale: 2 },
      },
      inverterById: { inv1: { on: false, lowVoltageS: 0, offReason: 'lvd' } },
      conductorTempCByWireId: { w1: 45 },
    });
    const solverState = toSolverState(state, {
      powerSettingWByLoadId: { lamp1: 100 },
      batteryTypeBySccId: { scc1: 'gel', scc2: 'flooded' },
    });
    expect(solverState).toEqual({
      powerSettingWByLoadId: { lamp1: 100 },
      socPctByBatteryId: { bat1: 100 },
      sccById: {
        scc1: { stage: 'float', loadConnected: false, voltageScale: 2, batteryType: 'gel' },
        scc2: { batteryType: 'flooded' },
      },
      inverterOnById: { inv1: false },
      conductorTempCByWireId: { w1: 45 },
    });
  });

  it('SCC yang belum melihat baterai tidak membawa skala tegangan', () => {
    const state = createSimState([], {
      sccById: { scc1: { stage: 'bulk', absorptionElapsedS: 0, loadConnected: true } },
    });
    expect(toSolverState(state).sccById).toEqual({ scc1: { stage: 'bulk', loadConnected: true } });
  });
});

describe('hasPendingTimers', () => {
  const base = createSimState([]);

  it('keadaan awal: tidak ada', () => {
    expect(hasPendingTimers(base)).toBe(false);
  });

  it('tunda LVD, arus lebih BMS, atau kabel terlalu panas yang sedang berjalan', () => {
    const lvd = { ...base, inverterById: { inv1: { on: true, lowVoltageS: 3 } } };
    const bms = { ...base, bmsById: { bat1: { open: false, overCurrentS: 2 } } };
    expect(hasPendingTimers(lvd)).toBe(true);
    expect(hasPendingTimers(bms)).toBe(true);
    expect(hasPendingTimers({ ...base, overheatSByWireId: { w1: 5 } })).toBe(true);
  });

  it('yang sudah mati atau putus tidak dihitung', () => {
    const state = {
      ...base,
      inverterById: { inv1: { on: false, lowVoltageS: 0 } },
      bmsById: { bat1: { open: true, overCurrentS: 0 } },
      overheatSByWireId: { w1: 0 },
    };
    expect(hasPendingTimers(state)).toBe(false);
  });
});
