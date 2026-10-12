import { RotateCcw, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { t } from '@/i18n';
import { useSimStore, useToastStore } from '@/store';

/** Lama tombol menunggu ketukan kedua sebelum kembali seperti semula. */
const CONFIRM_MS = 3000;

/**
 * Reset percobaan (docs/PRD.md §3.2, US14): rusak, trip, SoC, dan jam kembali ke awal tanpa memuat
 * ulang halaman. Ketukan pertama meminta konfirmasi, ketukan kedua menjalankannya. Dipasang di
 * bilah atas, terpisah dari simpan/buka, dengan label 12 px di bawah ikon (docs/UX.md §1 butir 10,
 * §2.1).
 */
export function ResetButton() {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return undefined;
    const timer = setTimeout(() => setArmed(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  const onClick = (): void => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    useSimStore.getState().resetExperiment();
    useToastStore.getState().show(t.sim.resetDone);
  };
  const label = armed ? t.sim.resetConfirm : t.sim.reset;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-armed={armed || undefined}
      onClick={onClick}
      onBlur={() => setArmed(false)}
      className={`flex h-11 min-w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs leading-none font-medium ${
        armed ? 'bg-status-danger font-bold text-white' : 'hover:bg-app'
      }`}
    >
      {armed ? <TriangleAlert aria-hidden size={18} /> : <RotateCcw aria-hidden size={18} />}
      {armed ? t.sim.resetConfirmMark : t.sim.resetMark}
    </button>
  );
}
