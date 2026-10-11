import { FolderOpen, LayoutTemplate, Save, type LucideIcon } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { PACKAGE_IDS, type PackageId } from '@/domain';
import { loadPreset } from '@/data';
import { t } from '@/i18n';
import {
  catalogItems,
  parseProjectText,
  projectFileName,
  serializeProject,
  useCircuitStore,
  useToastStore,
} from '@/store';

interface BarButtonProps {
  icon: LucideIcon;
  label: string;
  hint: string;
  onClick: () => void;
  expanded?: boolean;
}

// docs/UX.md §1 butir 10: tombol 44 px dengan label 12 px di bawah ikon.
function BarButton({ icon: Icon, label, hint, onClick, expanded }: BarButtonProps) {
  return (
    <button
      type="button"
      title={hint}
      aria-haspopup={expanded === undefined ? undefined : 'menu'}
      aria-expanded={expanded}
      onClick={onClick}
      className="hover:bg-app flex h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs leading-none font-medium"
    >
      <Icon aria-hidden size={18} />
      {label}
    </button>
  );
}

function download(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Dilepas setelah browser sempat memulai unduhan.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Simpan/buka rangkaian sebagai berkas .json dan muat preset tiap paket. */
export function FileActions() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [presetOpen, setPresetOpen] = useState(false);
  const toast = useToastStore((state) => state.show);

  const save = () => {
    const { doc, packageId } = useCircuitStore.getState();
    download(projectFileName(packageId, new Date()), serializeProject(doc, packageId));
    toast(t.file.saved);
  };

  const open = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Dikosongkan agar berkas yang sama bisa dipilih lagi.
    event.target.value = '';
    if (!file) return;
    const { project, rejection } = parseProjectText(await file.text(), catalogItems);
    if (!project) return toast(t.file.rejections[rejection ?? 'invalid'], 'warning');
    useCircuitStore.getState().loadProject(project);
    toast(t.file.opened);
  };

  const loadPackagePreset = (packageId: PackageId) => {
    setPresetOpen(false);
    useCircuitStore.getState().loadProject(loadPreset(packageId, catalogItems));
    toast(t.file.presetLoaded(t.packages[packageId]));
  };

  return (
    <div className="ml-auto flex items-center gap-1">
      <BarButton icon={Save} label={t.file.save} hint={t.file.saveHint} onClick={save} />
      <BarButton
        icon={FolderOpen}
        label={t.file.open}
        hint={t.file.openHint}
        onClick={() => fileInput.current?.click()}
      />
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        aria-label={t.file.openHint}
        className="hidden"
        onChange={(event) => void open(event)}
      />
      <div
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setPresetOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setPresetOpen(false);
        }}
      >
        <BarButton
          icon={LayoutTemplate}
          label={t.file.preset}
          hint={t.file.presetHint}
          expanded={presetOpen}
          onClick={() => setPresetOpen((isOpen) => !isOpen)}
        />
        {presetOpen && (
          <div
            role="menu"
            aria-label={t.file.presetHint}
            className="border-line bg-card absolute top-full right-0 z-20 mt-1 flex w-44 flex-col rounded-xl border p-1 shadow-lg"
          >
            {PACKAGE_IDS.map((packageId) => (
              <button
                key={packageId}
                type="button"
                role="menuitem"
                onClick={() => loadPackagePreset(packageId)}
                className="hover:bg-app h-11 rounded-lg px-3 text-left text-sm font-medium"
              >
                {t.packages[packageId]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
