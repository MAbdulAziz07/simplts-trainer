import { expect, test } from '@playwright/test';
import {
  clockMinutes,
  node,
  pause,
  play,
  seedCircuit,
  setSpeed,
  slider,
  wire,
} from './sim-helpers';

// Kendali simulasi pada layar acuan 1366x768 (docs/UX.md §2.1).

test('putar memajukan jam menurut kecepatan; jeda menghentikannya', async ({ page }) => {
  await page.goto('/');
  expect(await clockMinutes(page)).toBe(10 * 60);

  await setSpeed(page, 600);
  await play(page);
  // 600×: 1 detik nyata = 10 menit simulasi.
  await expect.poll(() => clockMinutes(page)).toBeGreaterThanOrEqual(10 * 60 + 20);
  await pause(page);
  const stoppedAt = await clockMinutes(page);
  await page.waitForTimeout(500);
  expect(await clockMinutes(page)).toBe(stoppedAt);
});

test('iradiasi mengikuti jam dan awan, bisa disetel tangan, lalu kembali otomatis', async ({
  page,
}) => {
  await page.goto('/');
  const irradiance = slider(page, 'Iradiasi');
  const auto = page.getByRole('button', { name: 'Iradiasi: ikuti jam dan awan' });
  const value = async () =>
    Number.parseInt((await irradiance.getAttribute('aria-valuetext')) ?? '');

  const sunny = await value();
  expect(sunny).toBeGreaterThan(700);
  await expect(auto).toHaveAttribute('aria-pressed', 'true');

  await slider(page, 'Awan').fill('100');
  expect(await value()).toBeLessThan(sunny * 0.2);

  await slider(page, 'Jam').fill('22');
  expect(await value()).toBe(0);

  await irradiance.fill('400');
  expect(await value()).toBe(400);
  await expect(auto).toHaveAttribute('aria-pressed', 'false');

  await auto.click();
  expect(await value()).toBe(0);
  await expect(auto).toHaveAttribute('aria-pressed', 'true');
});

test('kontrol bilah simulasi memenuhi target sentuh 44 px', async ({ page }) => {
  await page.goto('/');
  const bar = page.getByRole('contentinfo', { name: 'Kendali simulasi' });
  for (const control of await bar.getByRole('button').all()) {
    const box = (await control.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  }
  for (const control of await bar.getByRole('radio').all()) {
    const box = (await control.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  }
  for (const control of await bar.getByRole('slider').all()) {
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});

test('reset percobaan: konfirmasi dua ketukan; trip, SoC, dan jam kembali, rangkaian tetap', async ({
  page,
}) => {
  // Dua beban 200 W di belakang MCB 16 A: sekitar 2 × arus rating.
  await seedCircuit(
    page,
    [
      ['bat', 'bat-vrla-agm-12v-100ah'],
      ['mcb', 'mcb-dc-16a'],
      ['l1', 'load-dc-12v-200w'],
      ['pos', 'busbar-dc-pos'],
      ['neg', 'busbar-dc-neg'],
      ['l2', 'load-dc-12v-200w'],
    ],
    [
      ['bat.pos', 'mcb.pos-in'],
      ['bat.neg', 'mcb.neg-in'],
      ['mcb.pos-out', 'pos.t1'],
      ['mcb.neg-out', 'neg.t1'],
      ['pos.t2', 'l1.a'],
      ['neg.t2', 'l1.b'],
      ['pos.t3', 'l2.a'],
      ['neg.t3', 'l2.b'],
    ],
    { closed: ['mcb'] },
  );
  const lever = page.getByRole('switch', { name: 'Tuas MCB DC 16A' });
  const soc = node(page, 'bat').getByRole('meter', { name: 'SoC VRLA AGM 100Ah' });
  await setSpeed(page, 600);
  await play(page);
  await expect(lever).toHaveText('TRIP', { timeout: 15_000 });
  await expect.poll(() => clockMinutes(page)).toBeGreaterThan(10 * 60 + 30);
  expect(Number(await soc.getAttribute('aria-valuenow'))).toBeLessThan(80);

  // Ketukan pertama hanya meminta konfirmasi.
  await page.getByRole('button', { name: 'Reset percobaan' }).click();
  const confirm = page.getByRole('button', { name: 'Ketuk lagi untuk mereset percobaan' });
  await expect(confirm).toHaveText('Reset?');
  // Tombol reset ada di bilah atas, terpisah dari simpan/buka.
  await expect(
    page
      .getByRole('banner', { name: 'Bilah atas' })
      .getByRole('button', { name: /mereset percobaan$/ }),
  ).toBeVisible();
  await expect(lever).toHaveText('TRIP');

  await confirm.click();
  await expect(page.getByRole('status')).toHaveText('Percobaan direset');
  await expect(page.getByRole('button', { name: 'Jalankan simulasi' })).toBeVisible();
  expect(await clockMinutes(page)).toBe(10 * 60);
  await expect(soc).toHaveAttribute('aria-valuenow', '80');
  // Tuas MCB yang trip tetap OFF tetapi tanda trip-nya hilang; rangkaian tidak berubah.
  await expect(lever).toHaveText('OFF');
  await expect(node(page, 'mcb').locator('.status-badge')).toHaveCount(0);
  await expect(page.locator('.react-flow__node')).toHaveCount(6);
  await expect(wire(page, 'w8')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Reset percobaan' })).toBeVisible();
});
