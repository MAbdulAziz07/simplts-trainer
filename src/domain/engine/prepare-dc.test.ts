import { describe, expect, it } from 'vitest';
import { recognizeSubsystems } from '../circuit/subsystems';
import type { PlacedComponent, Wire } from '../circuit/types';
import { OFFGRID_COMPONENTS, OFFGRID_WIRES, pair, place, wire } from '../circuit/validate-fixtures';
import { BATTERY_LFP_24V_100AH, PV_240W_60P } from '../components/test-fixtures';
import type { PvModuleItem } from '../types';
import { NOON } from './engine-fixtures';
import { itemLookup, prepareDcBus, pvModuleCurve } from './prepare-dc';
import type { SolverState } from './types';

function prepare(components: readonly PlacedComponent[], wires: readonly Wire[], state = {}) {
  const topology = recognizeSubsystems(components, wires);
  const [bus] = topology.dcBuses;
  if (!bus) throw new Error('rangkaian uji tanpa bus baterai');
  return prepareDcBus(bus, topology, itemLookup(topology.components), NOON, state as SolverState);
}

describe('itemLookup', () => {
  const itemOf = itemLookup(OFFGRID_COMPONENTS);

  it('mengembalikan item bila kategorinya cocok', () => {
    expect(itemOf('bat1', 'battery')?.electrical.capacityAh).toBe(100);
  });

  it('kategori lain atau id tak dikenal: undefined', () => {
    expect(itemOf('bat1', 'pv-module')).toBeUndefined();
    expect(itemOf('tidak-ada', 'battery')).toBeUndefined();
  });
});

describe('pvModuleCurve', () => {
  const module = place('pv1', 'pv-module').item as PvModuleItem;

  it('bayangan menurunkan Isc modul itu saja', () => {
    const clear = pvModuleCurve('pv1', module, NOON, {});
    const shaded = pvModuleCurve('pv1', module, NOON, { shadedFractionByPvId: { pv1: 0.5 } });
    const other = pvModuleCurve('pv2', module, NOON, { shadedFractionByPvId: { pv1: 0.5 } });
    expect(shaded.iscA).toBeLessThan(clear.iscA * 0.7);
    expect(other).toEqual(clear);
  });

  it('gelap: kurva nol', () => {
    const dark = pvModuleCurve('pv1', module, { irradianceWm2: 0, ambientTempC: 25 }, {});
    expect(dark.iscA).toBe(0);
  });
});

describe('prepareDcBus', () => {
  it('off-grid kecil: bank 1S1P, satu SCC dengan satu string, setelan absorption 14,4 V', () => {
    const prepared = prepare(OFFGRID_COMPONENTS, OFFGRID_WIRES);
    expect(prepared.bank).toMatchObject({ seriesCount: 1, parallelCount: 1, socPct: 100 });
    expect(prepared.sccs).toHaveLength(1);
    expect(prepared.sccs[0]).toMatchObject({ vocStatus: 'ok', limitV: 14.4 });
    expect(prepared.sccs[0]?.strings).toHaveLength(1);
    expect(prepared.sccs[0]?.consumers.map((consumer) => consumer.id)).toEqual(['load1']);
    expect(prepared.consumers).toEqual([]);
  });

  it('SoC bank = rata-rata SoC baterainya', () => {
    const components = [
      place('batA', 'battery'),
      place('batB', 'battery'),
      place('scc1', 'scc-pwm'),
    ];
    const wires = [
      wire('batA.neg', 'scc1.bat-neg'),
      wire('batA.pos', 'batB.neg'),
      wire('batB.pos', 'scc1.bat-pos'),
    ];
    const prepared = prepare(components, wires, { socPctByBatteryId: { batA: 40, batB: 60 } });
    expect(prepared.bank).toMatchObject({ seriesCount: 2, parallelCount: 1, socPct: 50 });
  });

  it('bank 24 V: setelan SCC diskalakan dua kali', () => {
    const components = [
      place('batA', 'battery'),
      place('batB', 'battery'),
      place('scc1', 'scc-pwm'),
    ];
    const wires = [
      wire('batA.neg', 'scc1.bat-neg'),
      wire('batA.pos', 'batB.neg'),
      wire('batB.pos', 'scc1.bat-pos'),
    ];
    expect(prepare(components, wires).sccs[0]?.limitV).toBeCloseTo(28.8, 9);
  });

  it('skala hasil deteksi yang salah (US17) dipakai apa adanya', () => {
    const state = { sccById: { scc1: { voltageScale: 2 } } };
    expect(prepare(OFFGRID_COMPONENTS, OFFGRID_WIRES, state).sccs[0]?.limitV).toBeCloseTo(28.8, 9);
  });

  it('tahap float dan jenis baterai mengubah setelan', () => {
    const float = { sccById: { scc1: { stage: 'float' } } };
    const gel = { sccById: { scc1: { batteryType: 'gel' } } };
    expect(prepare(OFFGRID_COMPONENTS, OFFGRID_WIRES, float).sccs[0]?.limitV).toBe(13.7);
    expect(prepare(OFFGRID_COMPONENTS, OFFGRID_WIRES, gel).sccs[0]?.limitV).toBe(14.2);
  });

  it('terminal beban diputus: SCC tanpa pemakai', () => {
    const state = { sccById: { scc1: { loadConnected: false } } };
    expect(prepare(OFFGRID_COMPONENTS, OFFGRID_WIRES, state).sccs[0]?.consumers).toEqual([]);
  });

  it('modul 60 sel (Voc 37 V) pada SCC 12 V: status rusak', () => {
    const components = [
      place('pv1', 'pv-module', PV_240W_60P),
      place('scc1', 'scc-pwm'),
      place('bat1', 'battery'),
    ];
    const wires = [...pair('pv1', 'scc1', 'pv'), ...pair('bat1', 'scc1', 'bat')];
    expect(prepare(components, wires).sccs[0]?.vocStatus).toBe('damaged');
  });

  it('beban langsung di baterai masuk pemakai bus', () => {
    const components = [place('bat1', 'battery'), place('load1', 'load-dc')];
    const wires = [wire('bat1.pos', 'load1.a'), wire('bat1.neg', 'load1.b')];
    expect(prepare(components, wires).consumers.map((consumer) => consumer.id)).toEqual(['load1']);
  });

  it('bank dari dua jenis baterai: tidak dihitung', () => {
    const components = [
      place('batA', 'battery'),
      place('batB', 'battery', BATTERY_LFP_24V_100AH),
      place('scc1', 'scc-pwm'),
    ];
    // Jenis kedua diberi id katalog lain supaya terbaca berbeda.
    const second = components[1];
    if (second) second.item = { ...second.item, id: 'bat-lain' };
    const wires = [
      wire('batA.neg', 'scc1.bat-neg'),
      wire('batA.pos', 'batB.neg'),
      wire('batB.pos', 'scc1.bat-pos'),
    ];
    expect(prepare(components, wires).bank).toBeUndefined();
  });

  it('SCC MPPT di bus: tidak dihitung', () => {
    const components = [place('mppt1', 'scc-mppt'), place('bat1', 'battery')];
    const prepared = prepare(components, pair('bat1', 'mppt1', 'bat'));
    expect(prepared.bank).toBeUndefined();
    expect(prepared.sccs).toEqual([]);
  });
});
