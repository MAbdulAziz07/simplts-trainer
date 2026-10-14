// Keluarga varian: beberapa item katalog tampil sebagai satu komponen (mis. "MCB"); jenis dan
// arus pengenalnya dipilih pada komponen. Tiap varian tetap item katalog sendiri dengan datasheet-nya.
import type { CatalogItem, ComponentCategory, PackageId, Terminal } from '../types';

export const VARIANT_FAMILIES = ['mcb', 'panel'] as const;
export type VariantFamily = (typeof VARIANT_FAMILIES)[number];

const FAMILY_CATEGORIES: Record<VariantFamily, readonly ComponentCategory[]> = {
  mcb: ['mcb-dc', 'mcb-ac'],
  panel: ['busbar', 'load-panel'],
};

/** Jenis varian: MCB `dc`/`ac`; panel = jenis terminal busbar, atau `load-panel`. */
export const VARIANT_KINDS = ['dc', 'ac', 'dc+', 'dc-', 'acL', 'acN', 'pe', 'load-panel'] as const;
export type VariantKind = (typeof VARIANT_KINDS)[number];

export interface VariantChoice {
  kind: VariantKind;
  /** Arus pengenal yang bisa dipilih; hanya untuk MCB. */
  ratedCurrentA?: number;
}

const isVariantKind = (value: unknown): value is VariantKind =>
  VARIANT_KINDS.includes(value as VariantKind);

type VariantItem = Pick<CatalogItem, 'id' | 'category' | 'packages' | 'terminals' | 'protection'>;

export function familyOf(category: ComponentCategory): VariantFamily | undefined {
  return VARIANT_FAMILIES.find((family) => FAMILY_CATEGORIES[family].includes(category));
}

/** Jenis dan arus pengenal sebuah varian; `undefined` bila item bukan anggota keluarga. */
export function variantChoice(item: VariantItem): VariantChoice | undefined {
  switch (item.category) {
    case 'mcb-dc':
    case 'mcb-ac': {
      const { ratedCurrentA } = item.protection as { ratedCurrentA: number };
      return { kind: item.category === 'mcb-dc' ? 'dc' : 'ac', ratedCurrentA };
    }
    case 'load-panel':
      return { kind: 'load-panel' };
    case 'busbar': {
      const kind = item.terminals[0]?.kind;
      return isVariantKind(kind) ? { kind } : undefined;
    }
    default:
      return undefined;
  }
}

/** Anggota keluarga yang ada di paket, urut seperti katalog. */
export function familyVariants<T extends VariantItem>(
  catalog: readonly T[],
  family: VariantFamily,
  packageId: PackageId,
): T[] {
  return catalog.filter(
    (item) =>
      FAMILY_CATEGORIES[family].includes(item.category) &&
      item.packages.includes(packageId) &&
      variantChoice(item) !== undefined,
  );
}

/** Jenis yang tersedia, tanpa ulangan, urut kemunculan pertama. */
export function variantKinds(variants: readonly VariantItem[]): VariantKind[] {
  const kinds = variants.flatMap((item) => variantChoice(item)?.kind ?? []);
  return [...new Set(kinds)];
}

/** Arus pengenal yang tersedia untuk satu jenis, urut naik. */
export function variantRatingsA(variants: readonly VariantItem[], kind: VariantKind): number[] {
  const ratings = variants.flatMap((item) => {
    const choice = variantChoice(item);
    return choice?.kind === kind && choice.ratedCurrentA !== undefined
      ? [choice.ratedCurrentA]
      : [];
  });
  return [...new Set(ratings)].sort((a, b) => a - b);
}

/**
 * Varian untuk jenis yang dipilih: arus pengenal yang sama bila ada, bila tidak yang terdekat
 * (seri: yang lebih kecil). Tanpa arus pengenal: varian pertama jenis itu.
 */
export function pickVariant<T extends VariantItem>(
  variants: readonly T[],
  kind: VariantKind,
  ratedCurrentA?: number,
): T | undefined {
  const ofKind = variants.filter((item) => variantChoice(item)?.kind === kind);
  if (ratedCurrentA === undefined) return ofKind[0];
  const ratingOf = (item: T) => variantChoice(item)?.ratedCurrentA ?? 0;
  const distance = (item: T) => Math.abs(ratingOf(item) - ratedCurrentA);
  return [...ofKind].sort((a, b) => distance(a) - distance(b) || ratingOf(a) - ratingOf(b))[0];
}

/**
 * Terminal yang tetap bisa memegang kabelnya saat varian diganti: id sama dan jenis sama.
 * Kabel di terminal lain dilepas.
 */
export function retainedTerminalIds(
  from: { terminals: readonly Pick<Terminal, 'id' | 'kind'>[] },
  to: { terminals: readonly Pick<Terminal, 'id' | 'kind'>[] },
): string[] {
  return from.terminals
    .filter((terminal) =>
      to.terminals.some((other) => other.id === terminal.id && other.kind === terminal.kind),
    )
    .map((terminal) => terminal.id);
}
