// Pemeriksa kondisi selesai langkah skenario. Fungsi murni atas keadaan meja kerja, simulasi,
// alat ukur, dan riwayat besaran.
import { FINDING_SEVERITIES } from '../circuit/types';
import type { Finding, PlacedComponent, TerminalRef, Wire } from '../circuit/types';
import type { Snapshot } from '../engine/step-types';
import type { ClampMode, MeterFunction, MeterReading } from '../instruments/multimeter';
import { expectedValue, quantitiesOf, withinTolerance, type QuantityValues } from './quantities';
import { resolveComponents, terminalMatches, terminalsConnected } from './selectors';
import type { ExpectedValue, ReferenceId, ScenarioRule } from './types';

export const DEFAULT_TOLERANCE_PCT = 5;
/** Riwayat besaran yang disimpan: 6 jam simulasi. */
export const HISTORY_KEEP_S = 6 * 3600;

export interface QuantitySample {
  timeS: number;
  values: QuantityValues;
}

export interface MeterView {
  open: boolean;
  fn: MeterFunction;
  red?: TerminalRef;
  black?: TerminalRef;
  reading: MeterReading;
}

export interface ClampView {
  open: boolean;
  mode: ClampMode;
  wireId?: string;
  reading: MeterReading;
}

export interface RuleContext {
  components: readonly PlacedComponent[];
  wires: readonly Wire[];
  /** MCB/fuse yang ON di meja kerja. */
  closedSwitchIds: readonly string[];
  snapshot: Snapshot;
  findings: readonly Finding[];
  multimeter: MeterView;
  clamp: ClampView;
  references: Partial<Record<ReferenceId, number>>;
  /** Urut waktu simulasi. */
  history: readonly QuantitySample[];
  faultFound: boolean;
}

/** Riwayat ditambah satu cuplikan. Waktu mundur (reset percobaan) memulai riwayat baru. */
export function appendSample(
  history: readonly QuantitySample[],
  sample: QuantitySample,
  keepS = HISTORY_KEEP_S,
): QuantitySample[] {
  const last = history.at(-1);
  if (last && sample.timeS < last.timeS) return [sample];
  if (last && sample.timeS === last.timeS) return [...history.slice(0, -1), sample];
  return [...history, sample].filter((entry) => entry.timeS >= sample.timeS - keepS);
}

function readingMatches(
  reading: MeterReading,
  expected: ExpectedValue | undefined,
  tolerancePct: number | undefined,
  references: RuleContext['references'],
  useAbsolute: boolean,
): boolean {
  if (reading.kind !== 'value') return false;
  if (expected === undefined) return true;
  const target = expectedValue(expected, references);
  if (target === undefined) return false;
  const value = useAbsolute ? Math.abs(reading.value) : reading.value;
  return withinTolerance(value, target, tolerancePct ?? DEFAULT_TOLERANCE_PCT);
}

function trendHolds(context: RuleContext, rule: Extract<ScenarioRule, { kind: 'trend' }>): boolean {
  const nowS = context.snapshot.timeS;
  const now = quantitiesOf(context.snapshot)[rule.quantity];
  const start = context.history.filter((sample) => sample.timeS <= nowS - rule.durationS).at(-1);
  if (!start) return false;
  const delta = (now - start.values[rule.quantity]) * (rule.direction === 'rise' ? 1 : -1);
  const minDelta = rule.minDelta ?? 0;
  return minDelta > 0 ? delta >= minDelta : delta > 0;
}

/** `true` bila aturan terpenuhi saat ini. */
export function evaluateRule(rule: ScenarioRule, context: RuleContext): boolean {
  const { components } = context;
  switch (rule.kind) {
    case 'connected':
      return terminalsConnected(context, rule.a, rule.b, rule.throughSwitches);
    case 'placed':
      return resolveComponents(rule.component, components).length >= (rule.count ?? 1);
    case 'switch': {
      const ids = resolveComponents(rule.component, components);
      return ids.some((id) => context.closedSwitchIds.includes(id) === rule.on);
    }
    case 'condition':
      return resolveComponents(rule.component, components).some((id) => {
        const condition = context.snapshot.components[id]?.condition;
        return condition !== undefined && rule.conditions.includes(condition);
      });
    case 'multimeter': {
      const meter = context.multimeter;
      if (!meter.open || meter.fn !== rule.fn || !meter.red || !meter.black) return false;
      if (rule.red && !terminalMatches(rule.red, meter.red, components)) return false;
      if (rule.black && !terminalMatches(rule.black, meter.black, components)) return false;
      const signed = rule.red !== undefined && rule.fn === 'vdc';
      return readingMatches(
        meter.reading,
        rule.expected,
        rule.tolerancePct,
        context.references,
        !signed,
      );
    }
    case 'clamp': {
      const clamp = context.clamp;
      if (!clamp.open || clamp.mode !== rule.mode || !clamp.wireId) return false;
      const wire = context.wires.find((candidate) => candidate.id === clamp.wireId);
      if (!wire) return false;
      if (
        rule.wire &&
        !terminalMatches(rule.wire, wire.from, components) &&
        !terminalMatches(rule.wire, wire.to, components)
      ) {
        return false;
      }
      const reading = clamp.reading;
      if (
        rule.minA !== undefined &&
        (reading.kind !== 'value' || Math.abs(reading.value) < rule.minA)
      ) {
        return false;
      }
      return readingMatches(reading, rule.expected, rule.tolerancePct, context.references, true);
    }
    case 'value': {
      const value = quantitiesOf(context.snapshot)[rule.quantity];
      return (
        (rule.min === undefined || value >= rule.min) &&
        (rule.max === undefined || value <= rule.max)
      );
    }
    case 'trend':
      return trendHolds(context, rule);
    case 'no-finding': {
      const floor = FINDING_SEVERITIES.indexOf(rule.severity ?? 'danger');
      return !context.findings.some(
        (finding) => FINDING_SEVERITIES.indexOf(finding.severity) >= floor,
      );
    }
    case 'fault-found':
      return context.faultFound;
    case 'all':
      return rule.rules.every((inner) => evaluateRule(inner, context));
    case 'any':
      return rule.rules.some((inner) => evaluateRule(inner, context));
  }
}

/** Aturan yang membaca alat ukur; dipakai untuk mencatat bukti ukur. */
export function usesInstrument(rule: ScenarioRule): boolean {
  if (rule.kind === 'multimeter' || rule.kind === 'clamp') return true;
  if (rule.kind === 'all' || rule.kind === 'any') return rule.rules.some(usesInstrument);
  return false;
}
