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

/** Menaruh komponen berurutan lewat ketukan ubin; id-nya c1, c2, … */
export async function place(page: Page, ...names: string[]) {
  for (const name of names) await tile(page, name).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(names.length);
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
