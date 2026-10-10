// Aturan nilai katalog di luar bentuk data (docs/review/2026-10-11-kerangka-proyek.md no. 1–7).
import { describe, expect, it } from 'vitest';
import {
  CATALOG_FILE_CATEGORIES,
  catalogItemSchema,
  type CatalogFileName,
  rawCatalogFiles,
  validateCatalog,
} from './index';

type Section = Record<string, unknown>;
interface RawItem {
  id: string;
  electrical: Section;
  protection: Section;
}
type Change = (item: RawItem) => void;
type Case = [label: string, change: Change];

// Salinan yang boleh diubah dari satu item sah.
const pick = (file: CatalogFileName, id: string): RawItem => {
  const { items } = structuredClone(rawCatalogFiles[file]) as { items: RawItem[] };
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Item ${id} tidak ada di ${file}`);
  return item;
};

const accepts = (file: CatalogFileName, id: string, change: Change): boolean => {
  const item = pick(file, id);
  change(item);
  return catalogItemSchema.safeParse(item).success;
};

const pv = (change: Change) => accepts('pv-modules', 'pv-240w-60p', change);
const pwm = (change: Change) => accepts('charge-controllers', 'scc-pwm-rbl-20a', change);
const mppt = (change: Change) => accepts('charge-controllers', 'scc-mppt-600w-24v', change);
const battery = (change: Change) => accepts('batteries', 'bat-lfp-25v6-100ah', change);
const offgrid = (change: Change) => accepts('inverters', 'inv-offgrid-500w-12v', change);
const gridtie = (change: Change) => accepts('inverters', 'inv-gridtie-1000w', change);
const hybrid = (change: Change) => accepts('inverters', 'inv-hybrid-5000w-48v', change);
const fuse = (change: Change) => accepts('protection-other', 'fuse-pv-15a', change);
const model = (item: RawItem) => item.electrical.modelParams as Record<string, number[]>;
// Titik kurva dari deret x1, y1, x2, y2, …
const points = (...flat: number[]): number[][] =>
  flat.flatMap((x, i) => (i % 2 === 0 ? [[x, flat[i + 1]!]] : []));

describe('no. 1 — parameter STC modul PV', () => {
  it.each<Case>([
    ['vmpV sama dengan vocV', (item) => (item.electrical.vmpV = item.electrical.vocV)],
    ['vmpV di atas vocV', (item) => (item.electrical.vmpV = 40)],
    ['impA sama dengan iscA', (item) => (item.electrical.impA = item.electrical.iscA)],
    ['impA di atas iscA', (item) => (item.electrical.impA = 9.56)],
    ['pmaxW jauh dari vmpV × impA', (item) => (item.electrical.pmaxW = 300)],
  ])('menolak %s', (_label, change) => {
    expect(pv(change)).toBe(false);
  });

  it('menerima pmaxW yang dibulatkan datasheet', () => {
    expect(pv((item) => (item.electrical.pmaxW = 245))).toBe(true);
  });
});

describe('no. 2 — kurva dan tabel', () => {
  it.each<[string, number[]]>([
    ['rasio arus berulang', [2, 150, 2, 10]],
    ['rasio arus terbalik', [3, 10, 2, 150]],
    ['waktu nol', [2, 150, 3, 0]],
    ['waktu negatif', [2, -1, 3, -2]],
    ['rasio arus nol', [0, 150, 3, 10]],
  ])('fuse menolak %s', (_label, flat) => {
    expect(fuse((item) => (item.protection.timeCurrentPoints = points(...flat)))).toBe(false);
  });

  it('kurva beban lebih SCC dan inverter menolak sumbu terbalik dan waktu nol', () => {
    const reversed = points(1.5, 5, 1.25, 60);
    const zeroTime = points(1.25, 60, 1.5, 0);
    expect(pwm((item) => (item.protection.loadOverloadCurve = reversed))).toBe(false);
    expect(pwm((item) => (item.protection.loadOverloadCurve = zeroTime))).toBe(false);
    expect(offgrid((item) => (item.protection.overloadCurve = reversed))).toBe(false);
    expect(hybrid((item) => (item.protection.overloadCurve = zeroTime))).toBe(false);
  });

  it.each<[string, number[]]>([
    ['suhu terbalik', [25, 1, 0, 0.86]],
    ['suhu berulang', [25, 1, 25, 0.86]],
    ['faktor kapasitas nol', [0, 0, 25, 1]],
  ])('tabel suhu baterai menolak %s', (_label, flat) => {
    expect(battery((item) => (item.electrical.capacityTempPoints = points(...flat)))).toBe(false);
  });

  it.each<Case>([
    ['titik SoC OCV berulang', (item) => (model(item).ocvSoc![1] = 0)],
    ['titik SoC OCV terbalik', (item) => model(item).ocvSoc!.reverse()],
    ['SoC OCV tidak mulai dari 0', (item) => (model(item).ocvSoc![0] = 0.01)],
    ['SoC OCV tidak sampai 1', (item) => (model(item).ocvSoc![9] = 0.99)],
    ['titik SoC tegangan lebih berulang', (item) => (model(item).overVoltageSoc![1] = 0)],
    ['SoC tegangan lebih tidak sampai 1', (item) => (model(item).overVoltageSoc![4] = 0.99)],
  ])('baterai menolak %s', (_label, change) => {
    expect(battery(change)).toBe(false);
  });

  it('tabel suhu menerima suhu negatif', () => {
    const table = points(-20, 0.5, -10, 0.65, 25, 1);
    expect(battery((item) => (item.electrical.capacityTempPoints = table))).toBe(true);
  });

  it('derating kabel menolak suhu terbalik', () => {
    const table = points(70, 0.92, 60, 1);
    expect(
      accepts('cables', 'cable-pv-h1z2z2k', (item) => (item.electrical.ambientDerating = table)),
    ).toBe(false);
  });
});

describe('no. 3 — efisiensi yang menjadi pembagi', () => {
  it.each<[string, string, (change: Change) => boolean]>([
    ['inverter off-grid', 'efficiencyAtHalfLoad', offgrid],
    ['inverter off-grid', 'efficiencyAtFullLoad', offgrid],
    ['inverter grid-tie', 'efficiencyPeak', gridtie],
    ['inverter grid-tie', 'efficiencyAtHalfLoad', gridtie],
    ['inverter grid-tie', 'efficiencyAtFullLoad', gridtie],
    ['inverter hibrida', 'efficiencyAtFullLoad', hybrid],
    ['inverter hibrida', 'mpptEfficiency', hybrid],
    ['inverter hibrida', 'gridChargeEfficiency', hybrid],
    ['SCC MPPT', 'efficiencyMax', mppt],
    ['SCC MPPT', 'trackingEfficiency', mppt],
  ])('%s: %s = 0 ditolak, = 1 diterima', (_label, field, check) => {
    expect(check((item) => (item.electrical[field] = 0))).toBe(false);
    expect(check((item) => (item.electrical[field] = 1))).toBe(true);
  });
});

describe('no. 4 — salinan rating di protection', () => {
  it.each<[CatalogFileName, string, string, unknown]>([
    ['protection-mcb', 'mcb-dc-20a', 'ratedCurrentA', 200],
    ['protection-mcb', 'mcb-dc-20a', 'curve', 'B'],
    ['protection-mcb', 'mcb-ac-16a', 'ratedVoltageAcV', 400],
    ['protection-other', 'fuse-pv-15a', 'ratedCurrentA', 20],
    ['protection-other', 'spd-pv-600v', 'continuousVoltageUcV', 1000],
    ['protection-other', 'combiner-pv-2s', 'fusePerStringA', 20],
    ['cables', 'cable-pv-h1z2z2k', 'maxConductorTempC', 120],
    ['meters', 'kwh-meter-sdm230', 'currentMaxA', 63],
    ['distribution', 'busbar-dc-pos', 'ratedCurrentA', 125],
    ['distribution', 'load-panel-3c', 'circuitBreakerA', 16],
  ])('%s › %s: protection.%s berbeda ditolak', (file, id, field, value) => {
    expect(accepts(file, id, (item) => (item.protection[field] = value))).toBe(false);
  });

  it('SCC MPPT: protection.vocMaxV harus sama dengan electrical.pvVocMaxV', () => {
    expect(mppt((item) => (item.protection.vocMaxV = 37.5))).toBe(false);
  });

  it('menerima pasangan yang diubah bersama', () => {
    const both: Change = (item) => {
      item.electrical.ratedCurrentA = 25;
      item.protection.ratedCurrentA = 25;
    };
    expect(accepts('protection-mcb', 'mcb-dc-20a', both)).toBe(true);
  });
});

describe('no. 5 — jendela MPPT', () => {
  it.each<[string, (change: Change) => boolean]>([
    ['SCC MPPT', mppt],
    ['inverter grid-tie', gridtie],
    ['inverter hibrida', hybrid],
  ])('%s menolak jendela terbalik, batas sama, dan batas atas melampaui Voc', (_label, check) => {
    const max = (item: RawItem) => item.electrical.mpptMaxV as number;
    expect(check((item) => (item.electrical.mpptMinV = max(item) + 1))).toBe(false);
    expect(check((item) => (item.electrical.mpptMinV = max(item)))).toBe(false);
    expect(check((item) => (item.electrical.mpptMaxV = 1000))).toBe(false);
    expect(check((item) => (item.electrical.mpptMinV = max(item) - 1))).toBe(true);
  });
});

describe('no. 6 — kelengkapan berkas katalog', () => {
  const fileNames = Object.keys(CATALOG_FILE_CATEGORIES);

  it('katalog kosong melaporkan ke-12 berkas hilang', () => {
    const { issues } = validateCatalog({});
    expect(issues).toHaveLength(fileNames.length);
    for (const name of fileNames) expect(issues.join('\n')).toContain(name);
  });

  it('satu berkas hilang dilaporkan dengan namanya', () => {
    const files = { ...rawCatalogFiles };
    delete files.grid;
    expect(validateCatalog(files).issues).toEqual([expect.stringMatching(/^grid › /)]);
  });

  it('validasi sebagian hanya lewat opsi eksplisit', () => {
    const files = { grid: rawCatalogFiles.grid };
    expect(validateCatalog(files, { allowPartial: true }).issues).toEqual([]);
  });
});

describe('no. 7 — urutan pasang SCC PWM', () => {
  it.each<[string, string[]]>([
    ['langkah berulang', ['pv', 'pv', 'pv']],
    ['PV sebelum baterai', ['pv', 'battery', 'load']],
    ['beban sebelum PV', ['battery', 'load', 'pv']],
  ])('menolak %s', (_label, order) => {
    expect(pwm((item) => (item.electrical.installOrder = order))).toBe(false);
  });
});
