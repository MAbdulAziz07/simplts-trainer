import { describe, expect, it } from 'vitest';
import { PACKAGE_IDS, SWITCH_CATEGORIES } from '@/domain';
import { loadCatalog } from '../catalog';
import { loadPreset, rawPresetFiles } from './index';

const catalog = loadCatalog();
const itemById = new Map(catalog.map((item) => [item.id, item]));
const GRID_PX = 24;

describe('preset paket', () => {
  it('ada tepat satu berkas per paket', () => {
    expect(Object.keys(rawPresetFiles).sort()).toEqual([...PACKAGE_IDS].sort());
  });

  describe.each(PACKAGE_IDS)('%s', (packageId) => {
    const preset = loadPreset(packageId, catalog);

    it('sah dan milik paketnya', () => {
      expect(preset.packageId).toBe(packageId);
      expect(preset.components.length).toBeGreaterThan(0);
    });

    it('hanya memuat komponen yang tersedia di paket itu', () => {
      for (const component of preset.components)
        expect(itemById.get(component.catalogId)?.packages, component.id).toContain(packageId);
    });

    it('belum dirangkai dan semua MCB OFF', () => {
      expect(preset.wires).toEqual([]);
      const closedCategories = preset.closedSwitchIds.map((id) => {
        const component = preset.components.find((candidate) => candidate.id === id);
        return itemById.get(component?.catalogId ?? '')?.category;
      });
      expect(closedCategories.every((category) => category === 'fuse')).toBe(true);
      const fuseCount = preset.components.filter(
        (component) => itemById.get(component.catalogId)?.category === 'fuse',
      ).length;
      expect(preset.closedSwitchIds).toHaveLength(fuseCount);
      expect(SWITCH_CATEGORIES).toContain('fuse');
    });

    it('menaruh komponen pada kisi tanpa posisi kembar', () => {
      const spots = preset.components.map((component) => `${component.xPx},${component.yPx}`);
      expect(new Set(spots).size).toBe(spots.length);
      for (const component of preset.components) {
        expect(component.xPx % GRID_PX).toBe(0);
        expect(component.yPx % GRID_PX).toBe(0);
      }
    });
  });

  it('melempar galat untuk preset yang tidak sah', () => {
    expect(() => loadPreset('min', [])).toThrow(/Preset min tidak sah/);
  });
});
