import { Panel } from '@xyflow/react';
import type { TerminalKind } from '@/domain';
import { t } from '@/i18n';
import { TerminalDot, terminalBackground } from '@/ui';

type LegendKind = keyof typeof t.workbench.legendKinds;

const KINDS: readonly LegendKind[] = ['dc+', 'dc-', 'acL', 'acN', 'pe'];

/**
 * Legenda mengambang di kiri bawah meja, di samping segitiga temuan: contoh garis kabel lima warna
 * beserta bentuk terminalnya (docs/UX.md §1 butir 6, §2.1). DC bulat, AC dan PE persegi.
 */
export function WireLegend() {
  return (
    <Panel position="bottom-left" className="wire-legend-panel">
      <ul
        aria-label={t.workbench.legend}
        className="border-line bg-card flex h-11 items-center gap-3 rounded-xl border px-3 shadow-sm"
      >
        {KINDS.map((kind) => (
          <li key={kind} className="flex items-center gap-1.5 text-xs font-semibold">
            <span
              aria-hidden
              className="h-1 w-5 rounded-full"
              style={{ background: terminalBackground(kind as TerminalKind) }}
            />
            <TerminalDot kind={kind as TerminalKind} sizePx={14} />
            {t.workbench.legendKinds[kind]}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
