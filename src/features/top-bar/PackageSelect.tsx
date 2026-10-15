import { PACKAGE_IDS } from '@/domain';
import { t } from '@/i18n';
import { useCircuitStore } from '@/store';
import { SegmentedRadio } from '@/ui';

const OPTIONS = PACKAGE_IDS.map((id) => ({ id, label: t.packages[id] }));

/** Pilihan paket alat; menentukan isi baki (docs/PRD.md US1). */
export function PackageSelect() {
  const packageId = useCircuitStore((state) => state.packageId);
  const setPackage = useCircuitStore((state) => state.setPackage);

  return (
    <SegmentedRadio
      label={t.packageLabel}
      options={OPTIONS}
      value={packageId}
      onChange={setPackage}
    />
  );
}
