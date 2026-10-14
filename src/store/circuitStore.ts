// State rangkaian di meja kerja: komponen, kabel, MCB ON/OFF, pilihan, dan riwayat undo/redo.
// Aturan sambungan dihitung domain (`checkConnection`); store hanya menyimpan hasilnya.
import { create } from 'zustand';
import {
  checkConnection,
  familyOf,
  loadSnapPowerW,
  retainedTerminalIds,
  type ConnectionCheck,
  type ConnectionLevel,
  type ParamIssue,
  type PackageId,
  type TerminalRef,
} from '@/domain';
import type { ProjectFile } from '@/data';
import {
  cableItems,
  catalogItems,
  effectiveItem,
  findCatalogItem,
  toPlacedComponents,
} from './catalog';
import {
  EMPTY_DOC,
  addPart,
  addWire,
  moveParts,
  openSwitches,
  patchWire,
  removeItems,
  replaceVariant,
  rotateParts,
  setPartPower,
  toggleSwitch,
  type CircuitDoc,
  type PartMove,
  type PointPx,
  type WirePatch,
} from './circuit-doc';
import { withParam, withoutParam } from './param-edit';
import { emptyHistory, record, redo, undo, type History } from './history';
import {
  browserStorage,
  docToProject,
  projectToDoc,
  readAutosave,
  writeAutosave,
} from './project-io';
import { clampWireLengthM, defaultWireSpec, nearestAreaMm2 } from './wire-defaults';

export interface CircuitState {
  /** Paket alat yang isinya tampil di baki. */
  packageId: PackageId;
  /** Tingkat validasi sambungan: Pemula atau Mahir. */
  level: ConnectionLevel;
  doc: CircuitDoc;
  history: History<CircuitDoc>;
  /** Dokumen saat sebuah seretan dimulai; selama terisi, perubahan belum masuk riwayat. */
  gestureStart?: CircuitDoc;
  selectedComponentIds: string[];
  selectedWireIds: string[];
  /** Naik tiap kali rangkaian lain dimuat; meja kerja memaskan tampilan saat nilainya berubah. */
  loadCount: number;

  setPackage: (packageId: PackageId) => void;
  setLevel: (level: ConnectionLevel) => void;
  /** Mengembalikan id komponen baru, atau `undefined` bila item tidak bisa ditaruh. */
  addComponent: (catalogId: string, position: PointPx) => string | undefined;
  beginGesture: () => void;
  moveComponents: (moves: readonly PartMove[]) => void;
  endGesture: () => void;
  rotateSelected: () => void;
  removeSelected: () => void;
  /** Memasang kabel bila aturan sambungan mengizinkan; hasil pemeriksaan dikembalikan. */
  connect: (from: TerminalRef, to: TerminalRef) => ConnectionCheck;
  updateWire: (wireId: string, patch: WirePatch) => void;
  /** Setelan daya beban, dibulatkan ke langkah katalog dan dibatasi rentang bebannya. */
  setLoadPower: (componentId: string, powerSettingW: number) => void;
  /** Mengganti varian dalam keluarga yang sama (MCB, panel); satu langkah undo. */
  setVariant: (componentId: string, catalogId: string) => void;
  /**
   * Mengubah satu parameter (kunci `PARAM_SPECS`); nilai sama dengan katalog menghapus ubahannya.
   * Ubahan yang tidak sah tidak disimpan dan masalahnya dikembalikan.
   */
  setParam: (componentId: string, key: string, value: number | string) => ParamIssue[];
  /** Kembali ke nilai katalog: satu parameter, atau semua bila `key` tidak diberikan. */
  resetParams: (componentId: string, key?: string) => void;
  toggleSwitch: (componentId: string) => void;
  /** Tuas pindah ke OFF karena trip; bukan tindakan pengguna, jadi tidak masuk riwayat undo. */
  openSwitches: (componentIds: readonly string[]) => void;
  select: (componentIds: readonly string[], wireIds: readonly string[]) => void;
  undo: () => void;
  redo: () => void;
  /** Mengganti isi meja; bisa dibatalkan dengan undo. */
  loadProject: (project: ProjectFile) => void;
  clear: () => void;
}

const NO_SELECTION = { selectedComponentIds: [], selectedWireIds: [] };

const storage = browserStorage();
const saved = readAutosave(storage, catalogItems);

export const useCircuitStore = create<CircuitState>()((set, get) => {
  /** Mengganti dokumen dan mencatat yang lama di riwayat, kecuali di tengah seretan. */
  const commit = (doc: CircuitDoc): void => {
    const state = get();
    if (doc === state.doc) return;
    const exists = (ids: string[], items: { id: string }[]) =>
      ids.filter((id) => items.some((item) => item.id === id));
    set({
      doc,
      history: state.gestureStart ? state.history : record(state.history, state.doc),
      selectedComponentIds: exists(state.selectedComponentIds, doc.components),
      selectedWireIds: exists(state.selectedWireIds, doc.wires),
    });
  };

  return {
    packageId: saved?.project.packageId ?? 'min',
    level: saved?.level ?? 'beginner',
    doc: saved ? projectToDoc(saved.project) : EMPTY_DOC,
    history: emptyHistory(),
    selectedComponentIds: [],
    selectedWireIds: [],
    loadCount: saved ? 1 : 0,

    setPackage: (packageId) => set({ packageId }),
    setLevel: (level) => set({ level }),

    addComponent: (catalogId, position) => {
      const item = findCatalogItem(catalogId);
      if (!item || item.category === 'cable') return undefined;
      const { doc, id } = addPart(get().doc, item, position);
      commit(doc);
      set({ selectedComponentIds: [id], selectedWireIds: [] });
      return id;
    },

    beginGesture: () => set({ gestureStart: get().doc }),
    moveComponents: (moves) => commit(moveParts(get().doc, moves)),
    endGesture: () => {
      const { gestureStart, doc, history } = get();
      if (!gestureStart) return;
      set({
        gestureStart: undefined,
        history: doc === gestureStart ? history : record(history, gestureStart),
      });
    },

    rotateSelected: () => commit(rotateParts(get().doc, get().selectedComponentIds)),
    removeSelected: () => {
      const { doc, selectedComponentIds, selectedWireIds } = get();
      commit(removeItems(doc, selectedComponentIds, selectedWireIds));
    },

    connect: (from, to) => {
      const { doc, level } = get();
      const components = toPlacedComponents(doc);
      const check = checkConnection({ components, wires: doc.wires, from, to, level });
      const origin = components
        .find((component) => component.id === from.componentId)
        ?.item.terminals.find((terminal) => terminal.id === from.terminalId);
      if (!check.ok || !origin) return check;
      const spec = defaultWireSpec(origin.kind, cableItems);
      commit(addWire(doc, { from, to, ...spec }).doc);
      return check;
    },

    updateWire: (wireId, patch) => {
      const { doc } = get();
      const wire = doc.wires.find((candidate) => candidate.id === wireId);
      const cable = cableItems.find((item) => item.id === (patch.cableId ?? wire?.cableId));
      if (!wire || !cable) return;
      commit(
        patchWire(doc, wireId, {
          cableId: cable.id,
          areaMm2: nearestAreaMm2(cable, patch.areaMm2 ?? wire.areaMm2),
          lengthM: clampWireLengthM(patch.lengthM ?? wire.lengthM),
        }),
      );
    },

    setLoadPower: (componentId, powerSettingW) => {
      const { doc } = get();
      const part = doc.components.find((candidate) => candidate.id === componentId);
      const item = part && effectiveItem(part);
      if (item?.category !== 'load-dc' && item?.category !== 'load-ac') return;
      commit(setPartPower(doc, componentId, loadSnapPowerW(item.electrical, powerSettingW)));
    },

    setVariant: (componentId, catalogId) => {
      const { doc } = get();
      const part = doc.components.find((candidate) => candidate.id === componentId);
      const from = part && findCatalogItem(part.catalogId);
      const to = findCatalogItem(catalogId);
      const family = from && familyOf(from.category);
      if (!from || !to || !family || familyOf(to.category) !== family) return;
      commit(replaceVariant(doc, componentId, catalogId, retainedTerminalIds(from, to)));
    },

    setParam: (componentId, key, value) => {
      const { doc, issues } = withParam(get().doc, componentId, key, value);
      commit(doc);
      return issues;
    },
    resetParams: (componentId, key) => commit(withoutParam(get().doc, componentId, key)),

    toggleSwitch: (componentId) => commit(toggleSwitch(get().doc, componentId, findCatalogItem)),
    openSwitches: (componentIds) => set({ doc: openSwitches(get().doc, componentIds) }),

    select: (componentIds, wireIds) =>
      set({ selectedComponentIds: [...componentIds], selectedWireIds: [...wireIds] }),

    undo: () => {
      const { history, doc, gestureStart } = get();
      const step = gestureStart ? undefined : undo(history, doc);
      if (step) set({ doc: step.current, history: step.history, ...NO_SELECTION });
    },
    redo: () => {
      const { history, doc, gestureStart } = get();
      const step = gestureStart ? undefined : redo(history, doc);
      if (step) set({ doc: step.current, history: step.history, ...NO_SELECTION });
    },

    loadProject: (project) => {
      set({ packageId: project.packageId, gestureStart: undefined });
      commit(projectToDoc(project));
      set({ ...NO_SELECTION, loadCount: get().loadCount + 1 });
    },
    clear: () => commit(EMPTY_DOC),
  };
});

// Simpan otomatis tiap perubahan; seretan disimpan sekali saat selesai.
useCircuitStore.subscribe((state, previous) => {
  if (state.gestureStart) return;
  const changed =
    state.doc !== previous.doc ||
    state.packageId !== previous.packageId ||
    state.level !== previous.level ||
    state.gestureStart !== previous.gestureStart;
  if (!changed) return;
  writeAutosave(storage, {
    project: docToProject(state.doc, state.packageId),
    level: state.level,
  });
});
