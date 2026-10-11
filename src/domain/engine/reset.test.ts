import { describe, expect, it } from 'vitest';
import {
  replaceComponent,
  replaceFuse,
  replaceWire,
  resetBms,
  resetBreaker,
  resetInverter,
  resetSccLoad,
} from './reset';
import { createSimState } from './sim-state';
import { BREAKER_COMPONENTS } from './step-fixtures';
import type { SimState } from './step-types';

const base = createSimState(BREAKER_COMPONENTS);
const withState = (init: Partial<SimState>): SimState => ({ ...base, ...init });

describe('resetBreaker', () => {
  it('MCB trip di-ON-kan lagi; dosis termal tetap', () => {
    const tripped = withState({
      closedSwitchIds: ['f1'],
      trippedSwitchIds: ['mcb1'],
      thermalDoseBySwitchId: { mcb1: 1.01 },
    });
    const state = resetBreaker(tripped, 'mcb1');
    expect(state.closedSwitchIds).toEqual(['f1', 'mcb1']);
    expect(state.trippedSwitchIds).toEqual([]);
    expect(state.thermalDoseBySwitchId).toEqual({ mcb1: 1.01 });
    expect(tripped.closedSwitchIds).toEqual(['f1']);
  });

  it('MCB yang sudah ON tidak digandakan', () => {
    expect(resetBreaker(base, 'mcb1').closedSwitchIds).toEqual(['mcb1']);
  });

  it('MCB rusak dan fuse putus tidak bisa di-ON-kan', () => {
    const damaged = withState({ closedSwitchIds: [], damagedComponentIds: ['mcb1'] });
    expect(resetBreaker(damaged, 'mcb1')).toBe(damaged);
    const blown = withState({ closedSwitchIds: [], blownFuseIds: ['f1'] });
    expect(resetBreaker(blown, 'f1')).toBe(blown);
  });
});

describe('replaceFuse', () => {
  it('fuse putus diganti: tersambung dengan dosis nol', () => {
    const blown = withState({
      closedSwitchIds: ['mcb1'],
      blownFuseIds: ['f1'],
      thermalDoseBySwitchId: { f1: 1.2, mcb1: 0.3 },
    });
    const state = replaceFuse(blown, 'f1');
    expect(state.blownFuseIds).toEqual([]);
    expect(state.closedSwitchIds).toEqual(['f1', 'mcb1']);
    expect(state.thermalDoseBySwitchId).toEqual({ mcb1: 0.3 });
  });

  it('fuse yang tidak putus diabaikan', () => {
    expect(replaceFuse(base, 'f1')).toBe(base);
  });
});

describe('resetBms', () => {
  it('BMS yang memutus disambung lagi', () => {
    const open = withState({
      bmsById: { bat1: { open: true, reason: 'over-current', overCurrentS: 0 } },
    });
    expect(resetBms(open, 'bat1').bmsById.bat1).toEqual({ open: false, overCurrentS: 0 });
    expect(resetBms(base, 'bat1')).toBe(base);
  });
});

describe('resetInverter', () => {
  it('mati karena beban lebih: hidup lagi dengan dosis nol', () => {
    const off = withState({
      inverterById: { inv1: { on: false, lowVoltageS: 0, offReason: 'overload' } },
      overloadDoseById: { inv1: 1.02, scc1: 0.4 },
    });
    const state = resetInverter(off, 'inv1');
    expect(state.inverterById.inv1).toEqual({ on: true, lowVoltageS: 0 });
    expect(state.overloadDoseById).toEqual({ scc1: 0.4 });
  });

  it('mati karena LVD tidak direset dari sini (pulih sendiri di Vlvr)', () => {
    const lvd = withState({
      inverterById: { inv1: { on: false, lowVoltageS: 0, offReason: 'lvd' } },
    });
    expect(resetInverter(lvd, 'inv1')).toBe(lvd);
  });
});

describe('resetSccLoad', () => {
  it('terminal beban yang putus karena arus lebih disambung lagi', () => {
    const scc = { stage: 'float' as const, absorptionElapsedS: 0, voltageScale: 1 };
    const off = withState({
      sccById: { scc1: { ...scc, loadConnected: false, loadOverloaded: true } },
      overloadDoseById: { scc1: 1 },
    });
    const state = resetSccLoad(off, 'scc1');
    expect(state.sccById.scc1).toEqual({ ...scc, loadConnected: true, loadOverloaded: false });
    expect(state.overloadDoseById).toEqual({});
  });

  it('putus karena LVD SCC tidak direset dari sini', () => {
    const lvd = withState({
      sccById: { scc1: { stage: 'bulk', absorptionElapsedS: 0, loadConnected: false } },
    });
    expect(resetSccLoad(lvd, 'scc1')).toBe(lvd);
  });
});

describe('replaceComponent', () => {
  it('MCB rusak diganti: tidak rusak lagi, dosis nol, terpasang OFF', () => {
    const damaged = withState({
      closedSwitchIds: [],
      trippedSwitchIds: ['mcb1'],
      damagedComponentIds: ['mcb1', 'scc1'],
      thermalDoseBySwitchId: { mcb1: 1.3 },
    });
    const state = replaceComponent(damaged, 'mcb1');
    expect(state.damagedComponentIds).toEqual(['scc1']);
    expect(state.trippedSwitchIds).toEqual([]);
    expect(state.thermalDoseBySwitchId).toEqual({});
    expect(state.closedSwitchIds).toEqual([]);
    expect(resetBreaker(state, 'mcb1').closedSwitchIds).toEqual(['mcb1']);
  });

  it('SCC rusak diganti: keadaan bawaannya kembali ke awal; SoC baterai tetap', () => {
    const damaged = withState({
      damagedComponentIds: ['scc1'],
      socPctByBatteryId: { bat1: 40 },
      sccById: { scc1: { stage: 'float', absorptionElapsedS: 0, loadConnected: false } },
      overloadDoseById: { scc1: 0.7 },
    });
    const state = replaceComponent(damaged, 'scc1');
    expect(state.damagedComponentIds).toEqual([]);
    expect(state.sccById).toEqual({});
    expect(state.overloadDoseById).toEqual({});
    expect(state.socPctByBatteryId).toEqual({ bat1: 40 });
  });

  it('komponen yang tidak rusak diabaikan', () => {
    expect(replaceComponent(base, 'inv1')).toBe(base);
  });
});

describe('replaceWire', () => {
  it('kabel rusak diganti: suhu dan penghitung panasnya dihapus', () => {
    const damaged = withState({
      damagedWireIds: ['w1', 'w2'],
      conductorTempCByWireId: { w1: 95, w2: 95 },
      overheatSByWireId: { w1: 0, w2: 0 },
    });
    const state = replaceWire(damaged, 'w1');
    expect(state.damagedWireIds).toEqual(['w2']);
    expect(state.conductorTempCByWireId).toEqual({ w2: 95 });
    expect(state.overheatSByWireId).toEqual({ w2: 0 });
    expect(replaceWire(base, 'w1')).toBe(base);
  });
});
