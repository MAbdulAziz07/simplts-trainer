import { Stethoscope } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FAULT_KINDS, type FaultKind } from '@/domain';
import { t } from '@/i18n';
import {
  findCatalogItem,
  useCircuitStore,
  useScenarioStore,
  useUiStore,
  type ScenarioRun,
} from '@/store';
import { FAULT_ICON } from './icons';

const text = t.scenarios;

/** Kabel atau komponen yang sedang dipilih di meja kerja, sebagai lokasi gangguan. */
function useSelectedTarget(): { id: string; name: string } | undefined {
  const componentId = useCircuitStore((state) => state.selectedComponentIds[0]);
  const wireId = useCircuitStore((state) => state.selectedWireIds[0]);
  const catalogId = useCircuitStore(
    (state) => state.doc.components.find((part) => part.id === componentId)?.catalogId,
  );
  if (componentId) {
    const name = catalogId ? (findCatalogItem(catalogId)?.name ?? componentId) : componentId;
    return { id: componentId, name: t.workbench.component(name, componentId) };
  }
  if (wireId) return { id: wireId, name: t.wire.properties(wireId) };
  return undefined;
}

/** Mode Cari Gangguan: tunjuk lokasi di meja, pilih jenis gangguan, lalu kirim. */
export function DiagnosisBox({ run }: { run: ScenarioRun }) {
  const [kind, setKind] = useState<FaultKind>();
  // Dilipat bawaan supaya panel tidak menutupi meja; dibuka saat peserta siap menjawab. Selama
  // terbuka, ketukan di meja memilih komponen walau terminalnya menutupi badan komponen.
  const isOpen = useUiStore((state) => state.pointingCause);
  const setIsOpen = useUiStore((state) => state.setPointingCause);
  useEffect(() => () => setIsOpen(false), [setIsOpen]);
  const target = useSelectedTarget();
  const lastDiagnosis = useScenarioStore((state) => state.lastDiagnosis);
  const diagnose = useScenarioStore((state) => state.diagnose);

  return (
    <section
      aria-label={text.diagnose.title}
      className="border-line flex flex-col gap-2 border-t pt-2"
    >
      <p className="text-ink-muted text-xs">
        {text.diagnose.found(run.foundFaults.length, run.faults.length)}
      </p>
      {!isOpen ? (
        <button
          type="button"
          aria-expanded={false}
          onClick={() => setIsOpen(true)}
          className="hover:bg-app border-line flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-semibold"
        >
          <Stethoscope aria-hidden size={18} />
          {text.diagnose.open}
        </button>
      ) : (
        <>
          <p className="text-sm font-medium">
            {target ? text.diagnose.target(target.name) : text.diagnose.pickTarget}
          </p>
          <div role="group" aria-label={text.diagnose.pickKind} className="grid grid-cols-4 gap-1">
            {FAULT_KINDS.map((candidate) => {
              const Icon = FAULT_ICON[candidate];
              return (
                <button
                  key={candidate}
                  type="button"
                  aria-pressed={kind === candidate}
                  aria-label={text.faults[candidate]}
                  title={text.faults[candidate]}
                  onClick={() => setKind(candidate)}
                  className={`flex size-11 items-center justify-center rounded-lg ${
                    kind === candidate ? 'bg-brand/15 ring-brand ring-2' : 'hover:bg-app'
                  }`}
                >
                  <Icon aria-hidden size={20} />
                </button>
              );
            })}
          </div>
          {kind && <p className="text-xs font-medium">{text.faults[kind]}</p>}
          <button
            type="button"
            disabled={!kind || !target}
            onClick={() => kind && target && diagnose(kind, target.id)}
            className="bg-brand flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
          >
            <Stethoscope aria-hidden size={18} />
            {text.diagnose.submit}
          </button>
        </>
      )}
      {lastDiagnosis && (
        <p
          role="status"
          className={`text-sm font-semibold ${
            lastDiagnosis === 'right' ? 'text-status-ok' : 'text-status-danger'
          }`}
        >
          {lastDiagnosis === 'right' ? text.diagnose.right : text.diagnose.wrong}
        </p>
      )}
    </section>
  );
}
