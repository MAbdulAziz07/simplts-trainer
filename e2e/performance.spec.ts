/// <reference lib="dom" />
import { expect, test } from '@playwright/test';
import { play, seedCircuit, setSpeed } from './sim-helpers';

// Kinerja: 40 komponen dan 60 kabel pada kecepatan 600× tetap di atas 30 fps (docs/PRD.md).
// Berjalan sendiri sebagai proyek "performance" (playwright.config.ts) setelah uji lain selesai;
// `npm run test:perf` menjalankannya saja. Diukur dengan menghitung requestAnimationFrame.
// Chromium headless tanpa GPU, jadi angka ini batas bawah kasar; laptop guru dengan akselerasi
// grafis biasanya lebih tinggi.

const MIN_FPS = 30;
const MEASURE_MS = 5000;
const GROUPS = 8;

/** Delapan sistem DC kecil: PV → SCC → baterai, baterai → MCB → beban. 5 komponen, 8 kabel. */
function bigCircuit() {
  const parts: [string, string][] = [];
  const links: [string, string][] = [];
  const closed: string[] = [];
  for (let g = 1; g <= GROUPS; g += 1) {
    parts.push(
      [`pv${g}`, 'pv-generic-100wp'],
      [`scc${g}`, 'scc-pwm-rbl-20a'],
      [`bat${g}`, 'bat-vrla-agm-12v-100ah'],
      [`mcb${g}`, 'mcb-dc-32a'],
      [`load${g}`, 'load-dc-12v-200w'],
    );
    links.push(
      [`pv${g}.pos`, `scc${g}.pv-pos`],
      [`pv${g}.neg`, `scc${g}.pv-neg`],
      [`scc${g}.bat-pos`, `bat${g}.pos`],
      [`scc${g}.bat-neg`, `bat${g}.neg`],
      [`bat${g}.pos`, `mcb${g}.pos-in`],
      [`bat${g}.neg`, `mcb${g}.neg-in`],
    );
    // Beban tersambung pada 6 kelompok: 8·6 + 6·2 = 60 kabel.
    if (g <= 6) links.push([`mcb${g}.pos-out`, `load${g}.a`], [`mcb${g}.neg-out`, `load${g}.b`]);
    closed.push(`mcb${g}`);
  }
  return { parts, links, closed };
}

test('40 komponen dan 60 kabel pada 600× tetap di atas 30 fps', async ({ page }) => {
  test.setTimeout(60_000);
  const { parts, links, closed } = bigCircuit();
  expect(parts).toHaveLength(40);
  expect(links).toHaveLength(60);
  await seedCircuit(page, parts, links, { closed });

  await setSpeed(page, 600);
  await play(page);
  // Pemanasan: biarkan simulasi dan animasi kabel berjalan dulu.
  await page.waitForTimeout(1000);

  const result = await page.evaluate(async (durationMs) => {
    const gaps: number[] = [];
    let last = performance.now();
    const start = last;
    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        gaps.push(now - last);
        last = now;
        if (now - start < durationMs) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    const elapsed = last - start;
    gaps.sort((a, b) => a - b);
    return {
      fps: (gaps.length / elapsed) * 1000,
      p95GapMs: gaps[Math.floor(gaps.length * 0.95)] ?? 0,
      worstGapMs: gaps.at(-1) ?? 0,
    };
  }, MEASURE_MS);

  test.info().annotations.push({
    type: 'fps',
    description: `${result.fps.toFixed(1)} fps, p95 jeda ${result.p95GapMs.toFixed(1)} ms, terburuk ${result.worstGapMs.toFixed(1)} ms`,
  });
  console.log('fps', JSON.stringify(result));
  expect(result.fps).toBeGreaterThan(MIN_FPS);
});
