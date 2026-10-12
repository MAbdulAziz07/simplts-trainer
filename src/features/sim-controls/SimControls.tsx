import { t } from '@/i18n';
import { useSimStore } from '@/store';
import { EnvControls } from './EnvControls';
import { Playback } from './Playback';
import './sim-controls.css';

/** Bilah simulasi 72 px: putar/jeda, kecepatan, jam, iradiasi, awan, suhu (docs/UX.md §2.1). */
export function SimControls() {
  const running = useSimStore((state) => state.running);
  return (
    <footer
      aria-label={t.areas.simControls}
      data-running={running || undefined}
      className="border-line bg-card relative col-span-3 flex items-center gap-4 border-t px-4"
    >
      {running && <span aria-hidden className="sim-running-bar" />}
      <Playback />
      <EnvControls />
    </footer>
  );
}
