import { describe, expect, it } from 'vitest';
import { WIRE_AREAS_MM2 } from '@/store';
import { wireStrokePx } from './wire-style';

describe('wireStrokePx', () => {
  it('menebal bersama penampang (UX §2.3)', () => {
    expect(WIRE_AREAS_MM2.map(wireStrokePx)).toEqual([3, 3, 4, 4, 6, 6, 6]);
  });

  it('tidak pernah menipis saat penampang membesar', () => {
    const widths = [0.5, 1.5, 2.5, 3, 4, 6, 8, 10, 35].map(wireStrokePx);
    expect(widths).toEqual([...widths].sort((a, b) => a - b));
  });
});
