import { FolderOpen, X } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import type { Fault } from '@/domain';
import { parseScenarioText, type LoadedScenario } from '@/data';
import { t } from '@/i18n';
import { catalogItems, scenarioList, useScenarioStore, useToastStore } from '@/store';
import { FaultChooser } from './FaultChooser';
import { MODE_ICON } from './icons';

const text = t.scenarios;

/** Dialog pilih skenario: daftar skenario, nama peserta, dan pilihan gangguan instruktur. */
export function ScenarioPicker({ onClose }: { onClose: () => void }) {
  const opened = useScenarioStore((state) => state.openedScenarios);
  const list = [...scenarioList.filter((s) => !opened.some((o) => o.id === s.id)), ...opened];
  const [selectedId, setSelectedId] = useState(scenarioList[0]?.id ?? '');
  const fileInput = useRef<HTMLInputElement>(null);
  const toast = useToastStore((state) => state.show);
  const [participant, setParticipant] = useState(
    () => useScenarioStore.getState().run?.participant ?? '',
  );
  // Kosong = acak saat mulai.
  const [faults, setFaults] = useState<Fault[]>([]);
  const selected = list.find((scenario) => scenario.id === selectedId);

  const choose = (scenario: LoadedScenario) => {
    setSelectedId(scenario.id);
    setFaults([]);
  };
  const openFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const { scenario, issues } = parseScenarioText(await file.text(), catalogItems);
    if (!scenario) return toast(text.fileRejected(issues[0] ?? ''), 'warning');
    useScenarioStore.getState().addScenario(scenario);
    choose(scenario);
    toast(text.fileOpened(scenario.title));
  };
  const start = () => {
    if (!selected) return;
    useScenarioStore.getState().start(selected, { participant, faults });
    onClose();
  };

  return (
    <div
      className="scenario-backdrop"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={text.pickerTitle}
        className="border-line bg-card flex max-h-[85vh] w-[min(640px,calc(100vw-32px))] flex-col rounded-2xl border shadow-xl"
      >
        <header className="border-line flex items-center gap-2 border-b px-4 py-2">
          <h2 className="text-base font-semibold">{text.pickerTitle}</h2>
          <button
            type="button"
            aria-label={text.close}
            title={text.close}
            onClick={onClose}
            className="hover:bg-app ml-auto flex size-11 items-center justify-center rounded-lg"
          >
            <X aria-hidden size={20} />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <ul aria-label={text.pickerTitle} className="flex flex-col gap-2">
            {list.map((scenario) => {
              const Icon = MODE_ICON[scenario.mode];
              const isSelected = scenario.id === selectedId;
              return (
                <li key={scenario.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => choose(scenario)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${
                      isSelected ? 'border-brand bg-brand/10' : 'border-line hover:bg-app'
                    }`}
                  >
                    <Icon aria-hidden size={24} className="text-brand mt-0.5 shrink-0" />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold">{scenario.title}</span>
                      <span className="text-ink-muted text-xs">
                        {text.modes[scenario.mode]} · {text.stepsCount(scenario.steps.length)}
                      </span>
                      <span className="text-sm">{scenario.goal}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {text.participant}
            <input
              value={participant}
              placeholder={text.participantPlaceholder}
              maxLength={60}
              onChange={(event) => setParticipant(event.target.value)}
              className="border-line h-11 rounded-lg border px-3 font-normal"
            />
          </label>
          {selected?.mode === 'troubleshoot' && (
            <FaultChooser scenario={selected} value={faults} onChange={setFaults} />
          )}
        </div>
        <footer className="border-line flex items-center gap-3 border-t px-4 py-3">
          <button
            type="button"
            title={text.openFileHint}
            onClick={() => fileInput.current?.click()}
            className="hover:bg-app flex h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium"
          >
            <FolderOpen aria-hidden size={18} />
            {text.openFile}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            aria-label={text.openFileHint}
            className="hidden"
            onChange={(event) => void openFile(event)}
          />
          <span className="text-ink-muted text-xs">{text.startWarning}</span>
          <button
            type="button"
            disabled={!selected}
            onClick={start}
            className="bg-brand ml-auto h-11 rounded-lg px-5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {text.start}
          </button>
        </footer>
      </div>
    </div>
  );
}
