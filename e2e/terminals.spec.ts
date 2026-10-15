/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';
import { node, seedCircuit, terminal } from './sim-helpers';

// Terminal sesuai docs/UX.md §2.3: label selalu tampak, area sentuh 44 px di layar pada semua
// tingkat zoom tanpa bertumpuk dan tanpa menutupi inti badan komponen, dan gembok pada terminal
// penuh.

const label = (page: Page, nodeId: string, terminalId: string) =>
  page.locator(`[data-id="${nodeId}"] [data-handleid="${terminalId}"] .terminal-label`);

async function seed(page: Page) {
  await seedCircuit(
    page,
    [
      ['pv', 'pv-generic-100wp'],
      ['scc', 'scc-pwm-rbl-20a'],
      ['bat', 'bat-vrla-agm-12v-100ah'],
    ],
    [
      ['pv.pos', 'scc.pv-pos'],
      ['pv.neg', 'scc.pv-neg'],
    ],
  );
}

test('label terminal selalu tampak tanpa hover; label yang hanya mengulang tanda kutub tidak', async ({
  page,
}) => {
  await seed(page);
  for (const [terminalId, text] of [
    ['pv-pos', 'PV+'],
    ['bat-neg', 'BAT−'],
    ['load-pos', 'BEBAN+'],
  ] as const) {
    await expect(label(page, 'scc', terminalId)).toHaveText(text);
    await expect(label(page, 'scc', terminalId)).toHaveCSS('opacity', '1');
    await expect(label(page, 'scc', terminalId)).toHaveCSS('font-weight', '700');
  }
  // Label panel "+" sama dengan tanda di dalam titiknya: baru tampil saat komponennya dipilih.
  await expect(label(page, 'pv', 'pos')).toHaveCSS('opacity', '0');
  await node(page, 'pv').locator('.node-picture').click();
  await expect(label(page, 'pv', 'pos')).toHaveCSS('opacity', '1');
});

test('area sentuh terminal 44 px di layar pada zoom berapa pun dan tidak bertumpuk', async ({
  page,
}) => {
  await seed(page);
  const hit = terminal(page, 'bat', 'pos');
  const side = async () => Math.round((await hit.boundingBox())!.width);
  expect(await side()).toBeGreaterThanOrEqual(43);
  expect(await side()).toBeLessThanOrEqual(46);

  for (const name of ['Perkecil', 'Perkecil', 'Perbesar', 'Perbesar', 'Perbesar']) {
    await page.getByRole('button', { name }).click();
    await page.waitForTimeout(350);
    expect(await side(), name).toBeGreaterThanOrEqual(42);
    expect(await side(), name).toBeLessThanOrEqual(47);
  }

  // Terminal PV+ dan PV− SCC berdekatan: titik di tengah-tengahnya hanya milik satu terminal,
  // dan tepat di kiri-kanan garis tengah itu pemiliknya berganti.
  const owner = (x: number, y: number) =>
    page.evaluate(
      (point) =>
        document
          .elementsFromPoint(point.x, point.y)
          .filter((element) => element.classList.contains('terminal-hit'))
          .map((element) => element.closest('.react-flow__handle')?.getAttribute('data-handleid')),
      { x, y },
    );
  const center = async (terminalId: string) => {
    const box = (await terminal(page, 'scc', terminalId).boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const [positive, negative] = [await center('pv-pos'), await center('pv-neg')];
  expect(negative.x - positive.x).toBeLessThan(44);
  const middle = (positive.x + negative.x) / 2;
  expect(await owner(middle - 2, positive.y)).toEqual(['pv-pos']);
  expect(await owner(middle + 2, positive.y)).toEqual(['pv-neg']);
});

test('terminal penuh diberi gembok selama kabel ditarik', async ({ page }) => {
  await seed(page);
  const locks = page.locator('.terminal-lock');
  await expect(locks).toHaveCount(0);

  // Tarik kabel dari kutub + baterai: terminal PV+ SCC sudah berisi satu kabel (penuh).
  const from = (await terminal(page, 'bat', 'pos').boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 120, from.y - 80, { steps: 5 });
  const full = page.locator('[data-id="scc"] [data-handleid="pv-pos"]');
  await expect(full).toHaveAttribute('data-role', 'full');
  await expect(full.locator('.terminal-lock')).toBeVisible();
  // Terminal BAT+ SCC masih kosong dan boleh dituju: tanpa gembok.
  const free = page.locator('[data-id="scc"] [data-handleid="bat-pos"]');
  await expect(free).toHaveAttribute('data-role', 'allowed');
  await expect(free.locator('.terminal-lock')).toHaveCount(0);
  await page.mouse.up();
  await expect(locks).toHaveCount(0);
});

test('badan komponen kecil tetap bisa diketuk saat kanvas diperkecil', async ({ page }) => {
  await seedCircuit(page, [['fuse', 'fuse-bat-100a']], []);
  const fuse = node(page, 'fuse');
  // Perkecil sampai jarak terminal IN–OUT di bawah 44 px di layar: tanpa inti badan, kedua area
  // sentuhnya bertemu di tengah dan menutupi seluruh fuse.
  const height = async () => (await fuse.boundingBox())!.height;
  for (let step = 0; step < 15 && (await height()) >= 48; step += 1) {
    await page.getByRole('button', { name: 'Perkecil' }).click();
    await page.waitForTimeout(350);
  }
  const box = (await fuse.boundingBox())!;
  expect(box.height).toBeLessThan(48);

  // Di atas dan di bawah garis tengah IN–OUT (tepat di garis tengahnya ada celah sepiksel).
  const isBody = (fy: number) =>
    fuse.evaluate(
      (element, point) => {
        const top = document.elementFromPoint(point.x, point.y);
        return top !== null && element.contains(top) && !top.closest('.terminal');
      },
      { x: box.x + box.width / 2, y: box.y + box.height * fy },
    );
  expect(await isBody(0.4)).toBe(true);
  expect(await isBody(0.6)).toBe(true);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.4);
  await expect(fuse.locator('.component-node')).toHaveAttribute('data-selected', 'true');
});
