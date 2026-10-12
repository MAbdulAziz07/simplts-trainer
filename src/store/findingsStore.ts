// Temuan pemeriksaan rangkaian (`validateCircuit`) dan riwayat pemasangan kabel yang dipakai
// aturan urutan kerja. Diperbarui tiap rangkaian berubah; selama simulasi berjalan juga dua kali
// per detik dengan arus terukur.
import { create } from 'zustand';
import { validateCircuit, type Finding, type Wire, type WiringEvent } from '@/domain';
import { cableItems, toPlacedComponents } from './catalog';
import type { CircuitDoc } from './circuit-doc';
import { useCircuitStore } from './circuitStore';
import { sameCircuit } from './sim-reconcile';
import { useSimStore } from './simStore';

/** Jarak antarpemeriksaan selama simulasi berjalan. */
export const FINDINGS_INTERVAL_MS = 500;
/** Riwayat pemasangan yang disimpan; yang lebih lama dibuang. */
export const WIRING_LOG_LIMIT = 200;

export interface FindingsState {
  findings: Finding[];
  /** Kabel yang dipasang dan dilepas sejak rangkaian ini dimuat, urut waktu. */
  wiringLog: WiringEvent[];
  /** Memeriksa ulang rangkaian di meja kerja. */
  refresh: () => void;
}

/** Kejadian pasang/lepas kabel antara dua keadaan meja kerja. */
export function wiringEventsBetween(previous: CircuitDoc, next: CircuitDoc): WiringEvent[] {
  if (previous.wires === next.wires) return [];
  const ids = (wires: readonly Wire[]) => new Set(wires.map((wire) => wire.id));
  const [before, after] = [ids(previous.wires), ids(next.wires)];
  const { closedSwitchIds } = next;
  return [
    ...previous.wires
      .filter((wire) => !after.has(wire.id))
      .map((wire): WiringEvent => ({ action: 'disconnect', wire, closedSwitchIds })),
    ...next.wires
      .filter((wire) => !before.has(wire.id))
      .map((wire): WiringEvent => ({ action: 'connect', wire, closedSwitchIds })),
  ];
}

function check(wiringLog: readonly WiringEvent[]): Finding[] {
  const { doc } = useCircuitStore.getState();
  const sim = useSimStore.getState();
  // Arus terukur hanya dipakai saat simulasi berjalan; saat jeda dipakai taksiran statis, supaya
  // salah rangkai terlihat sebelum rangkaian dihidupkan.
  const measured = sim.running
    ? {
        currentAByWireId: sim.snapshot.operatingPoint.currentAByWireId,
        currentAByComponentId: sim.snapshot.operatingPoint.currentAByComponentId,
      }
    : {};
  return validateCircuit({
    components: toPlacedComponents(doc),
    wires: doc.wires,
    cables: cableItems,
    closedSwitchIds: doc.closedSwitchIds,
    ambientTempC: sim.environment.ambientTempC,
    wiringLog,
    ...measured,
  });
}

export const useFindingsStore = create<FindingsState>()((set, get) => ({
  findings: check([]),
  wiringLog: [],
  refresh: () => {
    const findings = check(get().wiringLog);
    // Hasil yang sama tidak mengganti state, jadi tampilan tidak digambar ulang.
    if (JSON.stringify(findings) !== JSON.stringify(get().findings)) set({ findings });
  },
}));

useCircuitStore.subscribe((circuit, previous) => {
  if (circuit.loadCount !== previous.loadCount) {
    useFindingsStore.setState({ wiringLog: [] });
  } else if (!sameCircuit(circuit.doc, previous.doc)) {
    const events = wiringEventsBetween(previous.doc, circuit.doc);
    if (events.length > 0) {
      const wiringLog = [...useFindingsStore.getState().wiringLog, ...events];
      useFindingsStore.setState({ wiringLog: wiringLog.slice(-WIRING_LOG_LIMIT) });
    }
  } else {
    return;
  }
  useFindingsStore.getState().refresh();
});

let lastCheckMs = 0;
useSimStore.subscribe((sim, previous) => {
  // Reset percobaan menghapus riwayat pemasangan, jadi temuan urutan kerja ikut hilang.
  if (sim.resetCount !== previous.resetCount) {
    lastCheckMs = Date.now();
    useFindingsStore.setState({ wiringLog: [] });
    useFindingsStore.getState().refresh();
    return;
  }
  // Putar/jeda dan suhu lingkungan (KHA kabel) langsung diperiksa; selebihnya dua kali per detik.
  const immediate =
    sim.running !== previous.running ||
    (!sim.running && sim.environment.ambientTempC !== previous.environment.ambientTempC);
  if (!immediate && (!sim.running || sim.snapshot === previous.snapshot)) return;
  const nowMs = Date.now();
  if (!immediate && nowMs - lastCheckMs < FINDINGS_INTERVAL_MS) return;
  lastCheckMs = nowMs;
  useFindingsStore.getState().refresh();
});
