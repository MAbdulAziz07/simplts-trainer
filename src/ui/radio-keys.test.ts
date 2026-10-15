import { describe, expect, it } from 'vitest';
import { nextRadioIndex } from './radio-keys';

describe('nextRadioIndex', () => {
  it('panah kanan/bawah maju dan berputar ke awal', () => {
    expect(nextRadioIndex('ArrowRight', 0, 3)).toBe(1);
    expect(nextRadioIndex('ArrowDown', 2, 3)).toBe(0);
  });

  it('panah kiri/atas mundur dan berputar ke akhir', () => {
    expect(nextRadioIndex('ArrowLeft', 1, 3)).toBe(0);
    expect(nextRadioIndex('ArrowUp', 0, 3)).toBe(2);
  });

  it('Home dan End ke ujung', () => {
    expect(nextRadioIndex('Home', 2, 3)).toBe(0);
    expect(nextRadioIndex('End', 0, 3)).toBe(2);
  });

  it('tombol lain dan kelompok kosong tidak memindah pilihan', () => {
    expect(nextRadioIndex('Enter', 0, 3)).toBeUndefined();
    expect(nextRadioIndex('ArrowRight', 0, 0)).toBeUndefined();
  });
});
