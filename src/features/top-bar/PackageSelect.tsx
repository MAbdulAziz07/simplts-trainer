import { PACKAGE_IDS } from '@/domain';
import { t } from '@/i18n';
import { useCircuitStore } from '@/store';

/** Pilihan paket alat; menentukan isi baki (docs/PRD.md US1). */
export function PackageSelect() {
  const packageId = useCircuitStore((state) => state.packageId);
  const setPackage = useCircuitStore((state) => state.setPackage);

  return (
    <div role="radiogroup" aria-label={t.packageLabel} className="bg-app flex rounded-lg p-1">
      {PACKAGE_IDS.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={id === packageId}
          onClick={() => setPackage(id)}
          className={`h-9 rounded-md px-3 text-sm font-medium ${
            id === packageId ? 'bg-brand text-white' : 'text-ink-muted hover:text-ink'
          }`}
        >
          {t.packages[id]}
        </button>
      ))}
    </div>
  );
}
