// Gangguan tersembunyi mode Cari Gangguan. Gangguan tidak mengubah meja kerja: ia hanya mengubah
// masukan simulasi (rangkaian, setelan, keadaan) dan menyamarkan tanda yang terlalu jelas.
import type { PlacedComponent, Wire } from '../circuit/types';
import type { SimControls, SimState, Snapshot } from '../engine/step-types';
import { wireResistanceOhm } from '../engine/wire-flow';
import { applyParams } from '../catalog/param-apply';
import type { CableItem, CatalogItem, ComponentCategory } from '../types';
import { FAULT_KINDS, type Fault, type FaultKind } from './types';

/** Bagian modul yang teduh bila tidak disebut. [PERLU VERIFIKASI] */
export const DEFAULT_SHADED_FRACTION = 0.7;
/** Resistansi kontak MC4 longgar; kontak baik < 0,5 mΩ. [PERLU VERIFIKASI] */
export const DEFAULT_LOOSE_CONTACT_OHM = 0.5;
/** Sel lemah: kapasitas tersisa, kelipatan resistansi dalam, dan turunnya OCV. [PERLU VERIFIKASI] */
export const WEAK_CELL_CAPACITY_FACTOR = 0.3;
export const WEAK_CELL_RESISTANCE_FACTOR = 5;
export const WEAK_CELL_OCV_DROP_V = 0.6;
/** Arus pengenal MCB salah bila tidak disebut: seperempat arus aslinya, minimal 1 A. */
export const WRONG_RATING_FRACTION = 0.25;

/** Kategori sasaran tiap jenis gangguan; `wire` = sasarannya kabel. */
export const FAULT_TARGETS: Readonly<Record<FaultKind, readonly ComponentCategory[] | 'wire'>> = {
  'wire-open': 'wire',
  'fuse-blown': ['fuse'],
  'mc4-loose': 'wire',
  'pv-shaded': ['pv-module'],
  'battery-weak-cell': ['battery'],
  'scc-setting-wrong': ['scc-pwm'],
  'mcb-wrong-rating': ['mcb-dc', 'mcb-ac'],
  'grid-outage': ['grid'],
};

const hasKind = (faults: readonly Fault[], kind: FaultKind, target: string) =>
  faults.some((fault) => fault.kind === kind && fault.target === target);

function weakBattery(item: CatalogItem): CatalogItem {
  if (item.category !== 'battery') return item;
  const { electrical } = item;
  return {
    ...item,
    electrical: {
      ...electrical,
      capacityAh: electrical.capacityAh * WEAK_CELL_CAPACITY_FACTOR,
      internalResistanceMohm: electrical.internalResistanceMohm * WEAK_CELL_RESISTANCE_FACTOR,
      modelParams: {
        ...electrical.modelParams,
        ocvV: electrical.modelParams.ocvV.map((voltageV) => voltageV - WEAK_CELL_OCV_DROP_V),
      },
    },
  };
}

function wrongRating(item: CatalogItem, value: number | undefined): CatalogItem {
  if (item.category !== 'mcb-dc' && item.category !== 'mcb-ac') return item;
  const ratedA =
    value ?? Math.max(1, Math.round(item.electrical.ratedCurrentA * WRONG_RATING_FRACTION));
  return applyParams(item, { ratedA });
}

function looseWire(wire: Wire, cables: readonly CableItem[], contactOhm: number): Wire {
  const cable = cables.find((candidate) => candidate.id === wire.cableId);
  const ohmPerM = wireResistanceOhm({ areaMm2: wire.areaMm2, lengthM: 1 }, cable, 20);
  return ohmPerM > 0 ? { ...wire, lengthM: wire.lengthM + contactOhm / ohmPerM } : wire;
}

export interface FaultedCircuit {
  components: PlacedComponent[];
  wires: Wire[];
}

/**
 * Rangkaian yang dihitung simulasi: kabel putus dibuang, kontak longgar menjadi panjang kabel
 * tambahan yang setara, baterai bersel lemah dan MCB salah rating memakai parameter palsu.
 */
export function applyFaultsToCircuit(
  components: readonly PlacedComponent[],
  wires: readonly Wire[],
  cables: readonly CableItem[],
  faults: readonly Fault[],
): FaultedCircuit {
  if (faults.length === 0) return { components: [...components], wires: [...wires] };
  return {
    components: components.map((component) => {
      let item = component.item;
      if (hasKind(faults, 'battery-weak-cell', component.id)) item = weakBattery(item);
      const rating = faults.find((f) => f.kind === 'mcb-wrong-rating' && f.target === component.id);
      if (rating) item = wrongRating(item, rating.value);
      return item === component.item ? component : { ...component, item };
    }),
    wires: wires
      .filter((wire) => !hasKind(faults, 'wire-open', wire.id))
      .map((wire) => {
        const loose = faults.find((f) => f.kind === 'mc4-loose' && f.target === wire.id);
        return loose ? looseWire(wire, cables, loose.value ?? DEFAULT_LOOSE_CONTACT_OHM) : wire;
      }),
  };
}

/** Setelan simulasi dengan modul teduh dan jaringan padam. */
export function applyFaultsToControls(
  controls: SimControls,
  faults: readonly Fault[],
): SimControls {
  const shaded = faults.filter((fault) => fault.kind === 'pv-shaded');
  const outages = faults.filter((fault) => fault.kind === 'grid-outage');
  if (shaded.length === 0 && outages.length === 0) return controls;
  return {
    ...controls,
    shadedFractionByPvId: {
      ...controls.shadedFractionByPvId,
      ...Object.fromEntries(shaded.map((f) => [f.target, f.value ?? DEFAULT_SHADED_FRACTION])),
    },
    gridAvailableById: {
      ...controls.gridAvailableById,
      ...Object.fromEntries(outages.map((fault) => [fault.target, false])),
    },
  };
}

/**
 * Keadaan masukan langkah: fuse putus tersembunyi, dan SCC yang mengira sistem 24 V
 * (`voltageScale`) pada baterai 12 V.
 */
export function applyFaultsToState(
  state: SimState,
  components: readonly PlacedComponent[],
  faults: readonly Fault[],
): SimState {
  let next = state;
  for (const fault of faults) {
    if (fault.kind === 'fuse-blown' && !next.blownFuseIds.includes(fault.target)) {
      next = { ...next, blownFuseIds: [...next.blownFuseIds, fault.target] };
    }
    const scc = components.find((component) => component.id === fault.target)?.item;
    if (fault.kind === 'scc-setting-wrong' && scc?.category === 'scc-pwm') {
      const current = next.sccById[fault.target] ?? {
        stage: 'bulk',
        absorptionElapsedS: 0,
        loadConnected: true,
      };
      const voltageScale = scc.electrical.voltageScale24V;
      next = {
        ...next,
        sccById: { ...next.sccById, [fault.target]: { ...current, voltageScale } },
      };
    }
  }
  return next;
}

/**
 * Keadaan hasil langkah tanpa jejak gangguan, supaya gangguan bisa dicabut kapan saja: fuse dan
 * skala tegangan SCC kembali seperti sebelum langkah.
 */
export function stripFaultState(
  result: SimState,
  before: SimState,
  faults: readonly Fault[],
): SimState {
  let next = result;
  for (const fault of faults) {
    if (fault.kind === 'fuse-blown' && !before.blownFuseIds.includes(fault.target)) {
      next = { ...next, blownFuseIds: next.blownFuseIds.filter((id) => id !== fault.target) };
    }
    const scc = next.sccById[fault.target];
    if (fault.kind === 'scc-setting-wrong' && scc) {
      const original = before.sccById[fault.target]?.voltageScale;
      const restored = { ...scc, voltageScale: original };
      if (original === undefined) delete restored.voltageScale;
      next = { ...next, sccById: { ...next.sccById, [fault.target]: restored } };
    }
  }
  return next;
}

/** Snapshot yang ditampilkan: fuse yang putus karena gangguan tetap tampak utuh. */
export function maskFaultSnapshot(snapshot: Snapshot, faults: readonly Fault[]): Snapshot {
  const hidden = faults.filter(
    (fault) =>
      fault.kind === 'fuse-blown' && snapshot.components[fault.target]?.condition === 'blown',
  );
  if (hidden.length === 0) return snapshot;
  const components = { ...snapshot.components };
  for (const { target } of hidden) components[target] = { ...components[target], condition: 'ok' };
  return { ...snapshot, components };
}

function isPvWire(wire: Wire, components: readonly PlacedComponent[]): boolean {
  return [wire.from, wire.to].some(({ componentId, terminalId }) => {
    const item = components.find((component) => component.id === componentId)?.item;
    const kind = item?.terminals.find((terminal) => terminal.id === terminalId)?.kind;
    return kind === 'pv+' || kind === 'pv-';
  });
}

/** Semua gangguan yang bisa dipasang pada rangkaian ini, urut jenis lalu sasaran. */
export function faultCandidates(
  components: readonly PlacedComponent[],
  wires: readonly Wire[],
): Fault[] {
  return FAULT_KINDS.flatMap((kind): Fault[] => {
    const targets = FAULT_TARGETS[kind];
    if (targets === 'wire') {
      const usable = kind === 'mc4-loose' ? wires.filter((w) => isPvWire(w, components)) : wires;
      return usable.map((wire) => ({ kind, target: wire.id }));
    }
    return components
      .filter(({ item }) => targets.includes(item.category))
      .map((component) => ({ kind, target: component.id }));
  });
}

/**
 * Memilih `count` gangguan secara acak; jenisnya diusahakan berbeda. `random` memberi 0..1
 * (seperti `Math.random`), jadi hasilnya bisa diulang dalam uji.
 */
export function pickFaults(
  candidates: readonly Fault[],
  count: number,
  random: () => number,
): Fault[] {
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j] as Fault, shuffled[i] as Fault];
  }
  const picked: Fault[] = [];
  for (const fault of shuffled) {
    if (picked.length >= count) break;
    if (!picked.some((other) => other.kind === fault.kind)) picked.push(fault);
  }
  for (const fault of shuffled) {
    if (picked.length >= count) break;
    if (!picked.includes(fault)) picked.push(fault);
  }
  return picked;
}

/** `true` bila jawaban peserta (jenis + kabel atau komponen yang ditunjuk) cocok dengan gangguan. */
export function diagnosisMatches(fault: Fault, kind: FaultKind, locationId: string): boolean {
  return fault.kind === kind && fault.target === locationId;
}
