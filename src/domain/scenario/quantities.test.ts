import { describe, expect, it } from 'vitest';
import { STC_SITE } from '../engine/scenario-fixtures';
import { expectedValue, quantitiesOf, referencesOf, withinTolerance } from './quantities';
import { COMPONENTS, snapshotAfter } from './scenario-test-fixtures';

describe('quantitiesOf', () => {
  const snapshot = snapshotAfter(60);
  const values = quantitiesOf(snapshot);

  it('membaca baterai, PV, beban, dan waktu dari snapshot', () => {
    expect(values['soc-pct']).toBeGreaterThan(0);
    expect(values['battery-voltage-v']).toBeGreaterThan(12);
    expect(values['pv-power-w']).toBeGreaterThan(0);
    expect(values['load-power-w']).toBeGreaterThan(0);
    expect(values['sim-time-s']).toBe(snapshot.timeS);
  });

  it('arus baterai = jumlah arus bank', () => {
    const sum = Object.values(snapshot.operatingPoint.batteries).reduce(
      (total, reading) => total + reading.currentA,
      0,
    );
    expect(values['battery-current-a']).toBeCloseTo(sum);
  });
});

describe('referencesOf', () => {
  it('memberi Voc dan Isc modul pertama serta OCV baterai', () => {
    const references = referencesOf(COMPONENTS, STC_SITE, snapshotAfter(0));
    expect(references['module-voc']).toBeGreaterThan(15);
    expect(references['module-isc']).toBeGreaterThan(1);
    expect(references['battery-ocv']).toBeGreaterThan(11);
  });

  it('Voc nol saat gelap, tanpa baterai tanpa OCV', () => {
    const night = { irradianceWm2: 0, ambientTempC: 20 };
    const pvOnly = COMPONENTS.filter((c) => c.item.category === 'pv-module');
    const references = referencesOf(pvOnly, night, snapshotAfter(0));
    expect(references['module-voc']).toBe(0);
    expect(references['battery-ocv']).toBeUndefined();
  });
});

describe('expectedValue dan withinTolerance', () => {
  it('angka tetap atau acuan × faktor', () => {
    expect(expectedValue(12, {})).toBe(12);
    expect(expectedValue({ ref: 'module-voc', factor: 2 }, { 'module-voc': 21 })).toBe(42);
    expect(expectedValue({ ref: 'module-voc' }, {})).toBeUndefined();
  });

  it('batas toleransi persen', () => {
    expect(withinTolerance(21, 20, 5)).toBe(true);
    expect(withinTolerance(21.1, 20, 5)).toBe(false);
    expect(withinTolerance(-20, 20, 5)).toBe(false);
  });
});
