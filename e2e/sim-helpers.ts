/// <reference lib="dom" />
import { expect, type Locator, type Page } from '@playwright/test';

// Pembantu uji alur simulasi: menaruh komponen lewat baki, memasang kabel, dan kendali bawah.

export const tile = (page: Page, name: string) =>
  page.getByRole('button', { name: `Tambah ${name}` });
export const node = (page: Page, nodeId: string) =>
  page.locator(`.react-flow__node[data-id="${nodeId}"]`);
export const wire = (page: Page, wireId: string) =>
  page.locator(`.react-flow__edge[data-id="${wireId}"]`);
export const terminal = (page: Page, nodeId: string, terminalId: string) =>
  page.locator(`[data-id="${nodeId}"] [data-handleid="${terminalId}"] .terminal-hit`);
export const slider = (page: Page, name: string) => page.getByRole('slider', { name });
/** Menyalakan tombol "Parameter" di bilah atas; inspektur tidak terbuka otomatis. */
export const openParams = (page: Page) =>
  page.getByRole('button', { name: 'Parameter', exact: true }).click();

/** Menaruh komponen berurutan lewat ketukan ubin; id-nya c1, c2, … */
export async function place(page: Page, ...names: string[]) {
  for (const name of names) await tile(page, name).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(names.length);
}

/** Titik tengah elemen di layar. */
export async function center(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('elemen tidak terlihat');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Seret ubin baki dengan tetikus lalu lepas di titik layar `drop`. */
export async function dragTile(page: Page, name: string, drop: { x: number; y: number }) {
  await tile(page, name).scrollIntoViewIfNeeded();
  const from = await center(tile(page, name));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + drop.x) / 2, (from.y + drop.y) / 2, { steps: 5 });
  await page.mouse.move(drop.x, drop.y, { steps: 5 });
  await page.mouse.up();
}

/** Klik terminal asal lalu terminal tujuan; `a.b` = komponen.terminal. */
export async function connect(page: Page, ...links: [string, string][]) {
  for (const [from, to] of links) {
    const [fromNode = '', fromTerminal = ''] = from.split('.');
    const [toNode = '', toTerminal = ''] = to.split('.');
    await terminal(page, fromNode, fromTerminal).click();
    await terminal(page, toNode, toTerminal).click();
  }
  await expect(page.locator('.react-flow__edge')).toHaveCount(links.length);
}

export const play = (page: Page) => page.getByRole('button', { name: 'Jalankan simulasi' }).click();
export const pause = (page: Page) => page.getByRole('button', { name: 'Jeda simulasi' }).click();
export const setSpeed = (page: Page, multiple: number) =>
  page.getByRole('radio', { name: `${multiple}×`, exact: true }).click();

/** Jam simulasi dalam menit sejak 00:00. */
export async function clockMinutes(page: Page): Promise<number> {
  const text = (await slider(page, 'Jam').getAttribute('aria-valuetext')) ?? '';
  const [hours = '0', minutes = '0'] = text.split(':');
  return Number(hours) * 60 + Number(minutes);
}

/** Angka pertama pada teks elemen, mis. `13,4 V` → 13.4. */
export async function numberIn(locator: Locator): Promise<number> {
  const text = (await locator.textContent()) ?? '';
  const match = /-?\d+(?:[.,]\d+)?/.exec(text.replace(/\.(?=\d{3})/g, ''));
  return match ? Number(match[0].replace(',', '.')) : Number.NaN;
}

export interface SeedOptions {
  /** Penampang semua kabel; bawaan 4 mm². */
  areaMm2?: number;
  /** Id kabel katalog; bawaan kabel PV. */
  cableId?: string;
  /** MCB/fuse yang ON. */
  closed?: string[];
}

/**
 * Memuat rangkaian jadi lewat simpan otomatis, tingkat Mahir. `parts` = [id, id katalog];
 * `links` = pasangan `komponen.terminal`; kabelnya w1, w2, … Komponen ditata berjajar lalu
 * meja dipaskan ke layar.
 */
export async function seedCircuit(
  page: Page,
  parts: [string, string][],
  links: [string, string][],
  { areaMm2 = 4, cableId = 'cable-pv-h1z2z2k', closed = [] }: SeedOptions = {},
) {
  const COLUMNS = 3;
  const project = {
    app: 'simplts',
    formatVersion: 1,
    packageId: 'min',
    components: parts.map(([id, catalogId], index) => ({
      id,
      catalogId,
      xPx: 48 + (index % COLUMNS) * 384,
      yPx: 96 + Math.floor(index / COLUMNS) * 384,
      rotationDeg: 0,
    })),
    wires: links.map(([from, to], index) => {
      const [fromNode = '', fromTerminal = ''] = from.split('.');
      const [toNode = '', toTerminal = ''] = to.split('.');
      return {
        id: `w${index + 1}`,
        from: { componentId: fromNode, terminalId: fromTerminal },
        to: { componentId: toNode, terminalId: toTerminal },
        cableId,
        areaMm2,
        lengthM: 1,
      };
    }),
    closedSwitchIds: closed,
  };
  await page.goto('/');
  await page.evaluate(
    (saved) => {
      window.localStorage.setItem('simplts.autosave.v1', JSON.stringify(saved));
    },
    { project, level: 'expert' },
  );
  await page.reload();
  await expect(page.locator('.react-flow__node')).toHaveCount(parts.length);
  await expect(page.locator('.react-flow__edge')).toHaveCount(links.length);
  await page.getByRole('button', { name: 'Paskan ke layar' }).click();
}
