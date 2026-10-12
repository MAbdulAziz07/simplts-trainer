import { Panel } from '@xyflow/react';
import { CircleHelp, Info, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { Finding, FindingSeverity } from '@/domain';
import { t } from '@/i18n';
import { findCatalogItem, useCircuitStore, useFindingsStore } from '@/store';

const SEVERITY_ICON: Record<FindingSeverity, LucideIcon> = {
  info: Info,
  warning: TriangleAlert,
  danger: OctagonAlert,
};
const SEVERITY_TEXT: Record<FindingSeverity, string> = {
  info: 'text-ink-muted',
  warning: 'text-status-warning',
  danger: 'text-status-danger',
};
const SEVERITY_FILL: Record<FindingSeverity, string> = {
  info: 'bg-control',
  warning: 'bg-status-warning',
  danger: 'bg-status-danger',
};

const keyOf = (finding: Finding): string =>
  [finding.code, ...finding.componentIds, ...(finding.wireIds ?? [])].join('|');

/** Nama komponen pertama temuan, ditambah `+n` bila lebih dari satu. */
function useSubject(finding: Finding): string {
  return useCircuitStore((state) => {
    const [firstId, ...rest] = finding.componentIds;
    const part = state.doc.components.find((candidate) => candidate.id === firstId);
    const name = part ? (findCatalogItem(part.catalogId)?.name ?? '') : '';
    return rest.length > 0 ? `${name} ${t.findingsPanel.more(rest.length)}` : name;
  });
}

interface FindingRowProps {
  finding: Finding;
  explained: boolean;
  onExplain: () => void;
}

/** Satu temuan: ikon tingkat + pesan singkat; penjelasan baru tampil lewat tombol "?" (US27). */
function FindingRow({ finding, explained, onExplain }: FindingRowProps) {
  const { message, explanation } = t.findings[finding.code];
  const Icon = SEVERITY_ICON[finding.severity];
  const subject = useSubject(finding);
  // Komponen dan kabel temuan dipilih di meja, sehingga letaknya terlihat.
  const show = (): void =>
    useCircuitStore.getState().select(finding.componentIds, finding.wireIds ?? []);
  return (
    <li data-severity={finding.severity} data-code={finding.code}>
      <div className="flex items-stretch">
        <button
          type="button"
          aria-label={t.findingsPanel.show(message)}
          onClick={show}
          className="hover:bg-app flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1 text-left"
        >
          <Icon aria-hidden size={20} className={`shrink-0 ${SEVERITY_TEXT[finding.severity]}`} />
          <span className="min-w-0">
            <span className="block text-sm leading-tight font-semibold">{message}</span>
            <span className="text-ink-muted block truncate text-xs">
              {t.severities[finding.severity]}
              {subject && ` · ${subject}`}
            </span>
          </span>
        </button>
        <button
          type="button"
          aria-label={t.findingsPanel.explain(message)}
          aria-expanded={explained}
          onClick={onExplain}
          className="hover:bg-app text-ink-muted flex size-11 shrink-0 items-center justify-center rounded-lg"
        >
          <CircleHelp aria-hidden size={20} />
        </button>
      </div>
      {explained && <p className="text-ink-muted px-2 pb-2 text-xs leading-snug">{explanation}</p>}
    </li>
  );
}

/**
 * Segitiga kecil di pojok kiri bawah meja dengan jumlah temuan pemeriksaan rangkaian. Daftar
 * singkatnya baru muncul saat diklik; warnanya mengikuti temuan terberat.
 */
export function FindingsButton() {
  const findings = useFindingsStore((state) => state.findings);
  const [open, setOpen] = useState(false);
  const [explainedKey, setExplainedKey] = useState<string>();
  const count = findings.length;
  // Temuan sudah urut dari yang terberat.
  const worst = findings[0]?.severity;
  const isOpen = open && count > 0;
  const label = t.findingsPanel.button(count);

  return (
    <Panel position="bottom-left">
      <div
        className="relative"
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        {isOpen && (
          <ul
            aria-label={t.findingsPanel.list}
            className="border-line bg-card nowheel absolute bottom-full left-0 mb-2 max-h-80 w-80 overflow-y-auto rounded-xl border p-1 shadow-md"
          >
            {findings.map((finding) => {
              const key = keyOf(finding);
              return (
                <FindingRow
                  key={key}
                  finding={finding}
                  explained={key === explainedKey}
                  onExplain={() => setExplainedKey(key === explainedKey ? undefined : key)}
                />
              );
            })}
          </ul>
        )}
        <button
          type="button"
          aria-label={label}
          title={label}
          aria-expanded={isOpen}
          disabled={count === 0}
          data-severity={worst}
          onClick={() => setOpen((wasOpen) => !wasOpen)}
          className={`border-line bg-card relative flex size-11 items-center justify-center rounded-xl border shadow-sm ${
            worst ? SEVERITY_TEXT[worst] : 'text-control opacity-60'
          }`}
        >
          <TriangleAlert aria-hidden size={24} />
          <span
            className={`absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold text-white tabular-nums ${
              worst ? SEVERITY_FILL[worst] : 'bg-control'
            }`}
          >
            {count}
          </span>
        </button>
      </div>
    </Panel>
  );
}
