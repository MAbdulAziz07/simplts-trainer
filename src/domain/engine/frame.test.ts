import { describe, expect, it } from 'vitest';
import { BREAKER_COMPONENTS, BREAKER_WIRES, frameOf } from './step-fixtures';

describe('solveFrame', () => {
  it('menghitung topologi, titik kerja, dan potensial pada keadaan awal', () => {
    const { frame } = frameOf(BREAKER_COMPONENTS, BREAKER_WIRES);
    expect(frame.point.status).toBe('ok');
    expect(frame.point.inverters.inv1?.status).toBe('on');
    expect(frame.point.currentAByComponentId.mcb1).toBeGreaterThan(40);
    expect(frame.potentials.terminals['inv1.ac-l']?.voltageV).toBe(220);
    expect(frame.controls).toEqual({});
  });

  it('MCB yang OFF di keadaan memutus rangkaian', () => {
    const { frame } = frameOf(BREAKER_COMPONENTS, BREAKER_WIRES, {
      state: { closedSwitchIds: [] },
    });
    expect(frame.point.inverters.inv1?.status).toBe('no-dc');
    expect(frame.point.loads.lamp1?.powerW).toBe(0);
    expect(frame.point.currentAByComponentId.mcb1).toBeUndefined();
  });

  it('SoC dan setelan beban diteruskan ke solver', () => {
    const controls = { powerSettingWByLoadId: { lamp1: 100 } };
    const full = frameOf(BREAKER_COMPONENTS, BREAKER_WIRES, { controls }).frame;
    const low = frameOf(BREAKER_COMPONENTS, BREAKER_WIRES, {
      state: { socPctByBatteryId: { bat1: 30 } },
      controls,
    }).frame;
    const fullV = full.point.batteries.bat1?.voltageV ?? 0;
    expect(low.point.batteries.bat1?.voltageV).toBeLessThan(fullV - 0.3);
    expect(low.point.loads.lamp1?.powerW).toBeCloseTo(100, 0);
  });

  it('kabel rusak dibuang dari rangkaian', () => {
    const { frame } = frameOf(BREAKER_COMPONENTS, BREAKER_WIRES, {
      state: { damagedWireIds: ['inv1.ac-l>lamp1.a'] },
    });
    expect(frame.point.loads.lamp1?.powerW).toBe(0);
    expect(frame.topology.netlist.wires).toHaveLength(5);
  });
});
