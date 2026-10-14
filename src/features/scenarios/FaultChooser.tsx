import { Shuffle } from 'lucide-react';
import type { Fault } from '@/domain';
import type { LoadedScenario } from '@/data';
import { t } from '@/i18n';
import { faultChoicesOf } from '@/store';
import { FAULT_ICON } from './icons';

const text = t.scenarios;

interface FaultChooserProps {
  scenario: LoadedScenario;
  /** Kosong = acak. */
  value: readonly Fault[];
  onChange: (faults: Fault[]) => void;
}

const sameFault = (a: Fault, b: Fault) => a.kind === b.kind && a.target === b.target;

/**
 * Pilihan instruktur: gangguan tersembunyi dipilih sendiri atau diacak. Dilipat supaya peserta
 * yang memulai sendiri tidak langsung melihat daftarnya.
 */
export function FaultChooser({ scenario, value, onChange }: FaultChooserProps) {
  const choices = faultChoicesOf(scenario);
  const toggle = (fault: Fault) => {
    const isOn = value.some((other) => sameFault(other, fault));
    onChange(isOn ? value.filter((other) => !sameFault(other, fault)) : [...value, fault]);
  };

  return (
    <details className="border-line rounded-xl border">
      <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium">
        {text.instructor}
      </summary>
      <div className="flex flex-col gap-1 p-2 pt-0">
        <button
          type="button"
          aria-pressed={value.length === 0}
          title={text.randomHint}
          onClick={() => onChange([])}
          className={`flex h-11 items-center gap-2 rounded-lg px-3 text-left text-sm ${
            value.length === 0 ? 'bg-brand/15 ring-brand ring-2' : 'hover:bg-app'
          }`}
        >
          <Shuffle aria-hidden size={18} />
          {text.random} · {text.faultCount(scenario.faultCount)}
        </button>
        {choices.map((fault) => {
          const Icon = FAULT_ICON[fault.kind];
          const isOn = value.some((other) => sameFault(other, fault));
          return (
            <button
              key={`${fault.kind}-${fault.target}`}
              type="button"
              aria-pressed={isOn}
              onClick={() => toggle(fault)}
              className={`flex h-11 items-center gap-2 rounded-lg px-3 text-left text-sm ${
                isOn ? 'bg-brand/15 ring-brand ring-2' : 'hover:bg-app'
              }`}
            >
              <Icon aria-hidden size={18} />
              {text.faultTarget(text.faults[fault.kind], fault.target)}
            </button>
          );
        })}
      </div>
    </details>
  );
}
