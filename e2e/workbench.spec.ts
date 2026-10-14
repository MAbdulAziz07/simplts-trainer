/// <reference lib="dom" />
// Tipe DOM di atas hanya untuk fungsi yang dijalankan di dalam halaman (`page.evaluate`).
import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';

// Alur meja kerja pada layar acuan 1366x768: baki → node → kabel → aksi → berkas.

const tile = (page: Page, name: string) => page.getByRole('button', { name: `Tambah ${name}` });
const nodes = (page: Page) => page.locator('.react-flow__node');
const wires = (page: Page) => page.locator('.react-flow__edge');
const toast = (page: Page) => page.getByRole('status');
const terminal = (page: Page, nodeId: string, terminalId: string) =>
  page.locator(`[data-id="${nodeId}"] [data-handleid="${terminalId}"] .terminal-hit`);

async function center(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('elemen tidak terlihat');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Klik terminal asal lalu terminal tujuan (docs/PRD.md US3). */
async function connect(page: Page, from: [string, string], to: [string, string]) {
  await terminal(page, ...from).click();
  await terminal(page, ...to).click();
}

/** Klik tepat di tengah lintasan kabel. */
async function clickWire(page: Page, wireId: string) {
  const point = await page.evaluate((id) => {
    const path = document.querySelector<SVGPathElement>(`[data-id="${id}"] .react-flow__edge-path`);
    if (!path) throw new Error(`kabel ${id} tidak ada`);
    const middle = path.getPointAtLength(path.getTotalLength() / 2);
    const matrix = path.getScreenCTM()!;
    return { x: middle.x * matrix.a + matrix.e, y: middle.y * matrix.d + matrix.f };
  }, wireId);
  await page.mouse.click(point.x, point.y);
}

/** Panel (c1) dan SCC PWM (c2) lewat ketukan ubin baki. */
async function placePanelAndScc(page: Page) {
  await page.goto('/');
  await tile(page, 'Panel 100 Wp').click();
  await tile(page, 'SCC PWM 20A').click();
  await expect(nodes(page)).toHaveCount(2);
}

test('ketuk ubin menaruh komponen tanpa bertumpuk; klik dua terminal memasang kabel', async ({
  page,
}) => {
  await placePanelAndScc(page);
  const panel = (await nodes(page).nth(0).boundingBox())!;
  const scc = (await nodes(page).nth(1).boundingBox())!;
  expect(panel.x + panel.width <= scc.x || scc.x + scc.width <= panel.x).toBe(true);

  await connect(page, ['c1', 'pos'], ['c2', 'pv-pos']);
  await expect(wires(page)).toHaveCount(1);
  // Warna kabel mengikuti terminal asal: DC+ merah.
  await expect(wires(page).locator('.react-flow__edge-path')).toHaveCSS(
    'stroke',
    'rgb(220, 38, 38)',
  );
});

test('Pemula menolak + ke − dengan petunjuk; Mahir mengizinkan', async ({ page }) => {
  await placePanelAndScc(page);
  await connect(page, ['c1', 'pos'], ['c2', 'pv-neg']);
  await expect(toast(page)).toHaveText('Kutub + tidak disambung ke kutub −');
  await expect(wires(page)).toHaveCount(0);

  await page.getByRole('radio', { name: 'Mahir' }).click();
  await connect(page, ['c1', 'pos'], ['c2', 'pv-neg']);
  await expect(wires(page)).toHaveCount(1);

  // Penolakan mekanis tetap berlaku di Mahir: terminal SCC hanya menerima satu kabel.
  await connect(page, ['c1', 'neg'], ['c2', 'pv-neg']);
  await expect(toast(page)).toHaveText('Terminal penuh, cabangkan lewat busbar');
  await expect(wires(page)).toHaveCount(1);
});

test('klik kabel untuk memilih penampang dan panjang; tersimpan saat dimuat ulang', async ({
  page,
}) => {
  await placePanelAndScc(page);
  await connect(page, ['c1', 'pos'], ['c2', 'pv-pos']);
  await clickWire(page, 'w1');
  const options = page.getByRole('dialog', { name: 'Kabel w1' });
  await expect(options.getByRole('radio', { name: '4 mm²' })).toBeChecked();
  // Kabel PV tidak punya 1,5 mm² di tabelnya.
  await expect(options.getByRole('radio', { name: '1,5 mm²' })).toBeDisabled();

  await options.getByRole('radio', { name: '10 mm²' }).click();
  await options.getByLabel('Panjang kabel (m)').fill('7,5');
  await options.getByLabel('Panjang kabel (m)').press('Enter');
  await expect(wires(page).locator('.react-flow__edge-path')).toHaveCSS('stroke-width', '6px');

  await page.reload();
  await expect(wires(page)).toHaveCount(1);
  await clickWire(page, 'w1');
  await expect(options.getByRole('radio', { name: '10 mm²' })).toBeChecked();
  await expect(options.getByLabel('Panjang kabel (m)')).toHaveValue('7,5');
});

test('seret ubin dari baki: komponen jatuh di tempat dilepas', async ({ page }) => {
  await page.goto('/');
  const from = await center(tile(page, 'VRLA AGM 100Ah'));
  const drop = { x: 700, y: 300 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(400, 250, { steps: 5 });
  await page.mouse.move(drop.x, drop.y, { steps: 5 });
  await page.mouse.up();

  await expect(nodes(page)).toHaveCount(1);
  const placed = await center(nodes(page));
  // Selisih paling banyak setengah kisi 24 px ditambah pembulatan ukuran.
  expect(Math.abs(placed.x - drop.x)).toBeLessThanOrEqual(13);
  expect(Math.abs(placed.y - drop.y)).toBeLessThanOrEqual(13);
});

test.describe('layar sentuh', () => {
  test.use({ hasTouch: true });

  test('seret ubin dengan jari menaruh komponen', async ({ page }) => {
    await page.goto('/');
    const from = await center(tile(page, 'Panel 100 Wp'));
    const touch = await page.context().newCDPSession(page);
    const at = (x: number, y: number) => ({ touchPoints: [{ x, y }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', ...at(from.x, from.y) });
    for (let step = 1; step <= 8; step++)
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        ...at(from.x + ((640 - from.x) * step) / 8, from.y + ((320 - from.y) * step) / 8),
      });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    await expect(nodes(page)).toHaveCount(1);
    const placed = await center(nodes(page));
    expect(Math.abs(placed.x - 640)).toBeLessThanOrEqual(13);
    expect(Math.abs(placed.y - 320)).toBeLessThanOrEqual(13);
  });
});

test('tuas MCB, putar, hapus, dan undo/redo', async ({ page }) => {
  await page.goto('/');
  await tile(page, 'MCB').click();
  const lever = page.getByRole('switch', { name: 'Tuas MCB DC 16A' });
  await expect(lever).toHaveText('OFF');
  await lever.click();
  await expect(lever).toHaveText('ON');
  await expect(lever).toBeChecked();

  // Putar 90°: kotak node menukar lebar dan tinggi.
  const upright = (await nodes(page).boundingBox())!;
  await nodes(page).click({ position: { x: 10, y: 10 } });
  await page.keyboard.press('r');
  await expect
    .poll(async () => Math.round((await nodes(page).boundingBox())!.width))
    .toBe(Math.round(upright.height));

  await page.keyboard.press('Delete');
  await expect(nodes(page)).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(nodes(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Urungkan (Ctrl+Z)' }).click();
  await expect
    .poll(async () => Math.round((await nodes(page).boundingBox())!.width))
    .toBe(Math.round(upright.width));
  await page.keyboard.press('Control+y');
  await expect
    .poll(async () => Math.round((await nodes(page).boundingBox())!.width))
    .toBe(Math.round(upright.height));
});

test('preset, simpan ke berkas, dan buka kembali', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Preset' }).click();
  await page.getByRole('menuitem', { name: 'Minimum' }).click();
  await expect(nodes(page)).toHaveCount(15);
  await expect(wires(page)).toHaveCount(0);
  // Seluruh preset terlihat di meja setelah dimuat.
  await expect(page.locator('[data-id="rod"]')).toBeInViewport();

  await connect(page, ['pv1', 'pos'], ['mcb-pv', 'pos-in']);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Simpan' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^rangkaian-min-\d{8}-\d{4}\.simplts\.json$/);
  const file = await download.path();
  const saved = JSON.parse(await readFile(file, 'utf8')) as { formatVersion: number };
  expect(saved.formatVersion).toBe(1);

  await page.getByRole('button', { name: 'Preset' }).click();
  await page.getByRole('menuitem', { name: 'Terbaik' }).click();
  await expect(nodes(page)).toHaveCount(30);

  await page.setInputFiles('input[type="file"]', file);
  await expect(toast(page)).toHaveText('Rangkaian dibuka');
  await expect(nodes(page)).toHaveCount(15);
  await expect(wires(page)).toHaveCount(1);

  await page.reload();
  await expect(nodes(page)).toHaveCount(15);
  await expect(wires(page)).toHaveCount(1);
});

test('halaman pengembang editor terminal menampilkan gambar dan terminal', async ({ page }) => {
  await page.goto('/dev/terminal-editor#scc-pwm-rbl-20a');
  await expect(page.getByRole('heading', { name: 'Editor terminal' })).toBeVisible();
  await expect(page.getByTestId('terminal-canvas')).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Terminal' }).getByRole('radio')).toHaveCount(
    6,
  );
});
