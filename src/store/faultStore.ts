// Gangguan tersembunyi yang sedang aktif (mode Cari Gangguan) dan rangkaian yang dihitung
// simulasi dan alat ukur setelah gangguan diterapkan. Meja kerja tidak ikut berubah.
import { create } from 'zustand';
import {
  applyFaultsToCircuit,
  type Fault,
  type FaultedCircuit,
  type PlacedComponent,
  type Wire,
} from '@/domain';
import { cableItems, toPlacedComponents } from './catalog';
import type { CircuitDoc } from './circuit-doc';

export interface FaultState {
  faults: Fault[];
  setFaults: (faults: readonly Fault[]) => void;
}

const NO_FAULTS: Fault[] = [];

export const useFaultStore = create<FaultState>()((set) => ({
  faults: NO_FAULTS,
  setFaults: (faults) => set({ faults: faults.length === 0 ? NO_FAULTS : [...faults] }),
}));

// Kunci = dokumen meja kerja lalu daftar gangguan, supaya hasilnya tetap sama selama keduanya sama.
const faultedByDoc = new WeakMap<CircuitDoc, WeakMap<readonly Fault[], FaultedCircuit>>();

/** Komponen dan kabel yang dihitung simulasi: meja kerja dengan gangguan diterapkan. */
export function faultedCircuit(
  doc: CircuitDoc,
  faults: readonly Fault[],
): { components: readonly PlacedComponent[]; wires: readonly Wire[] } {
  const components = toPlacedComponents(doc);
  if (faults.length === 0) return { components, wires: doc.wires };
  let byFaults = faultedByDoc.get(doc);
  if (!byFaults) faultedByDoc.set(doc, (byFaults = new WeakMap()));
  let circuit = byFaults.get(faults);
  if (!circuit) {
    circuit = applyFaultsToCircuit(components, doc.wires, cableItems, faults);
    byFaults.set(faults, circuit);
  }
  return circuit;
}
