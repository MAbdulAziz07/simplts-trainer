import { Power, PowerOff } from 'lucide-react';
import type { ComponentCategory } from '@/domain';
import { t } from '@/i18n';
import { useCircuitStore } from '@/store';

// Fuse juga memutus rangkaian di domain, tetapi tidak punya tuas: fuse diganti, bukan disakelar.
const TOGGLE_CATEGORIES: readonly ComponentCategory[] = ['mcb-dc', 'mcb-ac'];

interface SwitchToggleProps {
  componentId: string;
  category: ComponentCategory;
  name: string;
  /** `true` = ON (kontak tertutup). */
  closed: boolean;
}

/**
 * Tuas MCB di samping gambarnya: klik untuk ON/OFF. Keadaan ditunjukkan ikon, teks, dan warna
 * (docs/UX.md §2.4: status tidak pernah warna saja). `nodrag` agar klik tidak menggeser node.
 * Komponen yang bukan MCB tidak menampilkan apa-apa.
 */
export function SwitchToggle({ componentId, category, name, closed }: SwitchToggleProps) {
  const toggleSwitch = useCircuitStore((state) => state.toggleSwitch);
  if (!TOGGLE_CATEGORIES.includes(category)) return null;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={closed}
      aria-label={t.switch.label(name)}
      onClick={() => toggleSwitch(componentId)}
      className={`nodrag nopan absolute top-1/2 left-full ml-3 flex size-11 -translate-y-1/2 flex-col items-center justify-center rounded-lg border-2 text-xs leading-none font-bold shadow-sm ${
        closed
          ? 'border-status-ok bg-status-ok text-white'
          : 'border-status-trip text-status-trip bg-white'
      }`}
    >
      {closed ? <Power aria-hidden size={18} /> : <PowerOff aria-hidden size={18} />}
      {closed ? t.switch.on : t.switch.off}
    </button>
  );
}
