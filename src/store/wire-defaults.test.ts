import { describe, expect, it } from 'vitest';
import { cableItems } from './catalog';
import {
  DEFAULT_WIRE_LENGTH_M,
  WIRE_AREAS_MM2,
  WIRE_LENGTH_MAX_M,
  WIRE_LENGTH_MIN_M,
  cableAreasMm2,
  clampWireLengthM,
  defaultWireSpec,
  nearestAreaMm2,
} from './wire-defaults';

const pvCable = cableItems.find((cable) => cable.id === 'cable-pv-h1z2z2k')!;
const nyyCable = cableItems.find((cable) => cable.id === 'cable-nyy-2core')!;

describe('cableAreasMm2', () => {
  it('NYY menyediakan ketujuh penampang, kabel PV mulai 2,5 mm²', () => {
    expect(cableAreasMm2(nyyCable)).toEqual([...WIRE_AREAS_MM2]);
    expect(cableAreasMm2(pvCable)).toEqual([2.5, 4, 6, 10, 16, 25]);
  });
});

describe('nearestAreaMm2', () => {
  it('mempertahankan penampang yang ada di tabel', () => {
    expect(nearestAreaMm2(pvCable, 6)).toBe(6);
  });

  it('menggeser ke penampang terdekat yang tersedia', () => {
    expect(nearestAreaMm2(pvCable, 1.5)).toBe(2.5);
    expect(nearestAreaMm2(nyyCable, 35)).toBe(25);
  });
});

describe('clampWireLengthM', () => {
  it('membulatkan ke langkah 0,5 m dan menjaga batas', () => {
    expect(clampWireLengthM(2.3)).toBe(2.5);
    expect(clampWireLengthM(0)).toBe(WIRE_LENGTH_MIN_M);
    expect(clampWireLengthM(-3)).toBe(WIRE_LENGTH_MIN_M);
    expect(clampWireLengthM(1e6)).toBe(WIRE_LENGTH_MAX_M);
    expect(clampWireLengthM(Number.NaN)).toBe(DEFAULT_WIRE_LENGTH_M);
  });
});

describe('defaultWireSpec', () => {
  it.each(['pv+', 'pv-', 'dc+', 'dc-'] as const)('%s memakai kabel DC 4 mm²', (kind) => {
    expect(defaultWireSpec(kind, cableItems)).toEqual({
      cableId: 'cable-pv-h1z2z2k',
      areaMm2: 4,
      lengthM: DEFAULT_WIRE_LENGTH_M,
    });
  });

  it.each(['acL', 'acN', 'pe', 'data'] as const)('%s memakai NYY 2,5 mm²', (kind) => {
    expect(defaultWireSpec(kind, cableItems)).toEqual({
      cableId: 'cable-nyy-2core',
      areaMm2: 2.5,
      lengthM: DEFAULT_WIRE_LENGTH_M,
    });
  });

  it('melempar galat bila katalog tanpa kabel', () => {
    expect(() => defaultWireSpec('dc+', [])).toThrow();
  });
});
