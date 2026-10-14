// Isi meja kerja sebagai objek biasa dan perubahannya sebagai fungsi murni: tiap fungsi
// mengembalikan dokumen baru, atau dokumen yang sama bila tidak ada yang berubah.
import { SWITCH_CATEGORIES, type CatalogItem, type ComponentParams, type Wire } from '@/domain';
import { ROTATIONS_DEG, type ProjectComponent } from '@/data';

/** Satu komponen di meja kerja; `id` unik per rangkaian, `catalogId` merujuk katalog. */
export type PlacedPart = ProjectComponent;

export interface CircuitDoc {
  components: PlacedPart[];
  wires: Wire[];
  /** MCB/fuse yang ON. */
  closedSwitchIds: string[];
}

export const EMPTY_DOC: CircuitDoc = { components: [], wires: [], closedSwitchIds: [] };

export interface PointPx {
  xPx: number;
  yPx: number;
}

export type PartMove = PointPx & { id: string };
export type WirePatch = Partial<Pick<Wire, 'cableId' | 'areaMm2' | 'lengthM'>>;

/** Id baru `<awalan><n>` dengan n di atas semua id berawalan sama yang sudah dipakai. */
export function nextId(prefix: string, usedIds: readonly string[]): string {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  const numbers = usedIds.map((id) => Number(pattern.exec(id)?.[1] ?? 0));
  return `${prefix}${Math.max(0, ...numbers) + 1}`;
}

/** Menaruh komponen baru. MCB terpasang OFF; fuse terpasang utuh (ON). */
export function addPart(
  doc: CircuitDoc,
  item: Pick<CatalogItem, 'id' | 'category'>,
  position: PointPx,
): { doc: CircuitDoc; id: string } {
  const id = nextId(
    'c',
    doc.components.map((part) => part.id),
  );
  const part: PlacedPart = { id, catalogId: item.id, ...position, rotationDeg: 0 };
  return {
    id,
    doc: {
      ...doc,
      components: [...doc.components, part],
      closedSwitchIds:
        item.category === 'fuse' ? [...doc.closedSwitchIds, id] : doc.closedSwitchIds,
    },
  };
}

export function moveParts(doc: CircuitDoc, moves: readonly PartMove[]): CircuitDoc {
  const moveById = new Map(moves.map((move) => [move.id, move]));
  let changed = false;
  const components = doc.components.map((part) => {
    const move = moveById.get(part.id);
    if (!move || (move.xPx === part.xPx && move.yPx === part.yPx)) return part;
    changed = true;
    return { ...part, xPx: move.xPx, yPx: move.yPx };
  });
  return changed ? { ...doc, components } : doc;
}

/** Memutar 90° searah jarum jam. */
export function rotateParts(doc: CircuitDoc, ids: readonly string[]): CircuitDoc {
  if (!doc.components.some((part) => ids.includes(part.id))) return doc;
  const components = doc.components.map((part) => {
    if (!ids.includes(part.id)) return part;
    const next = (ROTATIONS_DEG.indexOf(part.rotationDeg) + 1) % ROTATIONS_DEG.length;
    return { ...part, rotationDeg: ROTATIONS_DEG[next] ?? 0 };
  });
  return { ...doc, components };
}

/** Menghapus komponen beserta kabel yang menempel padanya, dan kabel yang disebut. */
export function removeItems(
  doc: CircuitDoc,
  componentIds: readonly string[],
  wireIds: readonly string[],
): CircuitDoc {
  const components = doc.components.filter((part) => !componentIds.includes(part.id));
  const wires = doc.wires.filter(
    (wire) =>
      !wireIds.includes(wire.id) &&
      !componentIds.includes(wire.from.componentId) &&
      !componentIds.includes(wire.to.componentId),
  );
  if (components.length === doc.components.length && wires.length === doc.wires.length) return doc;
  return {
    components,
    wires,
    closedSwitchIds: doc.closedSwitchIds.filter((id) => !componentIds.includes(id)),
  };
}

export function addWire(doc: CircuitDoc, wire: Omit<Wire, 'id'>): { doc: CircuitDoc; id: string } {
  const id = nextId(
    'w',
    doc.wires.map((existing) => existing.id),
  );
  return { id, doc: { ...doc, wires: [...doc.wires, { ...wire, id }] } };
}

export function patchWire(doc: CircuitDoc, wireId: string, patch: WirePatch): CircuitDoc {
  const current = doc.wires.find((wire) => wire.id === wireId);
  if (!current) return doc;
  const next = { ...current, ...patch };
  const same =
    next.cableId === current.cableId &&
    next.areaMm2 === current.areaMm2 &&
    next.lengthM === current.lengthM;
  return same ? doc : { ...doc, wires: doc.wires.map((wire) => (wire === current ? next : wire)) };
}

/** Setelan daya sebuah beban (W); komponen yang tidak ada atau setelan yang sama tidak mengubah. */
export function setPartPower(doc: CircuitDoc, id: string, powerSettingW: number): CircuitDoc {
  const current = doc.components.find((part) => part.id === id);
  if (!current || current.powerSettingW === powerSettingW) return doc;
  const components = doc.components.map((part) =>
    part === current ? { ...part, powerSettingW } : part,
  );
  return { ...doc, components };
}

/** Mengganti ubahan parameter sebuah komponen; `undefined` = kembali ke nilai katalog. */
export function setPartParams(
  doc: CircuitDoc,
  id: string,
  params: ComponentParams | undefined,
): CircuitDoc {
  const current = doc.components.find((part) => part.id === id);
  if (!current || sameParams(current.params, params)) return doc;
  const components = doc.components.map((part) => {
    if (part !== current) return part;
    return params ? { ...part, params: { ...params } } : withoutParams(part);
  });
  return { ...doc, components };
}

function withoutParams(part: PlacedPart): PlacedPart {
  const copy = { ...part };
  delete copy.params;
  return copy;
}

function sameParams(a: ComponentParams | undefined, b: ComponentParams | undefined): boolean {
  const aKeys = Object.keys(a ?? {});
  return (
    aKeys.length === Object.keys(b ?? {}).length && aKeys.every((key) => a?.[key] === b?.[key])
  );
}

/** Setelan daya tiap beban yang sudah diatur; beban tanpa setelan bekerja pada daya maksimum. */
export function loadPowerSettings(doc: CircuitDoc): Record<string, number> {
  const settings: Record<string, number> = {};
  for (const part of doc.components) {
    if (part.powerSettingW !== undefined) settings[part.id] = part.powerSettingW;
  }
  return settings;
}

/** Membuka (OFF) tuas yang disebut, mis. setelah trip; yang sudah OFF tidak berubah. */
export function openSwitches(doc: CircuitDoc, ids: readonly string[]): CircuitDoc {
  const closedSwitchIds = doc.closedSwitchIds.filter((id) => !ids.includes(id));
  return closedSwitchIds.length === doc.closedSwitchIds.length ? doc : { ...doc, closedSwitchIds };
}

/** ON ↔ OFF untuk MCB/fuse; komponen lain tidak berubah. */
export function toggleSwitch(
  doc: CircuitDoc,
  id: string,
  findItem: (catalogId: string) => Pick<CatalogItem, 'category'> | undefined,
): CircuitDoc {
  const part = doc.components.find((candidate) => candidate.id === id);
  const category = part && findItem(part.catalogId)?.category;
  if (!category || !SWITCH_CATEGORIES.includes(category)) return doc;
  const closedSwitchIds = doc.closedSwitchIds.includes(id)
    ? doc.closedSwitchIds.filter((closedId) => closedId !== id)
    : [...doc.closedSwitchIds, id];
  return { ...doc, closedSwitchIds };
}

/**
 * Mengganti varian sebuah komponen (mis. MCB DC 16 A → 32 A). Kabel tetap di terminal yang disebut
 * `keptTerminalIds`; kabel di terminal lain dilepas. Tuas kembali OFF; ubahan parameter dibuang.
 */
export function replaceVariant(
  doc: CircuitDoc,
  id: string,
  catalogId: string,
  keptTerminalIds: readonly string[],
): CircuitDoc {
  const current = doc.components.find((part) => part.id === id);
  if (!current || current.catalogId === catalogId) return doc;
  const keeps = (end: Wire['from']) =>
    end.componentId !== id || keptTerminalIds.includes(end.terminalId);
  return {
    // Ubahan parameter milik varian lama tidak dibawa ke varian baru.
    components: doc.components.map((part) =>
      part === current ? { ...withoutParams(part), catalogId } : part,
    ),
    wires: doc.wires.filter((wire) => keeps(wire.from) && keeps(wire.to)),
    closedSwitchIds: doc.closedSwitchIds.filter((closedId) => closedId !== id),
  };
}
