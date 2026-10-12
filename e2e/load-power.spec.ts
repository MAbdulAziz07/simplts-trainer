import { expect, test } from '@playwright/test';
import { node, pause, play, seedCircuit, setSpeed } from './sim-helpers';

// Pengatur daya beban di inspektur (docs/PRD.md F8) dan cip setelan di node beban.

test('slider daya di inspektur mengatur beban, tersimpan, dan bisa dibatalkan', async ({
  page,
}) => {
  // Beban DC 200 W di terminal beban SCC (batas 10 A): pada daya penuh putus karena beban lebih.
  await seedCircuit(
    page,
    [
      ['bat', 'bat-vrla-agm-12v-100ah'],
      ['scc', 'scc-pwm-rbl-20a'],
      ['lamp', 'load-dc-12v-200w'],
    ],
    [
      ['scc.bat-pos', 'bat.pos'],
      ['scc.bat-neg', 'bat.neg'],
      ['scc.load-pos', 'lamp.a'],
      ['scc.load-neg', 'lamp.b'],
    ],
  );
  const inspector = page.getByRole('complementary', { name: 'Inspeksi' });
  const chip = node(page, 'lamp').locator('.power-chip');
  const glow = node(page, 'lamp').locator('.lamp-glow');
  await expect(chip).toHaveText('200 W');
  // Inspektur kosong sampai sebuah beban dipilih.
  await expect(inspector.getByRole('slider')).toHaveCount(0);

  await node(page, 'lamp').locator('.node-picture').click();
  const power = inspector.getByRole('slider', { name: 'Setelan daya Beban DC 12V' });
  await expect(power).toHaveAttribute('aria-valuetext', '200 W');
  await expect(power).toHaveAttribute('step', '10');
  expect((await power.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const fullLevel = Number(await glow.getAttribute('data-level'));

  await power.fill('100');
  await expect(chip).toHaveText('100 W');
  await expect(power).toHaveAttribute('aria-valuetext', '100 W');
  // Lampu meredup sebanding daya.
  await expect
    .poll(async () => Number(await glow.getAttribute('data-level')))
    .toBeLessThan(fullLevel);

  // Pada 100 W arus terminal beban di bawah 10 A: SCC tidak lagi beban lebih.
  await setSpeed(page, 60);
  await play(page);
  await page.waitForTimeout(1500);
  await pause(page);
  await expect(node(page, 'scc').locator('.status-badge')).toHaveCount(0);
  await expect(node(page, 'scc').locator('.status-led')).toHaveAttribute('data-led', 'green');

  // Setelan ikut simpan otomatis.
  await page.reload();
  await expect(node(page, 'lamp').locator('.power-chip')).toHaveText('100 W');

  // 0 W memadamkan lampu; undo mengembalikan setelan sebelumnya.
  await node(page, 'lamp').locator('.node-picture').click();
  await inspector.getByRole('slider').fill('0');
  await expect(node(page, 'lamp').locator('.power-chip')).toHaveText('0 W');
  await expect(node(page, 'lamp').locator('.lamp-glow')).toHaveCount(0);
  await page.getByRole('button', { name: 'Urungkan (Ctrl+Z)' }).click();
  await expect(node(page, 'lamp').locator('.power-chip')).toHaveText('100 W');
});

test('daya penuh di terminal beban SCC tetap berakhir beban lebih', async ({ page }) => {
  await seedCircuit(
    page,
    [
      ['bat', 'bat-vrla-agm-12v-100ah'],
      ['scc', 'scc-pwm-rbl-20a'],
      ['lamp', 'load-dc-12v-200w'],
    ],
    [
      ['scc.bat-pos', 'bat.pos'],
      ['scc.bat-neg', 'bat.neg'],
      ['scc.load-pos', 'lamp.a'],
      ['scc.load-neg', 'lamp.b'],
    ],
  );
  await play(page);
  await expect(node(page, 'scc').locator('.status-badge')).toContainText('LEBIH');
});
