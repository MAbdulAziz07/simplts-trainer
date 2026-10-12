import { expect, test } from '@playwright/test';
import { clockMinutes, pause, play, setSpeed, slider } from './sim-helpers';

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
