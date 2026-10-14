import { GraduationCap } from 'lucide-react';
import { useState } from 'react';
import { t } from '@/i18n';
import { useScenarioStore } from '@/store';
import { ScenarioPicker } from './ScenarioPicker';

/** Tombol "Skenario" di bilah atas; menyala selama ada skenario yang berjalan. */
export function ScenarioButton() {
  const [isOpen, setIsOpen] = useState(false);
  const isActive = useScenarioStore((state) => state.run !== undefined);
  return (
    <>
      <button
        type="button"
        title={t.scenarios.buttonHint}
        aria-haspopup="dialog"
        aria-pressed={isActive}
        onClick={() => setIsOpen(true)}
        className={`flex h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs leading-none font-medium ${
          isActive ? 'bg-brand/15 text-brand' : 'hover:bg-app'
        }`}
      >
        <GraduationCap aria-hidden size={18} />
        {t.scenarios.button}
      </button>
      {isOpen && <ScenarioPicker onClose={() => setIsOpen(false)} />}
    </>
  );
}
