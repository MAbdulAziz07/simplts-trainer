import { describe, expect, it } from 'vitest';
import { place } from '../circuit/validate-fixtures';
import { STEP_CABLES } from '../engine/step-fixtures';
import { createSimState } from '../engine/sim-state';
import type { Snapshot } from '../engine/step-types';
import {
  applyFaultsToCircuit,
  applyFaultsToControls,
  applyFaultsToState,
  DEFAULT_SHADED_FRACTION,
  diagnosisMatches,
  faultCandidates,
  maskFaultSnapshot,
  pickFaults,
  stripFaultState,
  WEAK_CELL_CAPACITY_FACTOR,
} from './faults';
import { COMPONENTS, snapshotAfter, WIRES } from './scenario-test-fixtures';
import { FAULT_KINDS, type Fault } from './types';

const BAT_WIRE = 'bat1.pos>scc1.bat-pos';
const PV_WIRE = 'pv1.pos>mcb1.pos-in';
const apply = (...faults: Fault[]) => applyFaultsToCircuit(COMPONENTS, WIRES, STEP_CABLES, faults);
const itemOf = (id: string, faults: Fault[]) =>
  apply(...faults).components.find((component) => component.id === id)?.item;

describe('applyFaultsToCircuit', () => {
  it('tanpa gangguan rangkaian sama', () => {
    const result = apply();
    expect(result.components).toEqual(COMPONENTS);
    expect(result.wires).toEqual(WIRES);
  });

  it('kabel putus dibuang dari simulasi', () => {
    const { wires } = apply({ kind: 'wire-open', target: BAT_WIRE });
    expect(wires.map((wire) => wire.id)).not.toContain(BAT_WIRE);
    expect(wires).toHaveLength(WIRES.length - 1);
  });

  it('MC4 longgar = kabel lebih panjang yang setara resistansi kontak', () => {
    const before = WIRES.find((wire) => wire.id === PV_WIRE)?.lengthM ?? 0;
    const loose = apply({ kind: 'mc4-loose', target: PV_WIRE, value: 1 });
    expect(loose.wires.find((wire) => wire.id === PV_WIRE)?.lengthM).toBeGreaterThan(before + 100);
  });

  it('sel baterai lemah: kapasitas turun, resistansi naik, OCV turun', () => {
    const original = itemOf('bat1', []);
    const weak = itemOf('bat1', [{ kind: 'battery-weak-cell', target: 'bat1' }]);
    if (original?.category !== 'battery' || weak?.category !== 'battery') throw new Error();
    expect(weak.electrical.capacityAh).toBeCloseTo(
      original.electrical.capacityAh * WEAK_CELL_CAPACITY_FACTOR,
    );
    expect(weak.electrical.internalResistanceMohm).toBeGreaterThan(
      original.electrical.internalResistanceMohm,
    );
    expect(weak.electrical.modelParams.ocvV[0]).toBeLessThan(
      original.electrical.modelParams.ocvV[0] ?? 0,
    );
  });

  it('MCB salah rating: nilai disebut atau seperempat arus asli', () => {
    const given = itemOf('mcb1', [{ kind: 'mcb-wrong-rating', target: 'mcb1', value: 2 }]);
    const auto = itemOf('mcb1', [{ kind: 'mcb-wrong-rating', target: 'mcb1' }]);
    if (given?.category !== 'mcb-dc' || auto?.category !== 'mcb-dc') throw new Error();
    expect(given.electrical.ratedCurrentA).toBe(2);
    expect(auto.electrical.ratedCurrentA).toBe(5);
  });
});

describe('setelan dan keadaan', () => {
  it('modul teduh dan jaringan padam masuk ke setelan', () => {
    const controls = applyFaultsToControls({}, [
      { kind: 'pv-shaded', target: 'pv1' },
      { kind: 'grid-outage', target: 'grid1' },
    ]);
    expect(controls.shadedFractionByPvId).toEqual({ pv1: DEFAULT_SHADED_FRACTION });
    expect(controls.gridAvailableById).toEqual({ grid1: false });
    const same = {};
    expect(applyFaultsToControls(same, [])).toBe(same);
  });

  it('fuse putus dan skala SCC dipasang lalu dicabut lagi', () => {
    const components = [...COMPONENTS, place('f1', 'fuse')];
    const faults: Fault[] = [
      { kind: 'fuse-blown', target: 'f1' },
      { kind: 'scc-setting-wrong', target: 'scc1' },
    ];
    const before = createSimState(components);
    const faulted = applyFaultsToState(before, components, faults);
    expect(faulted.blownFuseIds).toEqual(['f1']);
    expect(faulted.sccById.scc1?.voltageScale).toBe(2);
    const stripped = stripFaultState(faulted, before, faults);
    expect(stripped.blownFuseIds).toEqual([]);
    expect(stripped.sccById.scc1?.voltageScale).toBeUndefined();
  });

  it('fuse yang memang sudah putus tetap putus', () => {
    const before = { ...createSimState(COMPONENTS), blownFuseIds: ['f1'] };
    const faults: Fault[] = [{ kind: 'fuse-blown', target: 'f1' }];
    expect(stripFaultState(before, before, faults).blownFuseIds).toEqual(['f1']);
  });

  it('snapshot menyamarkan fuse putus karena gangguan', () => {
    const snapshot = {
      components: { f1: { condition: 'blown' }, f2: { condition: 'blown' } },
    } as unknown as Snapshot;
    const masked = maskFaultSnapshot(snapshot, [{ kind: 'fuse-blown', target: 'f1' }]);
    expect(masked.components.f1?.condition).toBe('ok');
    expect(masked.components.f2?.condition).toBe('blown');
    expect(maskFaultSnapshot(snapshot, [])).toBe(snapshot);
  });
});

describe('akibat di simulasi', () => {
  const chargeA = (snapshot: Snapshot) => snapshot.operatingPoint.sccs.scc1?.chargeCurrentA ?? 0;

  it('kabel baterai putus: SCC tidak mengisi', () => {
    expect(chargeA(snapshotAfter(10))).toBeGreaterThan(1);
    const { components, wires } = apply({ kind: 'wire-open', target: BAT_WIRE });
    expect(chargeA(snapshotAfter(10, {}, components, wires))).toBe(0);
  });

  it('modul teduh: daya PV turun', () => {
    const pvW = (snapshot: Snapshot) => snapshot.operatingPoint.pvModules.pv1?.powerW ?? 0;
    const controls = applyFaultsToControls({}, [{ kind: 'pv-shaded', target: 'pv1' }]);
    expect(pvW(snapshotAfter(10, { controls }))).toBeLessThan(pvW(snapshotAfter(10)) * 0.6);
  });

  it('SCC terset 24 V pada baterai 12 V: terminal beban diputus', () => {
    const before = createSimState(COMPONENTS);
    const faults: Fault[] = [{ kind: 'scc-setting-wrong', target: 'scc1' }];
    const state = applyFaultsToState(before, COMPONENTS, faults);
    const snapshot = snapshotAfter(30, { state });
    expect(snapshot.operatingPoint.loads.load1?.powerW ?? 0).toBeLessThan(1);
  });
});

describe('daftar, acak, dan jawaban', () => {
  const candidates = faultCandidates([...COMPONENTS, place('f1', 'fuse')], WIRES);

  it('daftar gangguan sesuai isi rangkaian', () => {
    const kinds = new Set(candidates.map((fault) => fault.kind));
    expect(kinds).toEqual(
      new Set([
        'wire-open',
        'fuse-blown',
        'mc4-loose',
        'pv-shaded',
        'battery-weak-cell',
        'scc-setting-wrong',
        'mcb-wrong-rating',
      ]),
    );
    const mc4 = candidates.filter((fault) => fault.kind === 'mc4-loose').map((f) => f.target);
    expect(mc4).toContain(PV_WIRE);
    expect(mc4).not.toContain(BAT_WIRE);
  });

  it('pickFaults: jumlah sesuai, jenis berbeda, bisa diulang', () => {
    let seed = 0.37;
    const random = () => (seed = (seed * 9301 + 0.49297) % 1);
    const picked = pickFaults(candidates, 3, random);
    expect(picked).toHaveLength(3);
    expect(new Set(picked.map((fault) => fault.kind)).size).toBe(3);
    expect(pickFaults(candidates, 2, () => 0)).toEqual(pickFaults(candidates, 2, () => 0));
    expect(pickFaults(candidates.slice(0, 2), 5, Math.random)).toHaveLength(2);
  });

  it('diagnosisMatches butuh jenis dan lokasi yang sama', () => {
    const fault: Fault = { kind: 'wire-open', target: BAT_WIRE };
    expect(diagnosisMatches(fault, 'wire-open', BAT_WIRE)).toBe(true);
    expect(diagnosisMatches(fault, 'mc4-loose', BAT_WIRE)).toBe(false);
    expect(diagnosisMatches(fault, 'wire-open', 'scc1')).toBe(false);
    expect(FAULT_KINDS).toHaveLength(8);
  });
});
