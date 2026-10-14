import { describe, expect, it } from 'vitest';
import type { PlacedComponent, SimState, Wire } from '@/domain';
import { findCatalogItem } from './catalog';
import { EMPTY_DOC, type CircuitDoc } from './circuit-doc';
import {
  INITIAL_SOC_PCT,
  initialSimState,
  reconcileSimState,
  repairState,
  sameCircuit,
  switchesOpenedBySim,
  type CircuitParts,
} from './sim-reconcile';

function place(id: string, catalogId: string): PlacedComponent {
  const item = findCatalogItem(catalogId);
  if (!item) throw new Error(`item ${catalogId} tidak ada di katalog`);
  return { id, item };
}

const wire = (id: string, from: string, to: string): Wire => {
  const [fromComponent = '', fromTerminal = ''] = from.split('.');
  const [toComponent = '', toTerminal = ''] = to.split('.');
  return {
    id,
    from: { componentId: fromComponent, terminalId: fromTerminal },
    to: { componentId: toComponent, terminalId: toTerminal },
    cableId: 'cable-pv-h1z2z2k',
    areaMm2: 4,
    lengthM: 1,
  };
};

const BAT = place('bat', 'bat-vrla-agm-12v-100ah');
const MCB = place('mcb', 'mcb-dc-16a');
const FUSE = place('fuse', 'fuse-pv-15a');
const LOAD = place('load', 'load-dc-12v-200w');
const W1 = wire('w1', 'bat.pos', 'mcb.pos-in');
const W2 = wire('w2', 'mcb.pos-out', 'load.a');
const parts = (overrides: Partial<CircuitParts> = {}): CircuitParts => ({
  components: [BAT, MCB, FUSE, LOAD],
  wires: [W1, W2],
  closedSwitchIds: ['fuse', 'mcb'],
  ...overrides,
});

describe('sameCircuit', () => {
  const part = { id: 'c1', catalogId: 'mcb-dc-16a', xPx: 0, yPx: 0, rotationDeg: 0 } as const;
  const doc: CircuitDoc = { components: [part], wires: [], closedSwitchIds: [] };

  it('menggeser dan memutar komponen bukan perubahan listrik', () => {
    const moved = { ...doc, components: [{ ...part, xPx: 96, rotationDeg: 90 as const }] };
    expect(sameCircuit(doc, moved)).toBe(true);
    expect(sameCircuit(doc, doc)).toBe(true);
  });

  it('komponen, kabel, atau tuas yang berubah adalah perubahan listrik', () => {
    expect(sameCircuit(doc, EMPTY_DOC)).toBe(false);
    expect(sameCircuit(doc, { ...doc, wires: [] })).toBe(false);
    expect(sameCircuit(doc, { ...doc, closedSwitchIds: ['c1'] })).toBe(false);
    const swapped = { ...doc, components: [{ ...part, catalogId: 'mcb-dc-20a' }] };
    expect(sameCircuit(doc, swapped)).toBe(false);
    const tuned = { ...doc, components: [{ ...part, params: { ratedA: 25 } }] };
    expect(sameCircuit(doc, tuned)).toBe(false);
  });
});

describe('initialSimState', () => {
  it('baterai pada SoC awal dan tuas seperti di meja kerja', () => {
    const state = initialSimState(parts({ closedSwitchIds: ['fuse'] }));
    expect(state.socPctByBatteryId).toEqual({ bat: INITIAL_SOC_PCT });
    expect(state.closedSwitchIds).toEqual(['fuse']);
    expect(state.timeS).toBe(0);
  });
});

describe('reconcileSimState', () => {
  const base = initialSimState(parts());

  it('rangkaian yang sama tidak mengubah isi keadaan', () => {
    expect(reconcileSimState(base, parts())).toEqual(base);
  });

  it('tuas yang di-OFF-kan dan di-ON-kan pengguna diikuti', () => {
    const off = reconcileSimState(base, parts({ closedSwitchIds: ['fuse'] }));
    expect(off.closedSwitchIds).toEqual(['fuse']);
    const on = reconcileSimState(off, parts());
    expect(on.closedSwitchIds).toEqual(['fuse', 'mcb']);
  });

  it('MCB trip yang di-ON-kan lagi kehilangan tanda trip tetapi dosis termalnya tetap', () => {
    const tripped: SimState = {
      ...base,
      closedSwitchIds: ['fuse'],
      trippedSwitchIds: ['mcb'],
      thermalDoseBySwitchId: { mcb: 1 },
    };
    expect(reconcileSimState(tripped, parts({ closedSwitchIds: ['fuse'] }))).toEqual(tripped);
    const reset = reconcileSimState(tripped, parts());
    expect(reset.trippedSwitchIds).toEqual([]);
    expect(reset.closedSwitchIds).toEqual(['fuse', 'mcb']);
    expect(reset.thermalDoseBySwitchId).toEqual({ mcb: 1 });
  });

  it('fuse putus dan MCB rusak tetap terbuka walau meja kerja menyebutnya ON', () => {
    const broken: SimState = {
      ...base,
      closedSwitchIds: [],
      blownFuseIds: ['fuse'],
      damagedComponentIds: ['mcb'],
    };
    expect(reconcileSimState(broken, parts()).closedSwitchIds).toEqual([]);
  });

  it('catatan komponen dan kabel yang dihapus dibuang; baterai baru mulai dari SoC awal', () => {
    const used: SimState = {
      ...base,
      socPctByBatteryId: { bat: 41 },
      damagedWireIds: ['w2'],
      conductorTempCByWireId: { w1: 50, w2: 95 },
      thermalDoseBySwitchId: { mcb: 0.4 },
      damagedComponentIds: ['load'],
    };
    const next = reconcileSimState(used, {
      components: [BAT, place('bat2', 'bat-vrla-agm-12v-100ah')],
      wires: [W1],
      closedSwitchIds: [],
    });
    expect(next.socPctByBatteryId).toEqual({ bat: 41, bat2: INITIAL_SOC_PCT });
    expect(next.damagedWireIds).toEqual([]);
    expect(next.conductorTempCByWireId).toEqual({ w1: 50 });
    expect(next.thermalDoseBySwitchId).toEqual({});
    expect(next.damagedComponentIds).toEqual([]);
    expect(next.closedSwitchIds).toEqual([]);
    expect(used.damagedWireIds).toEqual(['w2']);
  });
});

describe('switchesOpenedBySim', () => {
  it('MCB trip dilaporkan, fuse putus tidak', () => {
    const state: SimState = {
      ...initialSimState(parts()),
      closedSwitchIds: [],
      trippedSwitchIds: ['mcb'],
      blownFuseIds: ['fuse'],
    };
    expect(switchesOpenedBySim(state, ['fuse', 'mcb'])).toEqual(['mcb']);
    expect(switchesOpenedBySim(state, ['fuse'])).toEqual([]);
  });
});

describe('repairState', () => {
  const base = initialSimState(parts());

  it('fuse putus diganti dan tersambung lagi', () => {
    const blown: SimState = { ...base, closedSwitchIds: ['mcb'], blownFuseIds: ['fuse'] };
    const fixed = repairState(blown, 'fuse', 'blown');
    expect(fixed.blownFuseIds).toEqual([]);
    expect(fixed.closedSwitchIds).toEqual(['fuse', 'mcb']);
  });

  it('komponen rusak diganti; kondisi lain tidak mengubah keadaan', () => {
    const damaged: SimState = { ...base, damagedComponentIds: ['load'] };
    expect(repairState(damaged, 'load', 'damaged').damagedComponentIds).toEqual([]);
    expect(repairState(damaged, 'load', 'ok')).toBe(damaged);
    expect(repairState(damaged, 'mcb', 'tripped')).toBe(damaged);
  });

  it('beban lebih inverter direset dengan dosis nol', () => {
    const overloaded: SimState = {
      ...base,
      inverterById: { inv: { on: false, lowVoltageS: 0, offReason: 'overload' } },
      overloadDoseById: { inv: 1 },
    };
    const reset = repairState(overloaded, 'inv', 'overload');
    expect(reset.inverterById.inv?.on).toBe(true);
    expect(reset.overloadDoseById).toEqual({});
  });
});

describe('sameCircuit — setelan daya beban', () => {
  it('setelan daya yang berubah adalah perubahan listrik', () => {
    const part = {
      id: 'c1',
      catalogId: 'load-dc-12v-200w',
      xPx: 0,
      yPx: 0,
      rotationDeg: 0,
    } as const;
    const doc: CircuitDoc = { components: [part], wires: [], closedSwitchIds: [] };
    const dimmed = { ...doc, components: [{ ...part, powerSettingW: 100 }] };
    expect(sameCircuit(doc, dimmed)).toBe(false);
    const again = { ...doc, components: [{ ...part, powerSettingW: 100 }] };
    expect(sameCircuit(dimmed, again)).toBe(true);
  });
});
