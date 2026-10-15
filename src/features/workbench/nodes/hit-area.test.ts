import { describe, expect, it } from 'vitest';
import {
  SCREEN_CORE_PX,
  SCREEN_HIT_PX,
  bodyCore,
  clipToCore,
  hitClipPath,
  hitPolygon,
  hitSidePx,
  quantizeZoom,
  type PointPx,
} from './hit-area';

const at = (xPx: number, yPx: number) => ({ xPx, yPx });
const xs = (polygon: readonly PointPx[]) => polygon.map((point) => point.xPx);
const ys = (polygon: readonly PointPx[]) => polygon.map((point) => point.yPx);

describe('quantizeZoom dan hitSidePx', () => {
  it('area sentuh 44 px di layar: makin kecil zoom, makin besar di ruang meja', () => {
    expect(hitSidePx(1)).toBe(SCREEN_HIT_PX);
    expect(hitSidePx(0.5)).toBe(88);
    expect(hitSidePx(2)).toBe(22);
    expect(hitSidePx(0.4) * 0.4).toBeCloseTo(SCREEN_HIT_PX, 9);
  });

  it('zoom dibulatkan ke kelipatan 0,05 dan tidak pernah nol', () => {
    expect(quantizeZoom(0.62)).toBeCloseTo(0.6, 9);
    expect(quantizeZoom(0.63)).toBeCloseTo(0.65, 9);
    expect(quantizeZoom(0)).toBeCloseTo(0.05, 9);
  });
});

describe('hitPolygon', () => {
  it('terminal sendirian: persegi penuh', () => {
    const polygon = hitPolygon(at(50, 50), [], 44);
    expect(polygon).toHaveLength(4);
    expect(Math.min(...xs(polygon))).toBe(-22);
    expect(Math.max(...xs(polygon))).toBe(22);
  });

  it('tetangga 20 px di kanan memotong area di tengah-tengahnya (10 px)', () => {
    const left = hitPolygon(at(0, 0), [at(20, 0)], 44);
    expect(Math.max(...xs(left))).toBeCloseTo(10, 9);
    expect(Math.min(...xs(left))).toBe(-22);
    expect(Math.max(...ys(left))).toBe(22);
    // Kedua area bertemu tepat di garis tengah, tidak bertumpuk.
    const right = hitPolygon(at(20, 0), [at(0, 0)], 44);
    expect(20 + Math.min(...xs(right))).toBeCloseTo(10, 9);
  });

  it('diapit dua tetangga: terpotong di kedua sisi', () => {
    const middle = hitPolygon(at(0, 0), [at(-20, 0), at(30, 0)], 44);
    expect(Math.min(...xs(middle))).toBeCloseTo(-10, 9);
    expect(Math.max(...xs(middle))).toBeCloseTo(15, 9);
  });

  it('tetangga diagonal memotong sudut', () => {
    const polygon = hitPolygon(at(0, 0), [at(30, 30)], 44);
    expect(polygon).toHaveLength(5);
    // Titik (15, 15) berada di garis tengah; pojok (22, 22) terbuang.
    expect(polygon.some((point) => point.xPx === 22 && point.yPx === 22)).toBe(false);
  });

  it('tetangga jauh, diri sendiri, dan terminal berimpit tidak memotong', () => {
    const self = at(0, 0);
    expect(hitPolygon(self, [self, at(0, 0), at(200, 0)], 44)).toHaveLength(4);
  });

  it('pusat terminal selalu di dalam areanya', () => {
    const polygon = hitPolygon(at(0, 0), [at(8, 0), at(-8, 0), at(0, 8), at(0, -8)], 110);
    expect(Math.min(...xs(polygon))).toBeCloseTo(-4, 9);
    expect(Math.max(...xs(polygon))).toBeCloseTo(4, 9);
    expect(Math.min(...ys(polygon))).toBeCloseTo(-4, 9);
    expect(Math.max(...ys(polygon))).toBeCloseTo(4, 9);
  });
});

describe('bodyCore', () => {
  it('kotak di tengah node, tampil 24 px di layar', () => {
    expect(bodyCore({ widthPx: 200, heightPx: 100 }, 1)).toEqual({
      leftPx: 88,
      topPx: 38,
      rightPx: 112,
      bottomPx: 62,
    });
    const core = bodyCore({ widthPx: 400, heightPx: 400 }, 0.5);
    expect((core.rightPx - core.leftPx) * 0.5).toBeCloseTo(SCREEN_CORE_PX, 9);
  });

  it('paling besar separuh lebar dan tinggi node', () => {
    const core = bodyCore({ widthPx: 40, heightPx: 60 }, 0.2);
    expect(core.rightPx - core.leftPx).toBeCloseTo(20, 9);
    expect(core.bottomPx - core.topPx).toBeCloseTo(30, 9);
  });
});

describe('clipToCore', () => {
  // Fuse Baterai 100A ±48×60 px dengan terminal IN di atas dan OUT di bawah, pada zoom 0,8 (±38×48
  // px di layar): tanpa inti, kedua area sentuh bertemu di tengah dan menutupi seluruh badan.
  const box = { widthPx: 48, heightPx: 60 };
  const zoom = 0.8;
  const sidePx = hitSidePx(zoom);
  const input = { xPx: 23, yPx: 4, side: 'top' as const, dotPx: 14 };
  const output = { xPx: 24, yPx: 57, side: 'bottom' as const, dotPx: 14 };
  const core = bodyCore(box, zoom);

  it('area sentuh terminal kecil tidak masuk ke inti badan', () => {
    const top = clipToCore(hitPolygon(input, [output], sidePx), input, core);
    const bottom = clipToCore(hitPolygon(output, [input], sidePx), output, core);
    expect(input.yPx + Math.max(...ys(top))).toBeCloseTo(core.topPx, 9);
    expect(output.yPx + Math.min(...ys(bottom))).toBeCloseTo(core.bottomPx, 9);
    // Inti bebas tampil 24 px di layar.
    expect((core.bottomPx - core.topPx) * zoom).toBeCloseTo(SCREEN_CORE_PX, 9);
  });

  it('ke arah luar dan ke samping tetap 22 px di layar', () => {
    const top = clipToCore(hitPolygon(input, [output], sidePx), input, core);
    expect(Math.min(...ys(top)) * zoom).toBeCloseTo(-SCREEN_HIT_PX / 2, 9);
    expect(Math.max(...xs(top)) * zoom).toBeCloseTo(SCREEN_HIT_PX / 2, 9);
  });

  it('terminal di dalam inti tetap memiliki titiknya', () => {
    const center = { xPx: 24, yPx: 30, side: 'left' as const, dotPx: 14 };
    const polygon = clipToCore(hitPolygon(center, [], 44), center, core);
    expect(Math.max(...xs(polygon))).toBeCloseTo(7, 9);
    expect(Math.min(...xs(polygon))).toBe(-22);
  });

  it('terminal jauh dari inti tidak terpotong', () => {
    const big = bodyCore({ widthPx: 300, heightPx: 200 }, 1);
    const spot = { xPx: 20, yPx: 190, side: 'bottom' as const, dotPx: 24 };
    expect(clipToCore(hitPolygon(spot, [], 44), spot, big)).toHaveLength(4);
  });
});

describe('hitClipPath', () => {
  it('poligon digeser ke pojok kiri atas elemen', () => {
    expect(hitClipPath(hitPolygon(at(0, 0), [], 44), 44)).toBe(
      'polygon(0.0px 0.0px, 44.0px 0.0px, 44.0px 44.0px, 0.0px 44.0px)',
    );
  });
});
