import { describe, expect, it } from 'vitest';
import {
  SCREEN_HIT_PX,
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

describe('hitClipPath', () => {
  it('poligon digeser ke pojok kiri atas elemen', () => {
    expect(hitClipPath(hitPolygon(at(0, 0), [], 44), 44)).toBe(
      'polygon(0.0px 0.0px, 44.0px 0.0px, 44.0px 44.0px, 0.0px 44.0px)',
    );
  });
});
