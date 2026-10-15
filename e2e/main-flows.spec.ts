/// <reference lib="dom" />
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  clockMinutes,
  connect,
  dragTile,
  node,
  numberIn,
  openParams,
  pause,
  play,
  setSpeed,
  terminal,
} from './sim-helpers';

// Alur utama peserta (docs/PRD.md): preset → jalan, rakit dengan seret, ukur Voc,
// simpan → buka. Skenario P1 dan Cari Gangguan ada di scenario-flows.spec.ts.

const nodes = (page: Page) => page.locator('.react-flow__node');
const wires = (page: Page) => page.locator('.react-flow__edge');
const findings = (page: Page) => page.getByRole('button', { name: /temuan pemeriksaan$/ });
const meterLcd = (page: Page) =>
  page.getByRole('group', { name: 'Bacaan Multimeter' }).locator('.meter-digits');

async function loadPreset(page: Page, name: string) {
  await page.getByRole('button', { name: 'Preset' }).click();
  await page.getByRole('menuitem', { name }).click();
}

test('1. preset Minimum dimuat lalu simulasi berjalan', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await loadPreset(page, 'Minimum');
  await expect(nodes(page)).toHaveCount(15);

  const startMinutes = await clockMinutes(page);
  await setSpeed(page, 600);
  await play(page);
  await expect.poll(() => clockMinutes(page)).toBeGreaterThanOrEqual(startMinutes + 20);
  await pause(page);
  expect(errors).toEqual([]);
});

/** Inti DC off-grid paket Minimum; id node mengikuti urutan taruh c1…c6. */
const OFFGRID_TILES: [string, { x: number; y: number }][] = [
  ['Panel 100 Wp', { x: 420, y: 230 }],
  ['MCB', { x: 760, y: 230 }],
  ['SCC PWM 20A', { x: 1100, y: 230 }],
  ['VRLA AGM 100Ah', { x: 420, y: 520 }],
  ['Fuse Baterai 100A', { x: 760, y: 520 }],
  ['Beban DC 12V', { x: 1100, y: 520 }],
];
const OFFGRID_LINKS: [string, string][] = [
  ['c1.pos', 'c2.pos-in'],
  ['c1.neg', 'c2.neg-in'],
  ['c2.pos-out', 'c3.pv-pos'],
  ['c2.neg-out', 'c3.pv-neg'],
  ['c4.pos', 'c5.in'],
  ['c5.out', 'c3.bat-pos'],
  ['c4.neg', 'c3.bat-neg'],
  ['c3.load-pos', 'c6.a'],
  ['c3.load-neg', 'c6.b'],
];

test('2. rakit off-grid Minimum dari meja kosong dengan seret dan lepas', async ({ page }) => {
  await page.goto('/');
  await expect(nodes(page)).toHaveCount(0);
  // Perkecil dulu supaya enam komponen muat tanpa bertumpuk.
  for (let i = 0; i < 3; i += 1) await page.getByRole('button', { name: 'Perkecil' }).click();

  for (const [index, [name, drop]] of OFFGRID_TILES.entries()) {
    await dragTile(page, name, drop);
    await expect(nodes(page)).toHaveCount(index + 1);
  }
  const boxes = await nodes(page).evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().toJSON() as DOMRect),
  );
  for (const [i, a] of boxes.entries())
    for (const b of boxes.slice(i + 1))
      expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(
        true,
      );

  await page.getByRole('button', { name: 'Paskan ke layar' }).click();
  await connect(page, ...OFFGRID_LINKS);

  await page.getByRole('switch', { name: 'Tuas MCB DC 16A' }).click();
  const fuse = page.getByRole('switch', { name: /Fuse Baterai 100A/ });
  if ((await fuse.count()) > 0 && !(await fuse.isChecked())) await fuse.click();

  await expect(findings(page)).not.toHaveAttribute('data-severity', 'danger');
  // Terminal BEBAN SCC dibatasi 10 A: beban 200 W diturunkan ke 60 W supaya tidak beban lebih.
  await openParams(page);
  await node(page, 'c6').locator('.node-picture').click();
  await page.getByRole('slider', { name: 'Setelan daya Beban DC 12V' }).fill('60');
  await setSpeed(page, 60);
  await play(page);
  await expect(node(page, 'c3').locator('.status-led')).toHaveAttribute('data-led', 'green-blink');
  await pause(page);
});

test('3. ukur Voc panel dengan multimeter, sesuai rating datasheet', async ({ page }) => {
  const catalog = JSON.parse(await readFile('src/data/catalog/pv-modules.json', 'utf8')) as {
    items: { id: string; electrical: { vocV: number } }[];
  };
  const ratedVocV = catalog.items.find((item) => item.id === 'pv-generic-100wp')!.electrical.vocV;

  await page.goto('/');
  await loadPreset(page, 'Minimum');
  await page.getByRole('button', { name: 'Buka Multimeter' }).click();
  await page.getByRole('radio', { name: 'Tegangan DC' }).click();
  await page.locator('.tool-chip[data-tool="red"]').click();
  await terminal(page, 'pv1', 'pos').click();
  await page.locator('.tool-chip[data-tool="black"]').click();
  await terminal(page, 'pv1', 'neg').click();

  // Panel tanpa beban: sel panas sedikit di bawah Voc label (STC 25 °C).
  await expect.poll(() => numberIn(meterLcd(page))).toBeGreaterThan(ratedVocV * 0.85);
  expect(await numberIn(meterLcd(page))).toBeLessThanOrEqual(ratedVocV * 1.02);
});

test('6. simpan rangkaian ke berkas lalu buka kembali di meja lain', async ({ page }) => {
  await page.goto('/');
  await loadPreset(page, 'Minimum');
  await connect(page, ['pv1.pos', 'mcb-pv.pos-in'], ['pv1.neg', 'mcb-pv.neg-in']);
  await page.getByRole('switch', { name: 'Tuas MCB DC 16A' }).click();
  const before = await nodes(page).evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-id')).sort(),
  );

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Simpan' }).click(),
  ]);
  const file = await download.path();
  const saved = JSON.parse(await readFile(file, 'utf8')) as {
    components: unknown[];
    wires: unknown[];
    closedSwitchIds: string[];
  };
  expect(saved.components).toHaveLength(15);
  expect(saved.wires).toHaveLength(2);
  expect(saved.closedSwitchIds).toContain('mcb-pv');

  // Meja diganti preset lain, lalu berkas dibuka.
  await loadPreset(page, 'Terbaik');
  await expect(nodes(page)).not.toHaveCount(15);
  await page.setInputFiles('input[type="file"]', file);
  await expect(page.getByRole('status')).toHaveText('Rangkaian dibuka');
  await expect(wires(page)).toHaveCount(2);
  const after = await nodes(page).evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-id')).sort(),
  );
  expect(after).toEqual(before);
  await expect(page.getByRole('switch', { name: 'Tuas MCB DC 16A' })).toBeChecked();
});
