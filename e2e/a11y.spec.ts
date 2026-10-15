/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';

// Aksesibilitas dasar (WCAG 2.1 AA) tanpa pustaka tambahan: kontras warna teks, ukuran target
// sentuh 44 px (docs/UX.md), dan navigasi keyboard pada bilah atas.

const AREAS = ['Bilah atas', 'Baki komponen', 'Kendali simulasi'];

/**
 * Kontras setiap elemen yang punya teks langsung di area `areaName`. Latar diambil dari leluhur
 * terdekat yang tidak transparan; warna semi-transparan dicampur ke latar itu.
 */
async function contrastFailures(page: Page, areaName: string) {
  return page.evaluate((name) => {
    const area = document.querySelector(`[aria-label="${name}"]`);
    if (!area) return [`area ${name} tidak ada`];
    const parse = (value: string) => {
      const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(value);
      return m
        ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])]
        : null;
    };
    const blend = (top: number[], bottom: number[]) =>
      [0, 1, 2].map((i) => top[i]! * top[3]! + bottom[i]! * (1 - top[3]!)).concat(1);
    const background = (element: Element | null): number[] => {
      const layers: number[][] = [];
      for (let at = element; at; at = at.parentElement) {
        const color = parse(getComputedStyle(at).backgroundColor);
        if (color && color[3]! > 0) {
          layers.push(color);
          if (color[3] === 1) break;
        }
      }
      return layers.reduceRight((under, layer) => blend(layer, under), [255, 255, 255, 1]);
    };
    const luminance = (rgb: number[]) => {
      const [r, g, b] = rgb.slice(0, 3).map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const failures: string[] = [];
    for (const element of area.querySelectorAll('*')) {
      const ownText = [...element.childNodes]
        .filter((child) => child.nodeType === Node.TEXT_NODE)
        .map((child) => child.textContent?.trim() ?? '')
        .join('');
      if (!ownText) continue;
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      if (style.visibility === 'hidden' || box.width === 0 || box.height === 0) continue;
      if ((element as HTMLElement).closest('[disabled],[aria-disabled="true"]')) continue;
      const bg = background(element);
      const fg = blend(parse(style.color) ?? [0, 0, 0, 1], bg);
      const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
      const ratio = (hi! + 0.05) / (lo! + 0.05);
      const sizePx = parseFloat(style.fontSize);
      const large = sizePx >= 24 || (sizePx >= 18.66 && Number(style.fontWeight) >= 700);
      const need = large ? 3 : 4.5;
      if (ratio < need)
        failures.push(`"${ownText.slice(0, 30)}" ${ratio.toFixed(2)}:1 < ${need}:1 (${sizePx}px)`);
    }
    return failures;
  }, areaName);
}

for (const area of AREAS) {
  test(`kontras teks di ${area} memenuhi WCAG AA`, async ({ page }) => {
    await page.goto('/');
    expect(await contrastFailures(page, area)).toEqual([]);
  });
}

test('target sentuh di bilah atas, baki, kendali simulasi, dan alat meja minimal 44 px', async ({
  page,
}) => {
  await page.goto('/');
  const small = await page.evaluate(() => {
    const scopes = ['Bilah atas', 'Baki komponen', 'Kendali simulasi', 'Alat meja kerja'];
    const selector =
      'button, [role="button"], [role="radio"], [role="switch"], [role="tab"], a[href], input, select, [role="slider"]';
    const result: string[] = [];
    for (const scope of scopes) {
      const area = document.querySelector(`[aria-label="${scope}"]`);
      for (const element of area?.querySelectorAll(selector) ?? []) {
        const box = element.getBoundingClientRect();
        if (box.width === 0 && box.height === 0) continue;
        // Slider: yang disentuh adalah jalurnya; cukup tingginya.
        const isSlider = element.matches('input[type="range"], [role="slider"]');
        if (box.height < 44 || (!isSlider && box.width < 44)) {
          const name =
            element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 24) ?? '?';
          result.push(`${scope}: ${name} ${Math.round(box.width)}×${Math.round(box.height)}`);
        }
      }
    }
    return result;
  });
  expect(small).toEqual([]);
});

/** Nama dan tanda fokus elemen yang sedang fokus. */
const focused = (page: Page) =>
  page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) return null;
    const style = getComputedStyle(element);
    return {
      name:
        element.getAttribute('aria-label') ??
        element.textContent?.trim() ??
        element.tagName.toLowerCase(),
      inTopBar: Boolean(element.closest('[aria-label="Bilah atas"]')),
      visible: style.outlineStyle !== 'none' || style.boxShadow !== 'none',
    };
  });

test('bilah atas: Tab mencapai semua kontrol berurutan dengan tanda fokus terlihat', async ({
  page,
}) => {
  await page.goto('/');
  const expected = [
    'Minimum',
    'Pemula',
    'Parameter',
    'Simpan',
    'Buka',
    'Preset',
    'Skenario',
    'Reset',
  ];
  const reached: string[] = [];
  const noRing: string[] = [];
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  for (let i = 0; i < 20; i += 1) {
    await page.keyboard.press('Tab');
    const now = await focused(page);
    if (!now?.inTopBar) {
      if (reached.length > 0) break;
      continue;
    }
    reached.push(now.name);
    if (!now.visible) noRing.push(now.name);
  }
  for (const name of expected)
    expect
      .soft(
        reached.some((label) => label.includes(name)),
        `Tab mencapai ${name}`,
      )
      .toBe(true);
  // Urutan mengikuti tata letak kiri → kanan.
  const order = expected.map((name) => reached.findIndex((label) => label.includes(name)));
  expect.soft(order).toEqual([...order].sort((a, b) => a - b));
  expect(noRing).toEqual([]);
});

test('bilah atas: Enter/Spasi menjalankan tombol, panah memilih paket, Escape menutup menu', async ({
  page,
}) => {
  await page.goto('/');
  // Preset dibuka dengan Enter, item menu terfokus/terjangkau, Escape menutup.
  await page.getByRole('button', { name: 'Preset' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Minimum' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', { name: 'Minimum' })).toBeHidden();

  // Pilihan tingkat dengan Spasi.
  await page.getByRole('radio', { name: 'Mahir' }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('radio', { name: 'Mahir' })).toBeChecked();

  // Pola radiogroup WAI-ARIA: satu titik Tab, panah memindah fokus dan pilihan, berputar.
  await expect(page.getByRole('radio', { name: 'Rekomendasi' })).toHaveAttribute('tabindex', '-1');
  await page.getByRole('radio', { name: 'Minimum' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Rekomendasi' })).toBeFocused();
  await expect(page.getByRole('radio', { name: 'Rekomendasi' })).toBeChecked();
  await page.keyboard.press('End');
  await expect(page.getByRole('radio', { name: 'Terbaik' })).toBeChecked();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Minimum' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Minimum' })).toBeFocused();
});
