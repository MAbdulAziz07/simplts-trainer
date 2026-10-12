import { Sun } from 'lucide-react';
import { ResetButton } from '@/features/sim-controls';
import { t } from '@/i18n';
import { FileActions } from './FileActions';
import { LevelSelect } from './LevelSelect';
import { PackageSelect } from './PackageSelect';

export function TopBar() {
  return (
    <header
      aria-label={t.areas.topBar}
      className="border-line bg-card col-span-3 flex items-center gap-3 border-b px-4"
    >
      <span className="bg-brand flex size-9 items-center justify-center rounded-lg text-white">
        <Sun aria-hidden size={20} />
      </span>
      <span className="text-base font-semibold">{t.appName}</span>
      <span className="ml-3">
        <PackageSelect />
      </span>
      <LevelSelect />
      <FileActions />
      <span aria-hidden className="bg-line h-8 w-px shrink-0" />
      <ResetButton />
    </header>
  );
}
