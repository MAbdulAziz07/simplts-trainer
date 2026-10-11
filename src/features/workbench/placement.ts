// Mencari tempat kosong untuk komponen baru yang ditambah tanpa diseret (ketuk ubin baki), supaya
// kartu tidak saling menimpa (docs/UX.md §2.2).
import { findCatalogItem, type CircuitDoc } from '@/store';
import { itemSizePx } from '@/ui';
import { GRID_PX, snapToGridPx } from './flow-types';
import { rotatedSizePx } from './nodes/geometry';

export interface BoxPx {
  xPx: number;
  yPx: number;
  widthPx: number;
  heightPx: number;
}

/** Kotak tiap komponen di meja kerja, sesudah diputar. */
export function occupiedBoxes(doc: CircuitDoc): BoxPx[] {
  return doc.components.flatMap((part) => {
    const item = findCatalogItem(part.catalogId);
    if (!item) return [];
    return [{ xPx: part.xPx, yPx: part.yPx, ...rotatedSizePx(itemSizePx(item), part.rotationDeg) }];
  });
}

/** Ruang di sekeliling komponen untuk label, tuas MCB, dan jajaran terminal di bawahnya. */
export const CLEARANCE_X_PX = 3 * GRID_PX;
export const CLEARANCE_Y_PX = 3 * GRID_PX;
const STEP_PX = 2 * GRID_PX;
const MAX_STEPS = 12;

function overlaps(a: BoxPx, b: BoxPx): boolean {
  return (
    a.xPx < b.xPx + b.widthPx + CLEARANCE_X_PX &&
    b.xPx < a.xPx + a.widthPx + CLEARANCE_X_PX &&
    a.yPx < b.yPx + b.heightPx + CLEARANCE_Y_PX &&
    b.yPx < a.yPx + a.heightPx + CLEARANCE_Y_PX
  );
}

/**
 * Posisi (pojok kiri atas, pada kisi) terdekat dari `wanted` yang tidak menimpa `occupied`.
 * Dicari melebar ke kanan dan kiri, lalu turun baris demi baris; bila penuh, `wanted` dipakai.
 */
export function findFreeSpot(
  wanted: BoxPx,
  occupied: readonly BoxPx[],
): { xPx: number; yPx: number } {
  const start = { xPx: snapToGridPx(wanted.xPx), yPx: snapToGridPx(wanted.yPx) };
  for (let row = 0; row <= MAX_STEPS; row++) {
    for (let step = 0; step <= 2 * MAX_STEPS; step++) {
      // 0, +1, −1, +2, −2, ...
      const column = step % 2 === 1 ? (step + 1) / 2 : -step / 2;
      const candidate = {
        ...wanted,
        xPx: start.xPx + column * STEP_PX,
        yPx: start.yPx + row * STEP_PX,
      };
      if (!occupied.some((box) => overlaps(candidate, box)))
        return { xPx: candidate.xPx, yPx: candidate.yPx };
    }
  }
  return start;
}
