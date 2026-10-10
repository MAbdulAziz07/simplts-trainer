import { expect, test } from '@playwright/test';

// Ukuran area pada layar acuan 1366x768 (docs/UX.md §2.1).
test('halaman utama menampilkan 5 area dengan ukuran sesuai UX.md', async ({ page }) => {
  await page.goto('/');

  const areas = {
    topBar: page.getByRole('banner', { name: 'Bilah atas' }),
    tray: page.getByRole('complementary', { name: 'Baki komponen' }),
    workbench: page.getByRole('main', { name: 'Meja kerja' }),
    inspector: page.getByRole('complementary', { name: 'Inspeksi' }),
    simControls: page.getByRole('contentinfo', { name: 'Kendali simulasi' }),
  };
  for (const area of Object.values(areas)) await expect(area).toBeVisible();

  const size = async (name: keyof typeof areas) => {
    const box = await areas[name].boundingBox();
    return { width: box?.width, height: box?.height };
  };
  expect(await size('topBar')).toEqual({ width: 1366, height: 56 });
  expect(await size('tray')).toEqual({ width: 216, height: 640 });
  expect(await size('workbench')).toEqual({ width: 870, height: 640 });
  expect(await size('inspector')).toEqual({ width: 280, height: 640 });
  expect(await size('simControls')).toEqual({ width: 1366, height: 72 });

  await expect(areas.topBar).toContainText('Trainer Virtual PLTS');
});
