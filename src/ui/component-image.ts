// Gambar komponen dari src/assets/components beserta ukurannya (manifest.json ditulis oleh
// scripts/process-assets.py). Item katalog yang gambarnya belum ada memakai tampilan pengganti.
import type { CatalogItem } from '@/domain';
import manifest from '@/assets/components/manifest.json';
import { componentSizePx, type SizePx } from './component-size';

const urlByPath = import.meta.glob<string>('/src/assets/components/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

const sizeByName: Record<string, { widthPx: number; heightPx: number } | undefined> = manifest;

export interface ComponentImage {
  url: string;
  widthPx: number;
  heightPx: number;
}

/** @param imagePath field `image` item katalog, mis. `src/assets/components/pv-module.webp`. */
export function componentImage(imagePath: string): ComponentImage | undefined {
  const url = urlByPath[`/${imagePath}`];
  const size = sizeByName[imagePath.replace(/^.*\//, '').replace(/\.webp$/, '')];
  return url && size ? { url, ...size } : undefined;
}

/** Ukuran tampil sebuah item katalog di meja kerja sebelum diputar. */
export function itemSizePx(item: Pick<CatalogItem, 'category' | 'image'>): SizePx {
  return componentSizePx(item.category, componentImage(item.image));
}
