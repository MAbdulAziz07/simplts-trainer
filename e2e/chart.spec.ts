import { expect, test } from '@playwright/test';
import { clockMinutes, numberIn, pause, play, seedCircuit, setSpeed } from './sim-helpers';

// Grafik 24 jam: dibuka dari bilah simulasi, terisi selama simulasi berjalan.

test('grafik dibuka bila perlu, terisi saat simulasi berjalan, dan nilainya bisa dibaca', async ({
  page,
}) => {
  await seedCircuit(
    page,
    [
      ['pv', 'pv-generic-100wp'],
      ['scc', 'scc-pwm-rbl-20a'],
      ['bat', 'bat-vrla-agm-12v-100ah'],
      ['inv', 'inv-offgrid-500w-12v'],
      ['fan', 'load-ac-fan-50w'],
    ],
    [
      ['pv.pos', 'scc.pv-pos'],
      ['pv.neg', 'scc.pv-neg'],
      ['scc.bat-pos', 'bat.pos'],
      ['scc.bat-neg', 'bat.neg'],
      ['bat.pos', 'inv.dc-pos'],
      ['bat.neg', 'inv.dc-neg'],
      ['inv.ac-l', 'fan.a'],
      ['inv.ac-n', 'fan.b'],
    ],
  );
  const chart = page.getByRole('region', { name: 'Grafik 24 jam simulasi' });
  const toggle = page.getByRole('button', { name: 'Grafik 24 jam', exact: true });
  await expect(chart).toHaveCount(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(chart.getByText('Jalankan simulasi untuk mengisi grafik')).toBeVisible();
  const legend = (series: string) => chart.locator(`.chart-legend[data-series="${series}"] strong`);
  await expect(legend('pv')).toHaveText('—');

  await setSpeed(page, 600);
  await play(page);
  await expect(chart.getByText('Jalankan simulasi untuk mengisi grafik')).toHaveCount(0);
  // 600×: tiap setengah detik satu ruas 5 menit baru; garis memanjang.
  const pvLine = chart.locator('.day-chart-plot [data-series="pv"] path');
  await expect
    .poll(async () => ((await pvLine.first().getAttribute('d')) ?? '').split('L').length)
    .toBeGreaterThan(6);
  await pause(page);

  // Legenda memuat nilai saat ini; daya PV dan beban berbagi satu sumbu, SoC di bidang sendiri.
  expect(await numberIn(legend('pv'))).toBeGreaterThan(40);
  expect(await numberIn(legend('load'))).toBeGreaterThan(40);
  const soc = await numberIn(legend('soc'));
  expect(soc).toBeGreaterThan(50);
  expect(soc).toBeLessThanOrEqual(100);
  await expect(chart.locator('.day-chart-plot [data-series="load"] path')).not.toHaveCount(0);
  await expect(chart.locator('.day-chart-plot [data-series="soc"] path')).not.toHaveCount(0);

  // Penunjuk di atas ruas pukul 10:00 (ruas ke-120 dari 288) menampilkan nilai semua deret.
  const plot = chart.locator('.day-chart-plot');
  const box = (await plot.boundingBox())!;
  const plotLeft = 44;
  const plotWidth = 560 - plotLeft - 14;
  await page.mouse.move(box.x + plotLeft + (120.5 / 288) * plotWidth, box.y + 80);
  const tooltip = chart.getByRole('tooltip');
  await expect(tooltip).toContainText('10:00');
  await expect(tooltip).toContainText('PV');
  await expect(tooltip).toContainText('Beban');
  await expect(tooltip).toContainText('SoC');

  // Nilai yang sama terbaca lewat keyboard.
  await page.mouse.move(0, 0);
  await expect(tooltip).toHaveCount(0);
  await plot.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(tooltip).toBeVisible();

  await chart.getByRole('button', { name: 'Tutup grafik' }).click();
  await expect(chart).toHaveCount(0);
});

test('3600×: satu detik = satu jam simulasi, grafik terisi tanpa ruas kosong', async ({ page }) => {
  await seedCircuit(
    page,
    [
      ['bat', 'bat-vrla-agm-12v-100ah'],
      ['inv', 'inv-offgrid-500w-12v'],
      ['fan', 'load-ac-fan-50w'],
    ],
    [
      ['bat.pos', 'inv.dc-pos'],
      ['bat.neg', 'inv.dc-neg'],
      ['inv.ac-l', 'fan.a'],
      ['inv.ac-n', 'fan.b'],
    ],
  );
  await page.getByRole('button', { name: 'Grafik 24 jam', exact: true }).click();
  const speed = page.getByRole('radio', { name: '3600×', exact: true });
  await expect(speed).toHaveAttribute('title', '1 detik = 1 jam simulasi');
  await setSpeed(page, 3600);
  await play(page);
  // Mulai 10:00; tiga jam simulasi berlalu dalam sekitar tiga detik.
  await expect.poll(() => clockMinutes(page), { timeout: 10_000 }).toBeGreaterThanOrEqual(13 * 60);
  await pause(page);

  // Garis beban bersambung dari 10:00 sampai jam sekarang: satu lintasan, lebih dari 30 ruas.
  const loadLine = page.locator('.day-chart-plot [data-series="load"] path');
  await expect(loadLine).toHaveCount(1);
  const d = (await loadLine.getAttribute('d')) ?? '';
  expect(d.split('L').length).toBeGreaterThan(30);
});
