import { expect, test } from '@playwright/test';
import { node, seedCircuit } from './sim-helpers';

// Segitiga temuan pemeriksaan di pojok meja kerja: jumlah di ikon, daftar baru muncul saat diklik.

test('tanpa temuan segitiga redup dan tidak bisa dibuka', async ({ page }) => {
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Tidak ada temuan pemeriksaan' });
  await expect(button).toBeDisabled();
  await expect(button).toHaveText('0');
  const box = (await button.boundingBox())!;
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
});

test('polaritas terbalik: jumlah di segitiga, daftar singkat, tunjukkan di meja, penjelasan', async ({
  page,
}) => {
  // Beban dipasang terbalik ke baterai, tanpa pembumian.
  await seedCircuit(
    page,
    [
      ['bat', 'bat-vrla-agm-12v-100ah'],
      ['lamp', 'load-dc-12v-200w'],
    ],
    [
      ['bat.pos', 'lamp.b'],
      ['bat.neg', 'lamp.a'],
    ],
  );
  const button = page.getByRole('button', { name: /temuan pemeriksaan$/ });
  await expect(button).toHaveAttribute('data-severity', /danger|warning/);
  const count = Number(await button.textContent());
  expect(count).toBeGreaterThanOrEqual(1);

  // Daftar belum tampil sebelum segitiga diklik.
  const list = page.getByRole('list', { name: 'Temuan pemeriksaan' });
  await expect(list).toHaveCount(0);
  await button.click();
  await expect(list.getByRole('listitem')).toHaveCount(count);

  const row = list.locator('[data-code="reverse-polarity"]');
  await expect(row).toContainText('Polaritas terbalik');
  // Penjelasan baru muncul lewat tombol "?".
  await expect(row.getByText(/Tukar kedua kabelnya/)).toHaveCount(0);
  await row.getByRole('button', { name: 'Penjelasan: Polaritas terbalik' }).click();
  await expect(row.getByText(/Tukar kedua kabelnya/)).toBeVisible();

  // Klik temuan memilih komponennya di meja.
  await row.getByRole('button', { name: 'Polaritas terbalik: tunjukkan di meja' }).click();
  await expect(node(page, 'lamp').locator('.component-node')).toHaveAttribute(
    'data-selected',
    'true',
  );

  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);
});
