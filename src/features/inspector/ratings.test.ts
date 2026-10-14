import { describe, expect, it } from 'vitest';
import { COMPONENT_CATEGORIES, PARAM_SPECS } from '@/domain';
import { t } from '@/i18n';
import { catalogItems, findCatalogItem } from '@/store';
import {
  MAX_RATINGS,
  formatParam,
  isRatingChanged,
  parseParamNumber,
  ratingText,
  ratingsOf,
} from './ratings';

const ratings = (catalogId: string) => {
  const item = findCatalogItem(catalogId);
  if (!item) throw new Error(`item ${catalogId} tidak ada di katalog`);
  return ratingsOf(item).map(({ key, text, unit }) => `${key}=${text}${unit && ` ${unit}`}`);
};

describe('ratingsOf', () => {
  it('panel: Pmax, Voc, Isc, Vmp dari datasheet', () => {
    expect(ratings('pv-generic-100wp')).toEqual([
      'pmax=100 W',
      'voc=22 V',
      'isc=5,97 A',
      'vmp=18 V',
    ]);
  });

  it('SCC PWM: tegangan sistem dan batas Voc untuk 12 dan 24 V', () => {
    const [systemV, chargeA, loadA, pvVocMax] = ratings('scc-pwm-rbl-20a');
    expect(systemV).toBe('systemV=12/24 V');
    expect(chargeA).toBe('chargeA=20 A');
    expect(loadA).toBe('loadA=10 A');
    expect(pvVocMax).toMatch(/^pvVocMax=\d+\/\d+ V$/);
  });

  it('MCB: arus nominal, tegangan, kurva, kemampuan memutus', () => {
    const mcb = ratings('mcb-dc-16a');
    expect(mcb[0]).toBe('ratedA=16 A');
    expect(mcb[2]).toMatch(/^curve=[A-Z]$/);
    expect(mcb[3]).toMatch(/^breaking=.+ kA$/);
    expect(ratings('mcb-ac-10a')[1]).toMatch(/^nominalV=\d+ V$/);
  });

  it('beban dan baterai', () => {
    expect(ratings('load-dc-12v-200w')).toEqual(['maxPower=200 W', 'nominalV=12 V']);
    expect(ratings('bat-vrla-agm-12v-100ah').slice(0, 2)).toEqual([
      'nominalV=12 V',
      'capacity=100 Ah',
    ]);
  });

  it('tiap item katalog punya paling banyak empat rating, dan selain kabel paling sedikit satu', () => {
    for (const item of catalogItems) {
      const count = ratingsOf(item).length;
      expect(count, item.id).toBeLessThanOrEqual(MAX_RATINGS);
      if (item.category !== 'cable') expect(count, item.id).toBeGreaterThan(0);
      for (const { key, text } of ratingsOf(item)) {
        expect(t.inspector.rating[key].symbol, `${item.id}.${key}`).toBeTruthy();
        expect(text, `${item.id}.${key}`).not.toMatch(/NaN|undefined/);
      }
    }
  });
});

describe('teks inspektur', () => {
  it('setiap kategori punya penjelasan singkat', () => {
    expect(Object.keys(t.inspector.explanations).sort()).toEqual([...COMPONENT_CATEGORIES].sort());
    for (const text of Object.values(t.inspector.explanations)) {
      expect(text.length).toBeGreaterThan(20);
      expect(text.length).toBeLessThan(200);
    }
  });
});

describe('teks dan format parameter', () => {
  it('setiap parameter yang bisa diatur punya tanda dan nama', () => {
    for (const specs of Object.values(PARAM_SPECS))
      for (const spec of specs) expect(Object.keys(t.inspector.rating)).toContain(spec.key);
    expect(ratingText('ratedA')).toEqual({ symbol: 'In', name: 'Arus pengenal' });
    expect(ratingText('tak-ada')).toEqual({ symbol: 'tak-ada', name: 'tak-ada' });
  });

  it('format desimal koma tanpa pemisah ribuan; daftar dengan garis miring', () => {
    expect(formatParam(5.97)).toBe('5,97');
    expect(formatParam(1000)).toBe('1000');
    expect(formatParam([12, 24])).toBe('12/24');
    expect(formatParam('C')).toBe('C');
  });

  it('isian: koma atau titik desimal; kosong atau teks = NaN', () => {
    expect(parseParamNumber(' 5,5 ')).toBe(5.5);
    expect(parseParamNumber('5.5')).toBe(5.5);
    expect(parseParamNumber('')).toBeNaN();
    expect(parseParamNumber('abc')).toBeNaN();
    expect(parseParamNumber(formatParam(1000))).toBe(1000);
  });

  it('rating gabungan ditandai bila salah satu parameternya diubah', () => {
    expect(isRatingChanged('ratedA', { ratedA: 25 })).toBe(true);
    expect(isRatingChanged('ratedA', undefined)).toBe(false);
    expect(isRatingChanged('pvVocMax', { pvVocMax24: 60 })).toBe(true);
    expect(isRatingChanged('mpptRange', { mpptMin: 100 })).toBe(true);
    expect(isRatingChanged('curve', { ratedA: 25 })).toBe(false);
  });
});
