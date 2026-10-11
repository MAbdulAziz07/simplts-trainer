import { describe, expect, it } from 'vitest';
import { COMPONENT_CATEGORIES, PACKAGE_IDS } from '@/domain';
import { catalogItems } from '@/store';
import { TRAY_GROUPS, trayGroups } from './groups';

describe('trayGroups', () => {
  it('setiap kategori selain kabel masuk tepat satu kelompok', () => {
    const grouped = TRAY_GROUPS.flatMap((group) => group.categories);
    expect([...grouped].sort()).toEqual(
      COMPONENT_CATEGORIES.filter((category) => category !== 'cable').sort(),
    );
  });

  it.each(PACKAGE_IDS)('paket %s: memuat semua komponen paket itu, tanpa kabel', (packageId) => {
    const shown = trayGroups(catalogItems, packageId).flatMap((group) => group.items);
    const expected = catalogItems.filter(
      (item) => item.packages.includes(packageId) && item.category !== 'cable',
    );
    expect(shown.map((item) => item.id).sort()).toEqual(expected.map((item) => item.id).sort());
    expect(new Set(shown).size).toBe(shown.length);
  });

  it('paket Minimum memuat busbar (PRD US1) dan tidak memuat komponen paket lain', () => {
    const ids = trayGroups(catalogItems, 'min').flatMap((group) => group.items.map((i) => i.id));
    expect(ids).toContain('busbar-dc-pos');
    expect(ids).toContain('scc-pwm-rbl-20a');
    expect(ids).not.toContain('inv-hybrid-5000w-48v');
    expect(ids).not.toContain('scc-mppt-generic-40a-24v');
  });

  it('kelompok kosong disembunyikan', () => {
    expect(trayGroups([], 'min')).toEqual([]);
    for (const group of trayGroups(catalogItems, 'best'))
      expect(group.items.length).toBeGreaterThan(0);
  });
});
