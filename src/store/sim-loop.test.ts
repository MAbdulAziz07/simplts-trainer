import { describe, expect, it } from 'vitest';
import { createFrameAccumulator, startFrameLoop } from './sim-loop';

describe('createFrameAccumulator', () => {
  it('mengumpulkan bingkai 16 ms sampai satu hitungan 50 ms', () => {
    const accumulator = createFrameAccumulator(0.05, 0.25);
    expect(accumulator.push(1000)).toBe(0);
    expect(accumulator.push(1016)).toBe(0);
    expect(accumulator.push(1032)).toBe(0);
    expect(accumulator.push(1048)).toBe(0);
    expect(accumulator.push(1064)).toBeCloseTo(0.064, 9);
    expect(accumulator.push(1080)).toBe(0);
  });

  it('jeda panjang (tab tersembunyi) dijepit ke batas bingkai', () => {
    const accumulator = createFrameAccumulator(0.05, 0.25);
    accumulator.push(0);
    expect(accumulator.push(60_000)).toBeCloseTo(0.25, 9);
  });
});

describe('startFrameLoop', () => {
  it('di luar browser tidak berjalan dan penghentinya aman dipanggil', () => {
    let ticks = 0;
    const stop = startFrameLoop(() => (ticks += 1));
    stop();
    expect(ticks).toBe(0);
  });
});
