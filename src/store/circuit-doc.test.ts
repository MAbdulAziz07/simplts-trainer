import { describe, expect, it } from 'vitest';
import type { Wire } from '@/domain';
import {
  EMPTY_DOC,
  addPart,
  addWire,
  moveParts,
  openSwitches,
  nextId,
  patchWire,
  removeItems,
  rotateParts,
  toggleSwitch,
  type CircuitDoc,
} from './circuit-doc';

const PV = { id: 'pv-generic-100wp', category: 'pv-module' } as const;
const MCB = { id: 'mcb-dc-16a', category: 'mcb-dc' } as const;
const FUSE = { id: 'fuse-bat-100a', category: 'fuse' } as const;
const ITEMS = [PV, MCB, FUSE];
const findItem = (catalogId: string) => ITEMS.find((item) => item.id === catalogId);

const wireSpec = (from: string, to: string): Omit<Wire, 'id'> => ({
  from: { componentId: from, terminalId: 'pos' },
  to: { componentId: to, terminalId: 'pos-in' },
  cableId: 'cable-pv-h1z2z2k',
  areaMm2: 4,
  lengthM: 1,
});

/** c1 = panel, c2 = MCB, c3 = fuse; w1: c1 → c2, w2: c3 → c2. */
function sample(): CircuitDoc {
  let doc = EMPTY_DOC;
  for (const item of ITEMS) doc = addPart(doc, item, { xPx: 24, yPx: 48 }).doc;
  doc = addWire(doc, wireSpec('c1', 'c2')).doc;
  return addWire(doc, wireSpec('c3', 'c2')).doc;
}

describe('nextId', () => {
  it('melanjutkan nomor terbesar dan mengabaikan id lain', () => {
    expect(nextId('c', [])).toBe('c1');
    expect(nextId('c', ['c1', 'c7', 'pv1', 'c2'])).toBe('c8');
    expect(nextId('w', ['c9'])).toBe('w1');
  });
});

describe('addPart', () => {
  it('menaruh komponen tanpa rotasi di posisi yang diminta', () => {
    const { doc, id } = addPart(EMPTY_DOC, PV, { xPx: 120, yPx: 72 });
    expect(doc.components).toEqual([{ id, catalogId: PV.id, xPx: 120, yPx: 72, rotationDeg: 0 }]);
    expect(EMPTY_DOC.components).toEqual([]);
  });

  it('MCB terpasang OFF, fuse terpasang ON', () => {
    expect(sample().closedSwitchIds).toEqual(['c3']);
  });
});

describe('moveParts', () => {
  it('memindah hanya komponen yang disebut', () => {
    const doc = moveParts(sample(), [{ id: 'c2', xPx: 240, yPx: 96 }]);
    expect(doc.components.map((part) => [part.id, part.xPx, part.yPx])).toEqual([
      ['c1', 24, 48],
      ['c2', 240, 96],
      ['c3', 24, 48],
    ]);
  });

  it('mengembalikan dokumen yang sama bila posisi tidak berubah', () => {
    const doc = sample();
    expect(moveParts(doc, [{ id: 'c1', xPx: 24, yPx: 48 }])).toBe(doc);
    expect(moveParts(doc, [{ id: 'hilang', xPx: 0, yPx: 0 }])).toBe(doc);
  });
});

describe('rotateParts', () => {
  it('memutar 90° tiap kali dan kembali ke 0° setelah empat kali', () => {
    let doc = sample();
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      doc = rotateParts(doc, ['c1']);
      seen.push(doc.components[0]!.rotationDeg);
    }
    expect(seen).toEqual([90, 180, 270, 0]);
    expect(doc.components[1]!.rotationDeg).toBe(0);
  });

  it('mengembalikan dokumen yang sama bila tidak ada yang diputar', () => {
    const doc = sample();
    expect(rotateParts(doc, [])).toBe(doc);
  });
});

describe('removeItems', () => {
  it('menghapus komponen beserta kabelnya dan keadaan sakelarnya', () => {
    const doc = removeItems(sample(), ['c3'], []);
    expect(doc.components.map((part) => part.id)).toEqual(['c1', 'c2']);
    expect(doc.wires.map((wire) => wire.id)).toEqual(['w1']);
    expect(doc.closedSwitchIds).toEqual([]);
  });

  it('menghapus kabel saja', () => {
    const doc = removeItems(sample(), [], ['w1']);
    expect(doc.components).toHaveLength(3);
    expect(doc.wires.map((wire) => wire.id)).toEqual(['w2']);
  });

  it('mengembalikan dokumen yang sama bila tidak ada yang cocok', () => {
    const doc = sample();
    expect(removeItems(doc, ['hilang'], ['w9'])).toBe(doc);
  });
});

describe('patchWire', () => {
  it('mengubah penampang dan panjang satu kabel', () => {
    const doc = patchWire(sample(), 'w2', { areaMm2: 10, lengthM: 5 });
    expect(doc.wires[1]).toMatchObject({ id: 'w2', areaMm2: 10, lengthM: 5 });
    expect(doc.wires[0]).toMatchObject({ id: 'w1', areaMm2: 4, lengthM: 1 });
  });

  it('mengembalikan dokumen yang sama bila nilainya sama atau kabel tidak ada', () => {
    const doc = sample();
    expect(patchWire(doc, 'w1', { areaMm2: 4 })).toBe(doc);
    expect(patchWire(doc, 'w9', { areaMm2: 10 })).toBe(doc);
  });
});

describe('toggleSwitch', () => {
  it('membolak-balik MCB dan fuse', () => {
    const on = toggleSwitch(sample(), 'c2', findItem);
    expect(on.closedSwitchIds).toEqual(['c3', 'c2']);
    expect(toggleSwitch(on, 'c2', findItem).closedSwitchIds).toEqual(['c3']);
    expect(toggleSwitch(on, 'c3', findItem).closedSwitchIds).toEqual(['c2']);
  });

  it('mengabaikan komponen yang bukan sakelar', () => {
    const doc = sample();
    expect(toggleSwitch(doc, 'c1', findItem)).toBe(doc);
    expect(toggleSwitch(doc, 'hilang', findItem)).toBe(doc);
  });
});

describe('openSwitches', () => {
  it('membuka tuas yang disebut; yang sudah OFF atau tidak dikenal tidak mengubah dokumen', () => {
    const doc = sample();
    expect(openSwitches(doc, ['c3']).closedSwitchIds).toEqual([]);
    expect(openSwitches(doc, ['c2', 'hilang'])).toBe(doc);
    expect(doc.closedSwitchIds).toEqual(['c3']);
  });
});
