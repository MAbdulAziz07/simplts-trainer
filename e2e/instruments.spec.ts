/// <reference lib="dom" />
import { expect, test, type Locator, type Page } from '@playwright/test';
import { node, numberIn, seedCircuit, terminal, wire } from './sim-helpers';

// Alat ukur: multimeter (probe ke terminal), tang ampere (jepit kabel), solar power meter.

const lcd = (page: Page, name: string) =>
  page.getByRole('group', { name: `Bacaan ${name}` }).locator('.meter-digits');
const unit = (page: Page, name: string) =>
  page.getByRole('group', { name: `Bacaan ${name}` }).locator('.meter-unit');
const chip = (page: Page, tool: string) => page.locator(`.tool-chip[data-tool="${tool}"]`);
const openTool = (page: Page, name: string) =>
  page.getByRole('button', { name: `Buka ${name}` }).click();

async function center(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('elemen tidak terlihat');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function drag(page: Page, from: Locator, to: Locator) {
  const start = await center(from);
  const end = await center(to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2, { steps: 4 });
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();
}

/** Titik tengah lintasan kabel di layar. */
async function wireMiddle(page: Page, wireId: string) {
  return wire(page, wireId)
    .locator('.react-flow__edge-path')
    .evaluate((path: SVGPathElement) => {
      const middle = path.getPointAtLength(path.getTotalLength() / 2);
      const matrix = path.getScreenCTM()!;
      return { x: middle.x * matrix.a + matrix.e, y: middle.y * matrix.d + matrix.f };
    });
}

/** Baterai → MCB 32 A → beban DC 200 W. */
async function seedDc(page: Page, closed: string[]) {
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
    { closed },
  );
}

test('multimeter: seret probe ke terminal, probe terbalik bertanda minus, salah fungsi', async ({
  page,
}) => {
  await seedDc(page, ['mcb']);
  await openTool(page, 'Multimeter');
  await expect(lcd(page, 'Multimeter')).toHaveText('0,000');

  // Seret probe merah ke kutub +, ketuk probe hitam lalu ketuk kutub −.
  await drag(page, chip(page, 'red'), terminal(page, 'bat', 'pos'));
  await chip(page, 'black').click();
  await expect(page.getByRole('status')).toHaveText('Ketuk terminal untuk probe hitam');
  await terminal(page, 'bat', 'neg').click();

  await expect(node(page, 'bat').getByRole('img', { name: 'Probe merah' })).toHaveCount(1);
  await expect(node(page, 'bat').getByRole('img', { name: 'Probe hitam' })).toHaveCount(1);
  await expect(node(page, 'bat').locator('.probe-grip')).toHaveCount(2);
  // Menempelkan probe tidak memasang kabel baru.
  await expect(page.locator('.react-flow__edge')).toHaveCount(4);
  const voltage = await numberIn(lcd(page, 'Multimeter'));
  expect(voltage).toBeGreaterThan(12);
  expect(voltage).toBeLessThan(13.5);
  await expect(unit(page, 'Multimeter')).toHaveText('V');

  // Angka diperbarui dua kali per detik dengan derau kecil.
  const seen = new Set<string>();
  for (let i = 0; i < 6; i += 1) {
    seen.add((await lcd(page, 'Multimeter').textContent()) ?? '');
    await page.waitForTimeout(300);
  }
  expect(seen.size).toBeGreaterThan(1);

  // Salah fungsi: VAC pada DC terbaca nol; ohm pada rangkaian bertegangan tidak bermakna.
  await page.getByRole('radio', { name: 'Tegangan AC' }).click();
  await expect(lcd(page, 'Multimeter')).toHaveText('0,000');
  await page.getByRole('radio', { name: /^Tahanan/ }).click();
  await expect(unit(page, 'Multimeter')).toContainText('Ω');
  const live = (await lcd(page, 'Multimeter').textContent()) ?? '';
  expect(live === 'OL' || Math.abs(Number(live.replace(',', '.'))) > 1).toBe(true);

  // Probe ditukar: tanda minus.
  await page.getByRole('radio', { name: 'Tegangan DC' }).click();
  await drag(
    page,
    node(page, 'bat').locator('[data-probe="red"] .probe-grip'),
    terminal(page, 'lamp', 'b'),
  );
  await drag(
    page,
    node(page, 'bat').locator('[data-probe="black"] .probe-grip'),
    terminal(page, 'lamp', 'a'),
  );
  await expect.poll(() => numberIn(lcd(page, 'Multimeter'))).toBeLessThan(-12);
});

test('multimeter ohm: tahanan beban terbaca saat MCB OFF, terbuka = OL', async ({ page }) => {
  await seedDc(page, []);
  await openTool(page, 'Multimeter');
  await page.getByRole('radio', { name: /^Tahanan/ }).click();
  await expect(lcd(page, 'Multimeter')).toHaveText('OL');

  await drag(page, chip(page, 'red'), terminal(page, 'lamp', 'a'));
  await drag(page, chip(page, 'black'), terminal(page, 'lamp', 'b'));
  // 12² / 200 W = 0,72 Ω ditambah kabel probe 0,2 Ω.
  await expect.poll(() => numberIn(lcd(page, 'Multimeter'))).toBeCloseTo(0.9, 1);

  // Melintasi MCB yang OFF: rangkaian terbuka.
  await drag(page, chip(page, 'black'), terminal(page, 'bat', 'pos'));
  await expect(lcd(page, 'Multimeter')).toHaveText('OL');
});

test('tang ampere: jepit kabel, tanda arah pada DC, nol pada mode AC', async ({ page }) => {
  await seedDc(page, ['mcb']);
  await openTool(page, 'Tang ampere');
  await expect(lcd(page, 'Tang ampere')).toHaveText('0,000');

  // Ketuk jepitan lalu ketuk kabel w1 (kutub + baterai → MCB).
  await chip(page, 'clamp').click();
  const first = await wireMiddle(page, 'w1');
  await page.mouse.click(first.x, first.y);
  await expect(page.getByRole('img', { name: 'Jepitan' }).locator('.clamp-glyph')).toBeVisible();
  // Menjepit kabel tidak memilih kabelnya.
  await expect(page.getByText('Jenis kabel')).toHaveCount(0);
  await expect.poll(() => numberIn(lcd(page, 'Tang ampere'))).toBeGreaterThan(14);

  await page.getByRole('radio', { name: 'Arus AC' }).click();
  await expect(lcd(page, 'Tang ampere')).toHaveText('0,000');
  await page.getByRole('radio', { name: 'Arus DC' }).click();

  // Kabel balik (w2: kutub − baterai → MCB) berarus melawan arah kabel: tanda minus.
  const second = await wireMiddle(page, 'w2');
  const jaw = await center(chip(page, 'clamp'));
  await page.mouse.move(jaw.x, jaw.y);
  await page.mouse.down();
  await page.mouse.move(second.x, second.y, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => numberIn(lcd(page, 'Tang ampere'))).toBeLessThan(-14);
});

test('solar power meter menampilkan iradiasi dan mengikuti slider', async ({ page }) => {
  await page.goto('/');
  await openTool(page, 'Solar power meter');
  await expect(unit(page, 'Solar power meter')).toHaveText('W/m²');
  await expect.poll(() => numberIn(lcd(page, 'Solar power meter'))).toBeGreaterThan(700);

  await page.getByRole('slider', { name: 'Iradiasi' }).fill('400');
  await expect.poll(() => numberIn(lcd(page, 'Solar power meter'))).toBeLessThan(410);
  expect(await numberIn(lcd(page, 'Solar power meter'))).toBeGreaterThan(390);

  await page.getByRole('button', { name: 'Tutup Solar power meter' }).first().click();
  await expect(page.getByRole('group', { name: 'Bacaan Solar power meter' })).toHaveCount(0);
});
