/// <reference lib="dom" />
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { terminal, wire } from './sim-helpers';

// Skenario: pemilih, panel langkah yang tercentang otomatis, petunjuk bertingkat, Cari Gangguan,
// Asesmen tanpa petunjuk, ringkasan nilai, dan ekspor CSV.

const panel = (page: Page) => page.getByRole('region', { name: 'Langkah skenario' });
const stepText = (page: Page) => panel(page).locator('[data-step-id]');

/** Mengetuk lintasan kabel pada bagian `fraction` panjangnya (memilih kabel itu). */
async function clickWire(page: Page, wireId: string, fraction = 0.5) {
  const point = await wire(page, wireId)
    .locator('.react-flow__edge-path')
    .evaluate((path: SVGPathElement, at) => {
      const middle = path.getPointAtLength(path.getTotalLength() * at);
      const matrix = path.getScreenCTM()!;
      return { x: middle.x * matrix.a + matrix.e, y: middle.y * matrix.d + matrix.f };
    }, fraction);
  await page.mouse.click(point.x, point.y);
}

async function startScenario(page: Page, title: string, participant = '') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skenario' }).click();
  const dialog = page.getByRole('dialog', { name: 'Pilih skenario' });
  await dialog.getByRole('button', { name: new RegExp(title) }).click();
  if (participant) await dialog.getByLabel('Nama peserta').fill(participant);
  return dialog;
}

test('Praktik Terpandu: petunjuk bertingkat, langkah tercentang saat multimeter membaca', async ({
  page,
}) => {
  const dialog = await startScenario(page, 'Merangkai PLTS off-grid DC', 'Ani');
  await dialog.getByRole('button', { name: 'Mulai' }).click();
  await expect(dialog).toBeHidden();
  await expect(stepText(page)).toHaveText('Ukur tegangan baterai dengan multimeter.');
  await expect(panel(page)).toContainText('Langkah 1 dari 8');

  // Petunjuk 1 samar, lalu petunjuk 2 jelas; tombol hilang setelah petunjuk terakhir.
  await panel(page)
    .getByRole('button', { name: /Buka petunjuk 1/ })
    .click();
  await expect(panel(page)).toContainText('Buka multimeter, pilih V DC.');
  await panel(page)
    .getByRole('button', { name: /Buka petunjuk 2/ })
    .click();
  await expect(panel(page)).toContainText('Probe merah ke + baterai');
  await expect(panel(page).getByRole('button', { name: /Buka petunjuk/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Buka Multimeter' }).click();
  await page.locator('.tool-chip[data-tool="red"]').click();
  await terminal(page, 'bat', 'pos').click();
  await page.locator('.tool-chip[data-tool="black"]').click();
  await terminal(page, 'bat', 'neg').click();
  await expect(stepText(page)).toHaveText('Sambungkan baterai ke terminal BAT SCC.');

  // Selesai: ringkasan nilai, nilai langkah 1 terpotong 7 poin petunjuk.
  await panel(page).getByRole('button', { name: 'Selesai' }).click();
  const summary = page.getByRole('dialog', { name: 'Hasil skenario' });
  await expect(summary).toContainText('Ani');
  await expect(summary.getByRole('row', { name: /Ukur tegangan baterai/ })).toContainText('3/10');
  await expect(page.getByTestId('scenario-score-pct')).toHaveText('4%');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    summary.getByRole('button', { name: 'Ekspor CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^hasil-offgrid-dc-terpandu-\d{14}\.csv$/);
  const csv = await readFile((await download.path()) ?? '', 'utf8');
  expect(csv).toContain('RINGKASAN');
  expect(csv).toContain('Peserta;Ani');
  expect(csv).toContain('Buka petunjuk');

  await summary.getByRole('button', { name: 'Tutup' }).click();
  await expect(summary).toBeHidden();
  await expect(panel(page)).toBeHidden();
});

test('Cari Gangguan: instruktur memilih kabel putus, peserta menunjuk kabelnya', async ({
  page,
}) => {
  const dialog = await startScenario(page, 'Cari gangguan PLTS off-grid');
  await dialog.getByText('Pilihan instruktur').click();
  await dialog.getByRole('button', { name: 'Kabel putus — w4' }).click();
  await dialog.getByRole('button', { name: 'Mulai' }).click();
  await expect(wire(page, 'w4')).toHaveCount(1);
  await expect(panel(page)).toContainText('0/1 gangguan ditemukan');

  // Jawaban salah dulu, lalu tunjuk kabel w4 sebagai kabel putus.
  await panel(page).getByRole('button', { name: 'Tunjuk penyebab' }).click();
  await clickWire(page, 'w14');
  await expect(panel(page)).toContainText('Dicurigai: Kabel w14');
  await panel(page).getByRole('button', { name: 'Kabel putus' }).click();
  await panel(page).getByRole('button', { name: 'Diagnosa' }).click();
  await expect(panel(page).getByRole('status')).toHaveText('Belum tepat. Ukur lagi.');

  await clickWire(page, 'w4', 0.8);
  await expect(panel(page)).toContainText('Dicurigai: Kabel w4');
  await panel(page).getByRole('button', { name: 'Diagnosa' }).click();
  await expect(panel(page)).not.toContainText('gangguan ditemukan');

  await panel(page).getByRole('button', { name: 'Selesai' }).click();
  const summary = page.getByRole('dialog', { name: 'Hasil skenario' });
  await expect(summary).toContainText('Kabel putus — w4');
  await expect(summary).toContainText('20 / 40');
});

test('Asesmen: tanpa petunjuk', async ({ page }) => {
  const dialog = await startScenario(page, 'Asesmen merangkai off-grid DC');
  await dialog.getByRole('button', { name: 'Mulai' }).click();
  await expect(stepText(page)).toHaveText('Sambungkan baterai ke SCC.');
  await expect(panel(page)).toContainText('Asesmen tanpa petunjuk');
  await expect(panel(page).getByRole('button', { name: /petunjuk/ })).toHaveCount(0);
  await panel(page).getByRole('button', { name: 'Keluar dari skenario' }).click();
  await expect(panel(page)).toBeHidden();
});
