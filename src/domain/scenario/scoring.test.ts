import { describe, expect, it } from 'vitest';
import { hintPenaltyOf, scoreScenario, type ScenarioProgress } from './scoring';
import type { Scenario } from './types';

const SCENARIO: Scenario = {
  id: 'uji',
  version: 1,
  title: 'Uji',
  package: 'min',
  mode: 'troubleshoot',
  goal: 'Uji.',
  steps: [
    { id: 's1', text: 'a', icon: 'cable', done: { kind: 'fault-found' }, hints: [] },
    { id: 's2', text: 'b', icon: 'gauge', done: { kind: 'fault-found' }, hints: [], points: 20 },
  ],
  faults: [],
  faultCount: 1,
  rubric: {
    stepPoints: 10,
    hintPenalty: [2, 5],
    faultPoints: 30,
    faultNoEvidencePoints: 15,
    wrongAnswerPenalty: 5,
    damagePenalty: 10,
    dangerFindingPenalty: 4,
    passPct: 70,
  },
};
const EMPTY: ScenarioProgress = {
  completedStepIds: [],
  hintsUsed: {},
  wrongAnswers: 0,
  damageCount: 0,
  dangerFindingCodes: [],
};

describe('scoreScenario', () => {
  it('nilai penuh tanpa petunjuk dan dengan bukti ukur', () => {
    const result = scoreScenario(SCENARIO, {
      ...EMPTY,
      completedStepIds: ['s1', 's2'],
      diagnosis: { correct: true, withEvidence: true },
    });
    expect(result.max).toBe(60);
    expect(result.score).toBe(60);
    expect(result.pct).toBe(100);
    expect(result.passed).toBe(true);
  });

  it('petunjuk mengurangi nilai langkah itu saja', () => {
    expect(hintPenaltyOf(SCENARIO.rubric, 0)).toBe(0);
    expect(hintPenaltyOf(SCENARIO.rubric, 1)).toBe(2);
    expect(hintPenaltyOf(SCENARIO.rubric, 2)).toBe(7);
    const result = scoreScenario(SCENARIO, {
      ...EMPTY,
      completedStepIds: ['s1'],
      hintsUsed: { s1: 2, s2: 1 },
    });
    expect(result.steps.map((step) => step.earned)).toEqual([3, 0]);
  });

  it('jawaban tanpa bukti ukur bernilai sebagian; potongan dijumlah, skor tidak negatif', () => {
    const partial = scoreScenario(SCENARIO, {
      ...EMPTY,
      diagnosis: { correct: true, withEvidence: false },
      wrongAnswers: 1,
    });
    expect(partial.faultEarned).toBe(15);
    expect(partial.score).toBe(10);
    const harsh = scoreScenario(SCENARIO, {
      ...EMPTY,
      damageCount: 2,
      dangerFindingCodes: ['short-circuit'],
    });
    expect(harsh.damagePenalty).toBe(20);
    expect(harsh.dangerPenalty).toBe(4);
    expect(harsh.score).toBe(0);
    expect(harsh.passed).toBe(false);
  });

  it('mode lain tidak menghitung nilai gangguan', () => {
    const guided = scoreScenario({ ...SCENARIO, mode: 'guided' }, EMPTY);
    expect(guided.faultMax).toBe(0);
    expect(guided.max).toBe(30);
  });
});
