import { expect, test, type Page } from '@playwright/test';
import { connect, node, place, tile } from './sim-helpers';

// Satu ubin MCB dan satu ubin Panel Listrik; jenis dan arus pengenal dipilih di inspektur.

const choice = (page: Page, group: string, label: string) =>
  page.getByRole('group', { name: group }).getByRole('button', { name: label, exact: true });
const wires = (page: Page) => page.locator('.react-flow__edge');

test('baki: satu ubin MCB dan satu ubin Panel Listrik', async ({ page }) => {
  await page.goto('/');
  await expect(tile(page, 'MCB')).toHaveCount(1);
  await expect(tile(page, 'Panel Listrik')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^Tambah (MCB |Busbar )/ })).toHaveCount(0);
});

test('MCB: ganti arus pengenal menjaga kabel, ganti jenis melepasnya, undo kembali', async ({
  page,
}) => {
  await page.goto('/');
  await place(page, 'Panel 100 Wp', 'MCB');
  await connect(page, ['c1.pos', 'c2.pos-in']);
  await node(page, 'c2').click({ position: { x: 10, y: 10 } });

  await expect(choice(page, 'Jenis', 'DC')).toHaveAttribute('aria-pressed', 'true');
  await expect(choice(page, 'Arus pengenal', '16 A')).toHaveAttribute('aria-pressed', 'true');

  await choice(page, 'Arus pengenal', '32 A').click();
  await expect(page.getByRole('switch', { name: 'Tuas MCB DC 32A' })).toBeVisible();
  await expect(node(page, 'c2').locator('.component-name')).toHaveText('MCB DC 32A');
  await expect(wires(page)).toHaveCount(1);

  // Paket Minimum tidak punya MCB AC 32 A: dipilih yang terdekat (16 A).
  await choice(page, 'Jenis', 'AC').click();
  await expect(page.getByRole('switch', { name: 'Tuas MCB AC 16A' })).toBeVisible();
  await expect(choice(page, 'Arus pengenal', '16 A')).toHaveAttribute('aria-pressed', 'true');
  await expect(wires(page)).toHaveCount(0);

  await page.keyboard.press('Control+z');
  await expect(page.getByRole('switch', { name: 'Tuas MCB DC 32A' })).toBeVisible();
  await expect(wires(page)).toHaveCount(1);
});

test('Panel Listrik: jenis busbar dipilih di inspektur', async ({ page }) => {
  await page.goto('/');
  await place(page, 'Panel Listrik');
  await expect(node(page, 'c1').locator('.component-name')).toHaveText('Busbar DC+');
  await expect(page.getByRole('group', { name: 'Arus pengenal' })).toHaveCount(0);
  await choice(page, 'Jenis', 'PE').click();
  await expect(node(page, 'c1').locator('.component-name')).toHaveText('Busbar PE');
  await expect(choice(page, 'Jenis', 'PE')).toHaveAttribute('aria-pressed', 'true');
});
