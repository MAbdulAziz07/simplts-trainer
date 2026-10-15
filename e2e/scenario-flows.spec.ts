/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';
import { connect, node, numberIn, pause, play, setSpeed, terminal } from './sim-helpers';

// Alur utama skenario: P1 (LKPD 1) dari awal sampai ringkasan nilai, dan mode Cari Gangguan
// dengan fuse baterai putus.

const panel = (page: Page) => page.getByRole('region', { name: 'Langkah skenario' });
const currentStep = (page: Page) => panel(page).locator('[data-step-id]');
const meterLcd = (page: Page) =>
  page.getByRole('group', { name: 'Bacaan Multimeter' }).locator('.meter-digits');

/** Membuka skenario dengan gangguan pilihan instruktur. */
async function startWithFault(page: Page, title: string, fault: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skenario' }).click();
  const dialog = page.getByRole('dialog', { name: 'Pilih skenario' });
  await dialog.getByRole('button', { name: new RegExp(title) }).click();
  await dialog.getByText('Pilihan instruktur').click();
  await dialog.getByRole('button', { name: fault }).click();
  await dialog.getByRole('button', { name: 'Mulai' }).click();
  await expect(dialog).toBeHidden();
}

/** Probe merah lalu hitam diketukkan ke terminal `komponen.terminal`. */
async function probe(page: Page, red: string, black: string) {
  const [redNode = '', redTerminal = ''] = red.split('.');
  const [blackNode = '', blackTerminal = ''] = black.split('.');
  await page.locator('.tool-chip[data-tool="red"]').click();
  await terminal(page, redNode, redTerminal).click();
  await page.locator('.tool-chip[data-tool="black"]').click();
  await terminal(page, blackNode, blackTerminal).click();
}

/** Titik di badan komponen yang tidak tertutup area sentuh terminal; `null` bila tidak ada. */
const freePoint = (page: Page, componentId: string) =>
  node(page, componentId).evaluate((element) => {
    const box = element.getBoundingClientRect();
    for (let fy = 0.5; fy >= 0; fy -= 0.05)
      for (const fx of [0.5, 0.35, 0.65, 0.2, 0.8]) {
        const x = box.x + box.width * fx;
        const y = box.y + box.height * fy;
        const top = document.elementFromPoint(x, y);
        if (top && element.contains(top) && !top.closest('.terminal')) return { x, y };
      }
    return null;
  });

/**
 * Mengetuk badan komponen tanpa memperbesar kanvas: inti badan komponen kecil (mis. fuse) tidak
 * tertutup area sentuh terminal pada zoom berapa pun.
 */
async function clickNodeBody(page: Page, componentId: string) {
  const point = await freePoint(page, componentId);
  if (!point) throw new Error(`badan ${componentId} tertutup terminal`);
  await page.mouse.click(point.x, point.y);
}

/** Tunjuk komponen sebagai penyebab dengan jenis gangguan `kind`, lalu Diagnosa. */
async function diagnose(page: Page, componentId: string, kind: string) {
  const open = panel(page).getByRole('button', { name: 'Tunjuk penyebab' });
  if (await open.isVisible()) await open.click();
  await clickNodeBody(page, componentId);
  await panel(page).getByRole('button', { name: kind, exact: true }).click();
  await panel(page).getByRole('button', { name: 'Diagnosa' }).click();
}

/** `true` bila titik tengah terminal tidak tertutup elemen lain (bisa diketuk). */
async function isTappable(page: Page, ref: string) {
  const [nodeId = '', terminalId = ''] = ref.split('.');
  return terminal(page, nodeId, terminalId).evaluate((hit) => {
    const box = hit.getBoundingClientRect();
    const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return top !== null && (top === hit || hit.contains(top));
  });
}

const expectStep = (page: Page, id: string) =>
  expect(currentStep(page)).toHaveAttribute('data-step-id', id);

test('4. skenario P1 dikerjakan sampai selesai dengan nilai lulus', async ({ page }) => {
  await startWithFault(page, 'P1 Mengenal komponen', 'Sel baterai lemah — bat');
  await page.getByRole('button', { name: 'Buka Multimeter' }).click();
  await page.getByRole('radio', { name: 'Tegangan DC' }).click();
  // Rangkaian dipaskan di kanan panel langkah: terminal yang diminta P1 bisa diketuk.
  for (const at of ['bat.pos', 'bat.neg', 'pv1.pos', 'pv1.neg', 'fuse-bat.in', 'scc.load-pos'])
    await expect.poll(() => isTappable(page, at), { message: `terminal ${at}` }).toBe(true);

  await expectStep(page, 'ukur-baterai');
  await probe(page, 'bat.pos', 'bat.neg');
  // Sel lemah: bacaan jauh di bawah ~12,6 V, langkah tertahan sampai penyebabnya ditunjuk.
  await expect.poll(() => numberIn(meterLcd(page))).toBeLessThan(12.3);
  await expectStep(page, 'ukur-baterai');
  await diagnose(page, 'bat', 'Sel baterai lemah');
  await expectStep(page, 'ukur-voc');
  await probe(page, 'pv1.pos', 'pv1.neg');
  await expectStep(page, 'ukur-fuse');
  await page.getByRole('radio', { name: /^Tahanan/ }).click();
  await probe(page, 'fuse-bat.in', 'fuse-bat.out');

  await expectStep(page, 'baterai-scc');
  await connect(
    page,
    ['bat.pos', 'fuse-bat.in'],
    ['fuse-bat.out', 'scc.bat-pos'],
    ['bat.neg', 'scc.bat-neg'],
  );

  await expectStep(page, 'ukur-beban-scc');
  await setSpeed(page, 60);
  await play(page);
  await page.getByRole('radio', { name: 'Tegangan DC' }).click();
  await probe(page, 'scc.load-pos', 'scc.load-neg');
  // Penyebab sudah ditunjuk di langkah 1: langkah "tunjuk" langsung terlewati.
  // Langkah "aman" juga terpenuhi otomatis: tidak ada temuan bahaya.
  await expect(panel(page)).toContainText('Semua langkah selesai', { timeout: 15_000 });
  await pause(page);

  await panel(page).getByRole('button', { name: 'Selesai' }).click();
  const summary = page.getByRole('dialog', { name: 'Hasil skenario' });
  await expect(summary).toContainText('Sel baterai lemah — bat');
  expect(await numberIn(page.getByTestId('scenario-score-pct'))).toBeGreaterThanOrEqual(70);
});

test('5. Cari Gangguan: fuse baterai putus terbaca OL lalu ditunjuk', async ({ page }) => {
  await startWithFault(page, 'Cari gangguan PLTS off-grid', 'Fuse putus — fuse-bat');
  await expect(panel(page)).toContainText('0/1 gangguan ditemukan');

  // Gejala: tanpa baterai, tegangan di terminal BAT SCC hanya dari PV (atau nol pada malam).
  await page.getByRole('button', { name: 'Buka Multimeter' }).click();
  await page.getByRole('radio', { name: /^Tahanan/ }).click();
  await probe(page, 'fuse-bat.in', 'fuse-bat.out');
  await expect(meterLcd(page)).toHaveText('OL');

  // Jawaban salah dulu (baterai), lalu fuse.
  await diagnose(page, 'bat', 'Sel baterai lemah');
  await expect(panel(page).getByRole('status')).toHaveText('Belum tepat. Ukur lagi.');
  await diagnose(page, 'fuse-bat', 'Fuse putus');
  await expect(panel(page)).not.toContainText('gangguan ditemukan');

  await panel(page).getByRole('button', { name: 'Selesai' }).click();
  const summary = page.getByRole('dialog', { name: 'Hasil skenario' });
  await expect(summary).toContainText('Fuse putus — fuse-bat');
});
