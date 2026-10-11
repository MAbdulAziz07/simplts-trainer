import { describe, expect, it } from 'vitest';
import { LANE_COUNT, wireLane, wirePath } from './wire-path';

describe('wirePath', () => {
  it('berawal dan berakhir tepat di kedua terminal', () => {
    const { d } = wirePath({ x: 10, y: 20, side: 'right' }, { x: 310, y: 120, side: 'left' });
    expect(d.startsWith('M 10,20 C ')).toBe(true);
    expect(d.endsWith(' 310,120')).toBe(true);
  });

  it('kabel antara dua terminal bawah yang sejajar menjuntai ke bawah', () => {
    const { midX, midY } = wirePath(
      { x: 0, y: 100, side: 'bottom' },
      { x: 200, y: 100, side: 'bottom' },
    );
    expect(midX).toBe(100);
    expect(midY).toBeGreaterThan(100 + 30);
  });

  it('kabel keluar tegak lurus dari sisi terminal', () => {
    const { d } = wirePath({ x: 0, y: 0, side: 'top' }, { x: 400, y: 0, side: 'right' });
    // Jangkauan 0,35 × 400 = 140 px: ke atas dari asal, ke kanan dari tujuan.
    expect(d).toBe('M 0,0 C 0,-140 540,0 400,0');
  });

  it('jangkauan lengkung dibatasi 40–160 px', () => {
    const short = wirePath({ x: 0, y: 0, side: 'bottom' }, { x: 10, y: 0, side: 'bottom' });
    expect(short.d).toBe('M 0,0 C 0,40 10,40 10,0');
    const long = wirePath({ x: 0, y: 0, side: 'bottom' }, { x: 2000, y: 0, side: 'bottom' });
    expect(long.d).toBe('M 0,0 C 0,160 2000,160 2000,0');
  });

  it('dua kabel sejajar di jalur berbeda tidak berimpit di tengah', () => {
    const a = wirePath({ x: 0, y: 100, side: 'bottom' }, { x: 200, y: 100, side: 'bottom' }, 1);
    const b = wirePath({ x: 30, y: 100, side: 'bottom' }, { x: 230, y: 100, side: 'bottom' }, 2);
    // Lebih dari lebar area klik kabel (16 px) pada dasar lengkungnya.
    expect(Math.abs(b.midY - a.midY)).toBeGreaterThan(10);
  });
});

describe('wireLane', () => {
  it('kabel bernomor urut menempati jalur berbeda', () => {
    expect(wireLane('w1')).not.toBe(wireLane('w2'));
    expect(new Set(['w1', 'w2', 'w3', 'w4', 'w5'].map(wireLane)).size).toBe(LANE_COUNT);
    expect(wireLane('w6')).toBe(wireLane('w1'));
  });

  it('id tanpa nomor memakai jalur 0', () => {
    expect(wireLane('kabel')).toBe(0);
  });
});
