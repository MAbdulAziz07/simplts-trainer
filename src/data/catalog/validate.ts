// Validasi seluruh katalog: tiap berkas terhadap skema, lalu aturan lintas berkas.
import type { CatalogItem } from '@/domain';
import { catalogFileSchema } from './schema';

export interface CatalogValidation {
  items: CatalogItem[];
  /** Kosong bila katalog sah. Satu baris per masalah: `berkas › jalur: pesan`. */
  issues: string[];
}

/** @param files isi berkas JSON mentah, dengan kunci nama berkas tanpa `.json`. */
export function validateCatalog(files: Record<string, unknown>): CatalogValidation {
  const items: CatalogItem[] = [];
  const issues: string[] = [];
  const fileOfId = new Map<string, string>();

  for (const [name, raw] of Object.entries(files)) {
    const result = catalogFileSchema.safeParse(raw);
    if (!result.success) {
      for (const issue of result.error.issues)
        issues.push(`${name} › ${issue.path.join('.')}: ${issue.message}`);
      continue;
    }
    // Mendeteksi berkas tertukar (KATALOG §2).
    if (result.data.file !== name)
      issues.push(`${name} › file: berisi "${result.data.file}", seharusnya "${name}"`);

    for (const item of result.data.items) {
      const firstFile = fileOfId.get(item.id);
      if (firstFile !== undefined)
        issues.push(`${name} › ${item.id}: id sudah dipakai di ${firstFile}`);
      fileOfId.set(item.id, name);
      items.push(item);
    }
  }
  return { items, issues };
}
