// Skor skenario menurut rubrik: nilai langkah dikurangi petunjuk, nilai gangguan, dan potongan.
import type { Rubric, Scenario } from './types';

export const MAX_HINTS = 2;

export interface Diagnosis {
  correct: boolean;
  /** Ada bacaan alat ukur sejak skenario dimulai sampai jawaban dikirim. */
  withEvidence: boolean;
}

export interface ScenarioProgress {
  completedStepIds: readonly string[];
  /** Jumlah petunjuk yang dibuka per langkah, 0..2. */
  hintsUsed: Readonly<Record<string, number>>;
  /** Jawaban benar pertama; kosong bila belum. */
  diagnosis?: Diagnosis;
  wrongAnswers: number;
  /** Komponen dan kabel yang rusak selama skenario. */
  damageCount: number;
  /** Kode temuan bahaya yang pernah muncul, tanpa ulangan. */
  dangerFindingCodes: readonly string[];
}

export interface StepScore {
  stepId: string;
  done: boolean;
  hints: number;
  earned: number;
  max: number;
}

export interface ScoreResult {
  steps: StepScore[];
  faultEarned: number;
  faultMax: number;
  wrongAnswerPenalty: number;
  damagePenalty: number;
  dangerPenalty: number;
  score: number;
  max: number;
  /** 0..100, dibulatkan. */
  pct: number;
  passed: boolean;
}

/** Potongan kumulatif untuk `hints` petunjuk yang dibuka. */
export function hintPenaltyOf(rubric: Rubric, hints: number): number {
  return rubric.hintPenalty.slice(0, Math.min(hints, MAX_HINTS)).reduce((a, b) => a + b, 0);
}

export function scoreScenario(scenario: Scenario, progress: ScenarioProgress): ScoreResult {
  const { rubric } = scenario;
  const steps = scenario.steps.map((step): StepScore => {
    const max = step.points ?? rubric.stepPoints;
    const hints = progress.hintsUsed[step.id] ?? 0;
    const done = progress.completedStepIds.includes(step.id);
    const earned = done ? Math.max(0, max - hintPenaltyOf(rubric, hints)) : 0;
    return { stepId: step.id, done, hints, earned, max };
  });
  const faultMax = scenario.mode === 'troubleshoot' ? rubric.faultPoints : 0;
  const diagnosis = progress.diagnosis;
  const faultEarned =
    faultMax === 0 || !diagnosis?.correct
      ? 0
      : diagnosis.withEvidence
        ? rubric.faultPoints
        : rubric.faultNoEvidencePoints;
  const wrongAnswerPenalty = progress.wrongAnswers * rubric.wrongAnswerPenalty;
  const damagePenalty = progress.damageCount * rubric.damagePenalty;
  const dangerPenalty = progress.dangerFindingCodes.length * rubric.dangerFindingPenalty;

  const max = steps.reduce((total, step) => total + step.max, 0) + faultMax;
  const gross = steps.reduce((total, step) => total + step.earned, 0) + faultEarned;
  const score = Math.max(0, gross - wrongAnswerPenalty - damagePenalty - dangerPenalty);
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return {
    steps,
    faultEarned,
    faultMax,
    wrongAnswerPenalty,
    damagePenalty,
    dangerPenalty,
    score,
    max,
    pct,
    passed: pct >= rubric.passPct,
  };
}
