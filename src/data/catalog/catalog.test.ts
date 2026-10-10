import { describe, expect, expectTypeOf, it } from 'vitest';
import { COMPONENT_CATEGORIES, PACKAGE_IDS, type CatalogItem } from '@/domain';
import {
  CATALOG_FILE_CATEGORIES,
  catalogFileSchema,
  catalogItemSchema,
  loadCatalog,
  type ParsedCatalogItem,
  rawCatalogFiles,
  validateCatalog,
} from './index';

const fileNames = Object.keys(CATALOG_FILE_CATEGORIES);

// Salinan yang boleh diubah dari satu item sah, untuk uji penolakan.
const sample = (): Record<string, unknown> => {
  const file = structuredClone(rawCatalogFiles['pv-modules']) as { items: unknown[] };
  return file.items[0] as Record<string, unknown>;
};

describe('berkas katalog', () => {
  it('memuat ke-12 berkas di src/data/catalog', () => {
    expect(Object.keys(rawCatalogFiles).sort()).toEqual([...fileNames].sort());
  });

  it.each(fileNames)('%s.json lolos skema', (name) => {
    const result = catalogFileSchema.safeParse(rawCatalogFiles[name]);
    const issues = result.success
      ? []
      : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    expect(issues).toEqual([]);
  });

  it('lolos aturan lintas berkas: nama berkas cocok dan id unik', () => {
    expect(validateCatalog(rawCatalogFiles).issues).toEqual([]);
  });

  it('berisi jumlah item dan keanggotaan paket seperti KATALOG.md §1', () => {
    const items = loadCatalog();
    const inPackage = (id: (typeof PACKAGE_IDS)[number]) =>
      items.filter((item) => item.packages.includes(id)).length;

    expect(items).toHaveLength(51);
    expect({ min: inPackage('min'), rek: inPackage('rek'), best: inPackage('best') }).toEqual({
      min: 25,
      rek: 38,
      best: 28,
    });
  });

  it('setiap kategori punya berkas dan minimal satu item', () => {
    const mapped = Object.values(CATALOG_FILE_CATEGORIES).flat();
    expect([...mapped].sort()).toEqual([...COMPONENT_CATEGORIES].sort());
    expect(new Set(loadCatalog().map((item) => item.category))).toEqual(new Set(mapped));
  });
});

describe('skema item menolak data yang salah', () => {
  const reject = (change: (item: Record<string, unknown>) => void) => {
    const item = sample();
    change(item);
    return catalogItemSchema.safeParse(item).success;
  };

  it('menerima item contoh tanpa perubahan', () => {
    expect(catalogItemSchema.safeParse(sample()).success).toBe(true);
  });

  it.each<[string, (item: Record<string, unknown>) => void]>([
    ['field tak dikenal di electrical', (item) => Object.assign(item.electrical!, { vocv: 1 })],
    ['field wajib hilang', (item) => delete (item.electrical as Record<string, unknown>).vocV],
    ['kategori tak dikenal', (item) => (item.category = 'pv-panel')],
    ['id berhuruf besar', (item) => (item.id = 'PV-100')],
    ['nama lebih dari 3 kata', (item) => (item.name = 'Panel Surya Seratus Wp')],
    ['paket tak dikenal', (item) => (item.packages = ['max'])],
    ['gambar bukan .webp', (item) => (item.image = 'src/assets/components/pv.png')],
    [
      'jenis terminal tak dikenal',
      (item) => ((item.terminals as { kind: string }[])[0]!.kind = 'dc'),
    ],
    ['terminal kosong', (item) => (item.terminals = [])],
    [
      'jalur verify tidak ada',
      (item) => Object.assign(item.datasheet!, { verify: ['electrical.x'] }),
    ],
    ['notes tanpa tanda verifikasi', (item) => (item.notes = 'Sudah dicek.')],
  ])('%s', (_label, change) => {
    expect(reject(change)).toBe(false);
  });

  it('menolak id yang sama di dua berkas dan nama berkas yang tertukar', () => {
    const { issues } = validateCatalog({
      grid: rawCatalogFiles.grid,
      meters: rawCatalogFiles.grid,
    });
    expect(issues).toHaveLength(2);
  });
});

describe('tipe', () => {
  it('keluaran skema sama dengan tipe domain', () => {
    expectTypeOf<ParsedCatalogItem>().toEqualTypeOf<CatalogItem>();
  });
});
