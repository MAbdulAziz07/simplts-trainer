import {
  familyVariants,
  pickVariant,
  variantChoice,
  variantKinds,
  variantRatingsA,
  type CatalogItem,
  type VariantFamily,
} from '@/domain';
import { t } from '@/i18n';
import { catalogItems, useCircuitStore } from '@/store';

export interface SegmentedOption {
  key: string;
  label: string;
  title?: string;
  selected: boolean;
  onPick: () => void;
}

/** Deret tombol pilihan; tombol 44 px supaya mudah disentuh (docs/UX.md §2.3). */
export function Segmented({
  label,
  options,
  showLabel = true,
}: {
  label: string;
  options: SegmentedOption[];
  /** `false` bila judul sudah tampil di luar; label tetap dibacakan pembaca layar. */
  showLabel?: boolean;
}) {
  return (
    <section className="flex flex-col gap-1">
      {showLabel && <h3 className="text-ink-muted text-xs font-semibold">{label}</h3>}
      <div role="group" aria-label={label} className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={option.selected}
            title={option.title}
            onClick={option.onPick}
            className={`h-11 min-w-11 rounded-lg border px-2 text-sm font-semibold ${
              option.selected
                ? 'border-brand bg-brand text-white'
                : 'border-line hover:border-brand bg-white'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * Pilihan jenis dan arus pengenal untuk MCB dan panel listrik. Pilihan diambil dari varian
 * katalog di paket aktif; varian yang sedang terpasang selalu ikut walau dari paket lain.
 */
export function VariantPicker({
  id,
  item,
  family,
}: {
  id: string;
  item: CatalogItem;
  family: VariantFamily;
}) {
  const packageId = useCircuitStore((state) => state.packageId);
  const inPackage = familyVariants(catalogItems, family, packageId);
  const variants = inPackage.includes(item) ? inPackage : [...inPackage, item];
  const current = variantChoice(item);
  if (!current) return null;

  const choose = (next: CatalogItem | undefined) => {
    if (next && next !== item) useCircuitStore.getState().setVariant(id, next.id);
  };
  const kinds = variantKinds(variants);
  const ratings = variantRatingsA(variants, current.kind);

  return (
    <>
      {kinds.length > 1 && (
        <Segmented
          label={t.variant.kind}
          options={kinds.map((kind) => ({
            key: kind,
            label: t.variant.kinds[kind],
            title: t.variant.kindTitles[kind],
            selected: kind === current.kind,
            onPick: () => choose(pickVariant(variants, kind, current.ratedCurrentA)),
          }))}
        />
      )}
      {ratings.length > 1 && (
        <Segmented
          label={t.variant.ratedCurrent}
          options={ratings.map((ratedCurrentA) => ({
            key: String(ratedCurrentA),
            label: t.variant.ratingA(ratedCurrentA),
            selected: ratedCurrentA === current.ratedCurrentA,
            onPick: () => choose(pickVariant(variants, current.kind, ratedCurrentA)),
          }))}
        />
      )}
    </>
  );
}
