// Skema berkas skenario src/data/scenarios/*.json (docs/SKENARIO.md). Bentuk hasilnya sama
// dengan tipe `Scenario` di src/domain/scenario/types.ts.
import { z } from 'zod';
import {
  CLAMP_MODES,
  COMPONENT_CONDITIONS,
  FAULT_KINDS,
  FINDING_SEVERITIES,
  METER_FUNCTIONS,
  PACKAGE_IDS,
  REFERENCE_IDS,
  SCENARIO_MODES,
  SCENARIO_QUANTITIES,
  STEP_ICONS,
  type Scenario,
  type ScenarioRule,
} from '@/domain';
import { projectFileSchema, type ProjectFile } from '../project';

export const SCENARIO_FORMAT_VERSION = 1;
export const GOAL_MAX_SENTENCES = 2;
export const STEP_TEXT_MAX_CHARS = 120;
export const HINT_MAX_CHARS = 200;

const idSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const selector = z.string().min(1);
const terminalSelector = z.string().regex(/^[^.\s]+\.[^.\s]+$/, {
  error: 'Penunjuk terminal ditulis komponen.terminal, mis. scc.bat-pos',
});
const percent = z.number().min(0).max(100);

/** Jumlah kalimat: potongan yang diakhiri titik, tanda tanya, atau tanda seru. */
export function sentenceCount(text: string): number {
  return text
    .split(/[.!?]+(?:\s+|$)/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length;
}

const expectedSchema = z.union([
  z.number(),
  z.strictObject({ ref: z.enum(REFERENCE_IDS), factor: z.number().positive().optional() }),
]);

export const ruleSchema: z.ZodType<ScenarioRule> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('connected'),
      a: terminalSelector,
      b: terminalSelector,
      throughSwitches: z.boolean().optional(),
    }),
    z.strictObject({
      kind: z.literal('placed'),
      component: selector,
      count: z.number().int().positive().optional(),
    }),
    z.strictObject({ kind: z.literal('switch'), component: selector, on: z.boolean() }),
    z.strictObject({
      kind: z.literal('condition'),
      component: selector,
      conditions: z.array(z.enum(COMPONENT_CONDITIONS)).min(1),
    }),
    z.strictObject({
      kind: z.literal('multimeter'),
      fn: z.enum(METER_FUNCTIONS),
      red: terminalSelector.optional(),
      black: terminalSelector.optional(),
      expected: expectedSchema.optional(),
      tolerancePct: percent.optional(),
    }),
    z.strictObject({
      kind: z.literal('clamp'),
      mode: z.enum(CLAMP_MODES),
      wire: terminalSelector.optional(),
      expected: expectedSchema.optional(),
      tolerancePct: percent.optional(),
      minA: z.number().nonnegative().optional(),
    }),
    z.strictObject({
      kind: z.literal('value'),
      quantity: z.enum(SCENARIO_QUANTITIES),
      min: z.number().optional(),
      max: z.number().optional(),
    }),
    z.strictObject({
      kind: z.literal('trend'),
      quantity: z.enum(SCENARIO_QUANTITIES),
      direction: z.enum(['rise', 'fall']),
      durationS: z.number().positive(),
      minDelta: z.number().nonnegative().optional(),
    }),
    z.strictObject({
      kind: z.literal('no-finding'),
      severity: z.enum(FINDING_SEVERITIES).optional(),
    }),
    z.strictObject({ kind: z.literal('fault-found') }),
    z.strictObject({ kind: z.literal('all'), rules: z.array(ruleSchema).min(1) }),
    z.strictObject({ kind: z.literal('any'), rules: z.array(ruleSchema).min(1) }),
  ]),
);

const stepSchema = z.strictObject({
  id: idSchema,
  text: z.string().min(1).max(STEP_TEXT_MAX_CHARS),
  icon: z.enum(STEP_ICONS),
  done: ruleSchema,
  hints: z.array(z.string().min(1).max(HINT_MAX_CHARS)).max(2).default([]),
  points: z.number().nonnegative().optional(),
});

const faultSchema = z.strictObject({
  kind: z.enum(FAULT_KINDS),
  target: idSchema,
  value: z.number().positive().optional(),
});

const rubricSchema = z.strictObject({
  stepPoints: z.number().nonnegative().default(10),
  hintPenalty: z.tuple([z.number().nonnegative(), z.number().nonnegative()]).default([2, 5]),
  faultPoints: z.number().nonnegative().default(40),
  faultNoEvidencePoints: z.number().nonnegative().default(20),
  wrongAnswerPenalty: z.number().nonnegative().default(5),
  damagePenalty: z.number().nonnegative().default(10),
  dangerFindingPenalty: z.number().nonnegative().default(5),
  passPct: percent.default(70),
  timeLimitS: z.number().positive().optional(),
});

export const scenarioFileSchema = z.strictObject({
  formatVersion: z.literal(SCENARIO_FORMAT_VERSION),
  id: idSchema,
  version: z.number().int().positive(),
  title: z.string().min(1).max(60),
  package: z.enum(PACKAGE_IDS),
  mode: z.enum(SCENARIO_MODES),
  goal: z
    .string()
    .min(1)
    .max(240)
    .refine((text) => sentenceCount(text) <= GOAL_MAX_SENTENCES, {
      error: `Tujuan paling banyak ${GOAL_MAX_SENTENCES} kalimat`,
    }),
  initialCircuit: projectFileSchema.optional(),
  environment: z
    .strictObject({
      startHour: z.number().min(0).lt(24).optional(),
      cloudCoverPct: percent.optional(),
      irradianceWm2: z.number().min(0).max(1200).optional(),
    })
    .optional(),
  steps: z.array(stepSchema).min(1),
  faults: z.array(faultSchema).default([]),
  faultCount: z.number().int().positive().default(1),
  rubric: rubricSchema.default(rubricSchema.parse({})),
});

export type ScenarioFile = z.infer<typeof scenarioFileSchema>;

/** Skenario yang sudah divalidasi, dengan rangkaian awal berbentuk berkas proyek. */
export type LoadedScenario = Scenario<ProjectFile>;

// Bentuk hasil skema harus bisa dipakai sebagai `Scenario`.
type AssertAssignable<T extends LoadedScenario> = T;
export type ScenarioFileCheck = AssertAssignable<Omit<ScenarioFile, 'formatVersion'>>;
