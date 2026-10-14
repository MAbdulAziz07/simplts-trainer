import { describe, expect, it } from 'vitest';
import { COMPONENT_CATEGORIES, PACKAGE_IDS, familyOf } from '@/domain';
import { catalogItems } from '@/store';
import { TRAY_GROUPS, trayGroups } from './groups';

describe('trayGroups', () => {
  it('setiap kategori selain kabel masuk tepat satu kelompok', () => {
    const grouped = TRAY_GROUPS.flatMap((group) => group.categories);
    expect([...grouped].sort()).toEqual(
      COMPONENT_CATEGORIES.filter((category) => category !== 'cable').sort(),
    );
  });

  it.each(PACKAGE_IDS)(
    'paket %s: komponen di luar keluarga satu per ubin, tiap keluarga satu ubin',
    (packageId) => {
      const entries = trayGroups(catalogItems, packageId).flatMap((group) => group.entries);
      const inPackage = catalogItems.filter(
        (item) => item.packages.includes(packageId) && item.category !== 'cable',
      );
      const singles = entries.filter((entry) => !entry.family).map((entry) => entry.item.id);
      expect(singles.sort()).toEqual(
        inPackage
          .filter((item) => !familyOf(item.category))
          .map((item) => item.id)
          .sort(),
      );
      const families = entries.flatMap((entry) => entry.family ?? []);
      expect(families.sort()).toEqual(['mcb', 'panel']);
    },
  );

  it('ubin keluarga menaruh varian pertama di katalog', () => {
    const entries = trayGroups(catalogItems, 'min').flatMap((group) => group.entries);
    expect(entries.find((entry) => entry.family === 'mcb')?.item.id).toBe('mcb-dc-16a');
    expect(entries.find((entry) => entry.family === 'panel')?.item.id).toBe('busbar-dc-pos');
  });

  it('paket Minimum memuat busbar (PRD US1) dan tidak memuat komponen paket lain', () => {
    const ids = trayGroups(catalogItems, 'min').flatMap((group) =>
      group.entries.map((entry) => entry.item.id),
    );
    expect(ids).toContain('busbar-dc-pos');
    expect(ids).toContain('scc-pwm-rbl-20a');
    expect(ids).not.toContain('inv-hybrid-5000w-48v');
    expect(ids).not.toContain('scc-mppt-generic-40a-24v');
  });

  it('kelompok kosong disembunyikan', () => {
    expect(trayGroups([], 'min')).toEqual([]);
    for (const group of trayGroups(catalogItems, 'best'))
      expect(group.entries.length).toBeGreaterThan(0);
  });
});
