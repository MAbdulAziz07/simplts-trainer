import { expect, test, type Page } from '@playwright/test';
import { node, openParams, pause, place, play, seedCircuit, setSpeed } from './sim-helpers';

// Rating utama tiap komponen bisa diatur manual dari inspektur; nilai default selalu tampak.

const editButton = (page: Page) => page.getByRole('button', { name: 'Atur parameter' });
const field = (page: Page, key: string) => page.locator(`.param-field[data-param="${key}"]`);
const tunedMark = (page: Page, nodeId: string) =>
  node(page, nodeId).getByRole('img', { name: 'Parameter diubah dari default' });

async function setNumber(page: Page, key: string, value: string) {
  const input = field(page, key).getByRole('textbox');
  await input.fill(value);
  await input.press('Enter');
}

test('MCB: ubah In, default tampak, tanda di meja, kembalikan, undo, dan tersimpan', async ({
  page,
}) => {
  await page.goto('/');
  await openParams(page);
  await place(page, 'MCB');
  await editButton(page).click();

  await expect(field(page, 'ratedA').getByRole('textbox')).toHaveValue('16');
  await expect(field(page, 'ratedA')).toContainText('Default: 16 A');
  await expect(
    field(page, 'curve').getByRole('button', { name: 'C', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');

  await setNumber(page, 'ratedA', '25');
  await expect(field(page, 'ratedA')).toHaveAttribute('data-changed', 'true');
  await expect(tunedMark(page, 'c1')).toBeVisible();

  // Nilai tidak sah ditolak dengan pesan; nilai tersimpan tidak berubah.
  await setNumber(page, 'ratedA', '0');
  await expect(field(page, 'ratedA').getByRole('alert')).toHaveText('Harus lebih dari 0');
  await field(page, 'ratedA').getByRole('textbox').press('Escape');
  await expect(field(page, 'ratedA').getByRole('textbox')).toHaveValue('25');
  await expect(field(page, 'ratedA').getByRole('alert')).toHaveCount(0);

  await field(page, 'curve').getByRole('button', { name: 'B', exact: true }).click();
  await page.getByRole('button', { name: 'Selesai mengatur' }).click();
  const ratedA = page.locator('.rating[data-changed]').filter({ hasText: 'In' });
  await expect(ratedA).toContainText('25');

  // Tersimpan otomatis: masih ada setelah halaman dimuat ulang.
  await page.reload();
  await expect(tunedMark(page, 'c1')).toBeVisible();
  await openParams(page);

  await node(page, 'c1').click({ position: { x: 10, y: 10 } });
  await editButton(page).click();
  await page.getByRole('button', { name: 'Kembalikan semua ke default' }).click();
  await expect(tunedMark(page, 'c1')).toHaveCount(0);
  await expect(field(page, 'ratedA').getByRole('textbox')).toHaveValue('16');

  await page.keyboard.press('Control+z');
  await expect(tunedMark(page, 'c1')).toBeVisible();
});

test('In MCB diturunkan saat beban jalan: MCB trip', async ({ page }) => {
  // Satu beban 200 W pada 12 V: sekitar 17 A, belum membuat MCB 16 A trip.
  await seedCircuit(
    page,
    [
      ['bat', 'bat-vrla-agm-12v-100ah'],
      ['mcb', 'mcb-dc-16a'],
      ['load', 'load-dc-12v-200w'],
    ],
    [
      ['bat.pos', 'mcb.pos-in'],
      ['bat.neg', 'mcb.neg-in'],
      ['mcb.pos-out', 'load.a'],
      ['mcb.neg-out', 'load.b'],
    ],
    { closed: ['mcb'] },
  );
  const lever = page.getByRole('switch', { name: 'Tuas MCB DC 16A' });
  await setSpeed(page, 60);
  await play(page);
  await page.waitForTimeout(3000);
  await expect(lever).toHaveAttribute('aria-checked', 'true');

  await openParams(page);
  await node(page, 'mcb').click({ position: { x: 10, y: 10 } });
  await editButton(page).click();
  await setNumber(page, 'ratedA', '8');
  await expect(lever).toHaveText('TRIP', { timeout: 15_000 });
  await pause(page);
});
