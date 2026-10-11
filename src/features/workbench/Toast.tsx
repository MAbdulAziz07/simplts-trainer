import { Info, TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { useToastStore } from '@/store';

/** docs/UX.md §2.1: toast hilang sendiri setelah 3 detik. */
const TOAST_DURATION_MS = 3000;

/** Pesan singkat di tengah bawah meja kerja; ikon + teks, tidak hanya warna. */
export function Toast() {
  const toast = useToastStore((state) => state.toast);
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismiss, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center"
    >
      {toast && (
        <p
          key={toast.id}
          className="bg-ink flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-white shadow-lg"
        >
          {toast.tone === 'warning' ? (
            <TriangleAlert aria-hidden size={18} className="text-amber-400" />
          ) : (
            <Info aria-hidden size={18} />
          )}
          {toast.text}
        </p>
      )}
    </div>
  );
}
