import { Lock, RotateCcw } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import {
  paramSpecsOf,
  paramValue,
  type CatalogItem,
  type ComponentParams,
  type NumberParamSpec,
  type ParamIssueCode,
  type ParamSpec,
  type ParamValue,
} from '@/domain';
import { t } from '@/i18n';
import { useCircuitStore } from '@/store';
import { formatParam, parseParamNumber, ratingText } from './ratings';
import { Segmented } from './VariantPicker';

const store = useCircuitStore.getState;

function ResetButton({ id, spec }: { id: string; spec: ParamSpec }) {
  const label = t.params.reset(ratingText(spec.key).symbol);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => store().resetParams(id, spec.key)}
      className="hover:bg-app text-ink-muted flex size-11 shrink-0 items-center justify-center rounded-lg"
    >
      <RotateCcw aria-hidden size={18} />
    </button>
  );
}

/** Isian angka; disimpan saat Enter atau saat pindah dari isian, Escape membatalkan. */
function NumberField({ id, spec, value }: { id: string; spec: NumberParamSpec; value: number }) {
  const [draft, setDraft] = useState(formatParam(value));
  const [issue, setIssue] = useState<ParamIssueCode>();
  const { symbol, name } = ratingText(spec.key);
  const commit = () => {
    const parsed = parseParamNumber(draft);
    if (parsed === value) return setIssue(undefined);
    const issues = store().setParam(id, spec.key, Number.isNaN(parsed) ? draft : parsed);
    setIssue(issues.find((candidate) => candidate.key === spec.key)?.code ?? issues[0]?.code);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      setDraft(formatParam(value));
      setIssue(undefined);
    }
  };
  return (
    <>
      <label className="flex min-w-0 flex-1 items-center gap-1" title={name}>
        <span className="sr-only">{name}</span>
        <input
          type="text"
          inputMode="decimal"
          aria-label={name}
          aria-invalid={issue !== undefined}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          className="param-input"
        />
        <span className="rating-unit">{spec.unit || symbol}</span>
      </label>
      {issue && (
        <p role="alert" className="text-status-danger w-full text-xs">
          {t.params.issues[issue]}
        </p>
      )}
    </>
  );
}

function FieldValue({ id, spec, value }: { id: string; spec: ParamSpec; value: ParamValue }) {
  if (spec.kind === 'number' && typeof value === 'number')
    return <NumberField key={value} id={id} spec={spec} value={value} />;
  if (spec.kind === 'choice')
    return (
      <div className="w-full">
        <Segmented
          showLabel={false}
          label={ratingText(spec.key).name}
          options={spec.options.map((option) => ({
            key: option,
            label: option,
            selected: option === value,
            onPick: () => store().setParam(id, spec.key, option),
          }))}
        />
      </div>
    );
  return (
    <span className="param-fixed" title={t.params.fixed}>
      <Lock aria-hidden size={14} />
      {formatParam(value)}
      {'unit' in spec && spec.unit && <span className="rating-unit">{spec.unit}</span>}
    </span>
  );
}

/**
 * Pengaturan manual rating utama komponen: isian per parameter dengan nilai default di bawahnya
 * dan tombol kembalikan; parameter tetap hanya ditampilkan (docs/UX.md §4.1).
 */
export function ParamEditor({
  id,
  item,
  params,
}: {
  id: string;
  item: CatalogItem;
  params: ComponentParams | undefined;
}) {
  const specs = paramSpecsOf(item);
  return (
    <section aria-label={t.params.editor} className="flex flex-col gap-2">
      {specs.map((spec) => {
        const fallback = paramValue(item, spec);
        if (fallback === undefined) return null;
        const changed = params?.[spec.key] !== undefined;
        const value = params?.[spec.key] ?? fallback;
        const unit = 'unit' in spec ? spec.unit : '';
        return (
          <div
            key={spec.key}
            className="param-field"
            data-param={spec.key}
            data-changed={changed || undefined}
          >
            <abbr className="param-symbol" title={ratingText(spec.key).name}>
              {ratingText(spec.key).symbol}
            </abbr>
            <div className="flex flex-wrap items-center gap-1">
              <FieldValue id={id} spec={spec} value={value} />
              {changed && <ResetButton id={id} spec={spec} />}
            </div>
            {spec.kind !== 'fixed' && (
              <p className="text-ink-muted text-xs">
                {t.params.defaultValue(`${formatParam(fallback)}${unit ? ` ${unit}` : ''}`)}
              </p>
            )}
          </div>
        );
      })}
      {params && (
        <button
          type="button"
          onClick={() => store().resetParams(id)}
          className="border-line hover:border-brand flex h-11 items-center justify-center gap-2 rounded-lg border bg-white text-sm font-semibold"
        >
          <RotateCcw aria-hidden size={16} />
          {t.params.resetAll}
        </button>
      )}
    </section>
  );
}
