import { describe, expect, it } from 'vitest';
import {
  FIT_MARGIN_PX,
  FIT_TOOLBAR_WIDTH_PX,
  SCENARIO_PANEL_INSET_PX,
  fitBounds,
  fitLeftInsetPx,
  isFullyVisible,
} from './fit-bounds';
import type { BoxPx } from './placement';

const box = (xPx: number, yPx: number, widthPx: number, heightPx: number): BoxPx => ({
  xPx,
  yPx,
  widthPx,
  heightPx,
});

describe('fitBounds', () => {
  it('meja kosong tidak punya batas', () => {
    expect(fitBounds([])).toBeUndefined();
  });

  it('memuat semua komponen ditambah ruang untuk nama, indikator, tuas, dan terminal', () => {
    const bounds = fitBounds([box(100, 200, 144, 144), box(600, 50, 288, 192)]);
    expect(bounds).toEqual({
      xPx: 100 - FIT_MARGIN_PX.left,
      yPx: 50 - FIT_MARGIN_PX.top,
      widthPx: 888 - 100 + FIT_MARGIN_PX.left + FIT_MARGIN_PX.right,
      heightPx: 344 - 50 + FIT_MARGIN_PX.top + FIT_MARGIN_PX.bottom,
    });
  });
});

describe('isFullyVisible', () => {
  const bounds = box(0, 0, 800, 400);
  // Batas tepat di kanan bilah alat pada zoom 100%.
  const view = { xPx: FIT_TOOLBAR_WIDTH_PX, yPx: 0, zoom: 1 };

  it('terlihat bila muat di kanan bilah alat', () => {
    expect(isFullyVisible(bounds, view, 1150, 640)).toBe(true);
    expect(isFullyVisible(bounds, view, 880, 400)).toBe(true);
  });

  it('tidak terlihat bila meja menyempit atau memendek melewati batasnya', () => {
    expect(isFullyVisible(bounds, view, 870, 640)).toBe(false);
    expect(isFullyVisible(bounds, view, 1150, 390)).toBe(false);
  });

  it('tidak terlihat bila digeser ke bawah bilah alat atau ke atas layar', () => {
    expect(isFullyVisible(bounds, { ...view, xPx: 40 }, 1150, 640)).toBe(false);
    expect(isFullyVisible(bounds, { ...view, yPx: -30 }, 1150, 640)).toBe(false);
  });

  it('zoom ikut dihitung: diperbesar keluar layar, diperkecil masuk lagi', () => {
    expect(isFullyVisible(bounds, { ...view, zoom: 1.5 }, 1150, 640)).toBe(false);
    expect(isFullyVisible(bounds, { ...view, zoom: 0.5 }, 600, 300)).toBe(true);
  });

  it('selisih pembulatan satu-dua piksel tetap dianggap terlihat', () => {
    expect(isFullyVisible(bounds, { ...view, xPx: view.xPx - 1.5 }, 880, 400)).toBe(true);
  });
});

describe('fitLeftInsetPx', () => {
  it('tanpa skenario hanya bilah alat yang disisihkan', () => {
    expect(fitLeftInsetPx(1150, false)).toBe(FIT_TOOLBAR_WIDTH_PX);
  });

  it('panel skenario disisihkan bila sisa meja masih cukup lebar', () => {
    expect(fitLeftInsetPx(1150, true)).toBe(SCENARIO_PANEL_INSET_PX);
    expect(fitLeftInsetPx(SCENARIO_PANEL_INSET_PX + 400, true)).toBe(SCENARIO_PANEL_INSET_PX);
  });

  it('meja sempit mengabaikan panel supaya rangkaian tidak terlalu kecil', () => {
    expect(fitLeftInsetPx(SCENARIO_PANEL_INSET_PX + 399, true)).toBe(FIT_TOOLBAR_WIDTH_PX);
  });

  it('batas yang tertutup panel skenario tidak dihitung terlihat', () => {
    const view = { xPx: FIT_TOOLBAR_WIDTH_PX, yPx: 0, zoom: 1 };
    const bounds = box(0, 0, 400, 300);
    expect(isFullyVisible(bounds, view, 1150, 640)).toBe(true);
    expect(isFullyVisible(bounds, view, 1150, 640, SCENARIO_PANEL_INSET_PX)).toBe(false);
    const shifted = { ...view, xPx: SCENARIO_PANEL_INSET_PX };
    expect(isFullyVisible(bounds, shifted, 1150, 640, SCENARIO_PANEL_INSET_PX)).toBe(true);
  });
});
