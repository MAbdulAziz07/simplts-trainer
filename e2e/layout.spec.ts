import { expect, test, type Page } from '@playwright/test';
import { node, seedCircuit } from './sim-helpers';

// Ukuran area pada layar acuan 1366x768 (docs/UX.md §2.1).

const areas = (page: Page) => ({
  topBar: page.getByRole('banner', { name: 'Bilah atas' }),
  tray: page.getByRole('complementary', { name: 'Baki komponen' }),
  workbench: page.getByRole('main', { name: 'Meja kerja' }),
  inspector: page.getByRole('complementary', { name: 'Inspeksi' }),
  simControls: page.getByRole('contentinfo', { name: 'Kendali simulasi' }),
});
type AreaName = keyof ReturnType<typeof areas>;

async function size(page: Page, name: AreaName) {
  const box = await areas(page)[name].boundingBox();
  return { width: box?.width, height: box?.height };
}

test('tanpa komponen terpilih: empat area, meja kerja selebar 1150 px', async ({ page }) => {
  await page.goto('/');
  for (const name of ['topBar', 'tray', 'workbench', 'simControls'] as const) {
    await expect(areas(page)[name]).toBeVisible();
  }
  await expect(areas(page).inspector).toHaveCount(0);

  expect(await size(page, 'topBar')).toEqual({ width: 1366, height: 56 });
  expect(await size(page, 'tray')).toEqual({ width: 216, height: 640 });
  expect(await size(page, 'workbench')).toEqual({ width: 1150, height: 640 });
  expect(await size(page, 'simControls')).toEqual({ width: 1366, height: 72 });
  await expect(areas(page).topBar).toContainText('Trainer Virtual PLTS');
});

test('inspektur 280 px muncul saat satu komponen terpilih dan hilang saat pilihan dilepas', async ({
  page,
}) => {
  await page.goto('/');
  // Komponen yang baru ditaruh langsung terpilih.
  await page.getByRole('button', { name: 'Tambah Panel 100 Wp' }).click();
  await expect(areas(page).inspector).toBeVisible();
  expect(await size(page, 'inspector')).toEqual({ width: 280, height: 640 });
  expect(await size(page, 'workbench')).toEqual({ width: 870, height: 640 });

  await page.keyboard.press('Escape');
  await expect(areas(page).inspector).toHaveCount(0);
  expect(await size(page, 'workbench')).toEqual({ width: 1150, height: 640 });
});

test('inspektur: rating utama, penjelasan lewat "?", dan hapus yang bisa dibatalkan', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tambah Panel 100 Wp' }).click();
  const inspector = areas(page).inspector;
  await expect(inspector.getByRole('heading', { name: 'Panel 100 Wp' })).toBeVisible();

  // Paling banyak empat rating, angka 20 px.
  const ratings = inspector.locator('.rating');
  await expect(ratings).toHaveCount(4);
  await expect(ratings.first()).toContainText('Pmax');
  await expect(ratings.first().locator('dd')).toHaveText('100W');
  await expect(ratings.first().locator('dd')).toHaveCSS('font-size', '20px');
  // Isi tidak terpotong pada tinggi 640 px.
  const scrolls = await inspector.evaluate(
    (element) => element.scrollHeight > element.clientHeight,
  );
  expect(scrolls).toBe(false);

  // Paragraf hanya muncul lewat "?".
  await expect(inspector.getByText(/Mengubah cahaya matahari/)).toHaveCount(0);
  await inspector.getByRole('button', { name: 'Penjelasan Panel 100 Wp' }).click();
  await expect(inspector.getByText(/Mengubah cahaya matahari/)).toBeVisible();

  const remove = inspector.getByRole('button', { name: 'Hapus Panel 100 Wp' });
  expect((await remove.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  await remove.click();
  await expect(page.locator('.react-flow__node')).toHaveCount(0);
  await expect(inspector).toHaveCount(0);
  await page.getByRole('button', { name: 'Urungkan (Ctrl+Z)' }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
});

test('baki dilipat menjadi rel ikon 64 px dan dibuka lagi', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Lipat baki' }).click();
  expect(await size(page, 'tray')).toEqual({ width: 64, height: 640 });
  expect(await size(page, 'workbench')).toEqual({ width: 1302, height: 640 });
  await expect(page.getByRole('button', { name: 'Tambah Panel 100 Wp' })).toHaveCount(0);

  // Ikon kelompok di rel membuka baki lagi.
  await areas(page).tray.getByRole('button', { name: 'Sumber' }).click();
  expect(await size(page, 'tray')).toEqual({ width: 216, height: 640 });
  await expect(page.getByRole('button', { name: 'Tambah Panel 100 Wp' })).toBeVisible();
});

test('di bawah 1024 px inspektur menjadi lembar bawah setinggi 40% layar', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Tambah Panel 100 Wp' }).click();
  const sheet = (await areas(page).inspector.boundingBox())!;
  expect(sheet.width).toBe(900);
  expect(sheet.height).toBe(280);
  // Tepat di atas bilah simulasi 72 px; meja kerja tidak menyempit.
  expect(sheet.y + sheet.height).toBe(700 - 72);
  expect((await size(page, 'workbench')).width).toBe(900 - 216);
});

// Rangkaian selebar tiga kolom: pada meja 1150 px muat di zoom yang lebih besar daripada di 870 px.
async function seedWide(page: Page) {
  await seedCircuit(
    page,
    [
      ['pv', 'pv-generic-100wp'],
      ['scc', 'scc-pwm-rbl-20a'],
      ['inv', 'inv-offgrid-500w-12v'],
      ['bat', 'bat-vrla-agm-12v-100ah'],
    ],
    [],
  );
  await page.waitForTimeout(400);
}

const viewport = (page: Page) =>
  page.locator('.react-flow__viewport').evaluate((element) => element.style.transform);

/** `true` bila komponen seluruhnya berada di dalam meja kerja. */
async function isInsideWorkbench(page: Page, nodeId: string) {
  const bench = (await areas(page).workbench.boundingBox())!;
  const box = (await node(page, nodeId).boundingBox())!;
  return box.x >= bench.x && box.x + box.width <= bench.x + bench.width;
}

test('tampilan dipaskan ulang saat inspektur muncul dan hilang bila semua komponen terlihat', async ({
  page,
}) => {
  await seedWide(page);
  const fitted = await viewport(page);
  expect(await isInsideWorkbench(page, 'inv')).toBe(true);

  // Memilih komponen paling kiri memunculkan inspektur; komponen paling kanan tetap terlihat.
  await node(page, 'pv').locator('.node-picture').click();
  await expect(areas(page).inspector).toBeVisible();
  await expect.poll(() => viewport(page)).not.toBe(fitted);
  await page.waitForTimeout(400);
  expect(await isInsideWorkbench(page, 'inv')).toBe(true);
  expect(await isInsideWorkbench(page, 'pv')).toBe(true);

  // Pilihan dilepas: meja melebar lagi dan tampilan kembali seperti semula.
  await page.keyboard.press('Escape');
  await expect(areas(page).inspector).toHaveCount(0);
  await expect.poll(() => viewport(page)).toBe(fitted);
});

test('tampilan yang sedang diperbesar ke satu bagian tidak diubah saat inspektur muncul', async ({
  page,
}) => {
  await seedWide(page);
  await page.getByRole('button', { name: 'Perbesar' }).click();
  await page.getByRole('button', { name: 'Perbesar' }).click();
  await page.waitForTimeout(400);
  const zoomed = await viewport(page);
  // Sebagian rangkaian kini di luar layar.
  expect(await isInsideWorkbench(page, 'inv')).toBe(false);

  await node(page, 'scc').locator('.node-picture').click();
  await expect(areas(page).inspector).toBeVisible();
  await page.waitForTimeout(700);
  expect(await viewport(page)).toBe(zoomed);
});

test('komponen yang dipilih sambil diseret: tampilan baru dipaskan ulang setelah dilepas', async ({
  page,
}) => {
  await seedWide(page);
  const fitted = await viewport(page);
  const box = (await node(page, 'bat').locator('.node-picture').boundingBox())!;
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 60, start.y - 30, { steps: 6 });
  // Inspektur sudah muncul, tetapi kanvas tidak bergeser selama komponen masih dipegang.
  await expect(areas(page).inspector).toBeVisible();
  await page.waitForTimeout(600);
  expect(await viewport(page)).toBe(fitted);

  await page.mouse.up();
  await expect.poll(() => viewport(page)).not.toBe(fitted);
  await page.waitForTimeout(400);
  expect(await isInsideWorkbench(page, 'inv')).toBe(true);
});
