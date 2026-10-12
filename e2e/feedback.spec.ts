/// <reference lib="dom" />
import { expect, test } from '@playwright/test';
import { node, numberIn, pause, play, seedCircuit, setSpeed, wire } from './sim-helpers';

// Umpan balik visual simulasi di meja kerja: LED, LCD, bar SoC, pendar, putaran, arus kabel,
// trip, rusak, dan reset.

const OFFGRID: [string, string][] = [
  ['pv', 'pv-generic-100wp'],
  ['scc', 'scc-pwm-rbl-20a'],
  ['bat', 'bat-vrla-agm-12v-100ah'],
  ['inv', 'inv-offgrid-500w-12v'],
  ['fan', 'load-ac-fan-50w'],
];
const OFFGRID_LINKS: [string, string][] = [
  ['pv.pos', 'scc.pv-pos'],
  ['pv.neg', 'scc.pv-neg'],
  ['scc.bat-pos', 'bat.pos'],
  ['scc.bat-neg', 'bat.neg'],
  ['bat.pos', 'inv.dc-pos'],
  ['bat.neg', 'inv.dc-neg'],
  ['inv.ac-l', 'fan.a'],
  ['inv.ac-n', 'fan.b'],
];

test('SCC mengisi: LED berkedip, LCD berangka, SoC baterai, kipas berputar, arus kabel searah', async ({
  page,
}) => {
  await seedCircuit(page, OFFGRID, OFFGRID_LINKS);

  const led = (id: string) => node(page, id).locator('.status-led');
  await expect(led('scc')).toHaveAttribute('data-led', 'green-blink');
  await expect(led('scc')).toHaveAccessibleName('Lampu SCC PWM 20A: mengisi');
  await expect(led('inv')).toHaveAttribute('data-led', 'green');

  const lcd = node(page, 'scc').getByRole('group', { name: 'LCD SCC PWM 20A' });
  const value = (row: string, kind: string) =>
    numberIn(lcd.locator(`[data-row="${row}"] [data-value="${kind}"]`));
  expect(await value('battery', 'voltage')).toBeGreaterThan(12);
  expect(await value('battery', 'current')).toBeGreaterThan(3);
  expect(await value('pv', 'voltage')).toBeGreaterThan(await value('battery', 'voltage'));

  const soc = node(page, 'bat').getByRole('meter', { name: 'SoC VRLA AGM 100Ah' });
  await expect(soc).toHaveAttribute('aria-valuenow', '80');

  await expect(node(page, 'fan').locator('.fan-blades')).toHaveAttribute('data-level', '20');

  // w1 = pv.pos → scc.pv-pos: arus keluar dari kutub positif panel, searah kabel.
  await expect(wire(page, 'w1').locator('.wire-flow')).toHaveAttribute('data-flow', 'forward');
  await expect(wire(page, 'w2').locator('.wire-flow')).toHaveAttribute('data-flow', 'reverse');

  // Arus berhenti bergerak saat jeda, bergerak saat simulasi berjalan.
  const playState = () =>
    wire(page, 'w1')
      .locator('.wire-flow')
      .evaluate((path) => getComputedStyle(path).animationPlayState);
  expect(await playState()).toBe('paused');
  await play(page);
  expect(await playState()).toBe('running');
  await pause(page);

  // Malam: PV berhenti, LED tidak lagi berkedip, kabel PV tanpa titik arus.
  await page.getByRole('slider', { name: 'Jam' }).fill('22');
  await expect(led('scc')).toHaveAttribute('data-led', 'green');
  await expect(wire(page, 'w1').locator('.wire-flow')).toHaveCount(0);
});

test('lampu berpendar sebanding daya dan padam tanpa sumber', async ({ page }) => {
  await seedCircuit(
    page,
    [
      ['bat', 'bat-vrla-agm-12v-100ah'],
      ['mcb', 'mcb-dc-32a'],
      ['lamp', 'load-dc-12v-200w'],
    ],
    [
      ['bat.pos', 'mcb.pos-in'],
      ['bat.neg', 'mcb.neg-in'],
      ['mcb.pos-out', 'lamp.a'],
      ['mcb.neg-out', 'lamp.b'],
    ],
  );
  const glow = node(page, 'lamp').locator('.lamp-glow');
  await expect(glow).toHaveCount(0);

  await page.getByRole('switch', { name: 'Tuas MCB DC 32A' }).click();
  await expect(glow).toBeVisible();
  expect(Number(await glow.getAttribute('data-level'))).toBeGreaterThanOrEqual(18);
});

test('MCB trip: tuas pindah ke OFF bertanda TRIP, lalu di-ON-kan lagi', async ({ page }) => {
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
  await expect(lever).toHaveAttribute('aria-checked', 'true');

  await setSpeed(page, 60);
  await play(page);
  await expect(lever).toHaveAttribute('aria-checked', 'false', { timeout: 15_000 });
  await expect(lever).toHaveText('TRIP');
  await expect(node(page, 'mcb').locator('.status-badge')).toContainText('TRIP');
  await expect(wire(page, 'w1').locator('.wire-flow')).toHaveCount(0);
  await pause(page);

  await lever.click();
  await expect(lever).toHaveAttribute('aria-checked', 'true');
  await expect(node(page, 'mcb').locator('.status-badge')).toHaveCount(0);
  await expect(wire(page, 'w1').locator('.wire-flow')).toHaveCount(1);
});

test('SCC rusak karena Voc PV terlalu tinggi: asap, tanda RUSAK, lalu diganti', async ({
  page,
}) => {
  await seedCircuit(
    page,
    [
      ['pv1', 'pv-generic-100wp'],
      ['pv2', 'pv-generic-100wp'],
      ['pv3', 'pv-generic-100wp'],
      ['scc', 'scc-pwm-rbl-20a'],
      ['bat', 'bat-vrla-agm-12v-100ah'],
    ],
    [
      ['pv1.pos', 'scc.pv-pos'],
      ['pv1.neg', 'pv2.pos'],
      ['pv2.neg', 'pv3.pos'],
      ['pv3.neg', 'scc.pv-neg'],
      ['scc.bat-pos', 'bat.pos'],
      ['scc.bat-neg', 'bat.neg'],
    ],
  );
  const scc = node(page, 'scc');
  await play(page);
  await expect(scc.locator('.status-badge')).toContainText('RUSAK');
  await expect(scc.locator('.smoke i')).toHaveCount(3);
  await expect(scc.locator('.crack')).toBeVisible();
  await expect(scc.locator('.status-led')).toHaveAttribute('data-led', 'red');
  await pause(page);

  // SCC pengganti utuh, tetapi tegangan PV masih di atas batas: galat, belum rusak.
  await page.getByRole('button', { name: 'Ganti SCC PWM 20A' }).click();
  await expect(scc.locator('.status-badge')).toContainText('GALAT');
  await expect(scc.locator('.crack')).toHaveCount(0);
  await expect(scc.locator('.smoke')).toHaveCount(0);
});

test('kabel terlalu kecil: memanas, rusak, lalu diganti', async ({ page }) => {
  // Inverter 500 W berbeban penuh menarik sekitar 46 A lewat kabel NYY 2,5 mm².
  await seedCircuit(
    page,
    [
      ['bat', 'bat-vrla-agm-12v-100ah'],
      ['inv', 'inv-offgrid-500w-12v'],
      ['lamp', 'load-ac-500w'],
    ],
    [
      ['bat.pos', 'inv.dc-pos'],
      ['bat.neg', 'inv.dc-neg'],
      ['inv.ac-l', 'lamp.a'],
      ['inv.ac-n', 'lamp.b'],
    ],
    { areaMm2: 2.5, cableId: 'cable-nyy-2core' },
  );
  await setSpeed(page, 600);
  await play(page);
  const replace = page.getByRole('button', { name: /^Ganti kabel w[12]$/ }).first();
  await expect(replace).toBeVisible({ timeout: 20_000 });
  await pause(page);
  await expect(node(page, 'lamp').locator('.lamp-glow')).toHaveCount(0);

  const damaged = await page.getByRole('button', { name: /^Ganti kabel/ }).count();
  await replace.click();
  await expect(page.getByRole('button', { name: /^Ganti kabel/ })).toHaveCount(damaged - 1);
});
