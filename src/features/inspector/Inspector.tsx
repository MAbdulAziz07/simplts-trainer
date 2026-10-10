import { t } from '@/i18n';

// Kerangka: selalu tampil. Nanti hanya muncul saat ada komponen terpilih (docs/UX.md §2.1).
export function Inspector() {
  return (
    <aside
      aria-label={t.areas.inspector}
      className="border-line bg-card overflow-y-auto border-l"
    />
  );
}
