import { describe, expect, it } from 'vitest';
import { catalogItems } from '@/store';
import { draftFromItem, isSameDraft, placedCount, siblingItems } from './positions';

const item = (id: string) => catalogItems.find((candidate) => candidate.id === id)!;

describe('draf posisi', () => {
  it('posisi (0, 0) di katalog dibaca sebagai belum ditandai', () => {
    const draft = draftFromItem({
      terminals: [
        { id: 'pos', label: '+', kind: 'dc+', xPct: 0, yPct: 0, maxWires: 1 },
        { id: 'neg', label: '−', kind: 'dc-', xPct: 80, yPct: 12.5, maxWires: 1 },
      ],
    });
    expect(draft).toEqual({ pos: undefined, neg: { xPct: 80, yPct: 12.5 } });
    expect(placedCount(draft)).toBe(1);
  });

  it('membandingkan dua draf menurut isinya', () => {
    const a = { pos: { xPct: 10, yPct: 20 }, neg: undefined };
    expect(isSameDraft(a, { pos: { xPct: 10, yPct: 20 }, neg: undefined })).toBe(true);
    expect(isSameDraft(a, { pos: { xPct: 10, yPct: 21 }, neg: undefined })).toBe(false);
    expect(isSameDraft(a, { pos: { xPct: 10, yPct: 20 }, neg: { xPct: 1, yPct: 1 } })).toBe(false);
  });
});

describe('siblingItems', () => {
  it('ketujuh panel surya berbagi gambar dan terminal', () => {
    const siblings = siblingItems(item('pv-generic-100wp'), catalogItems);
    expect(siblings).toHaveLength(6);
    expect(siblings.every((sibling) => sibling.category === 'pv-module')).toBe(true);
  });

  it('gambar sama tetapi terminal berbeda bukan saudara', () => {
    // LiFePO4 24 V punya terminal `bms`, yang 48 V punya `can`.
    expect(siblingItems(item('bat-lfp-25v6-100ah'), catalogItems)).toEqual([]);
  });

  it('item bergambar sendiri tidak punya saudara', () => {
    expect(siblingItems(item('scc-pwm-rbl-20a'), catalogItems)).toEqual([]);
  });
});
