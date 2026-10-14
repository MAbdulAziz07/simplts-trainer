import { describe, expect, it } from 'vitest';
import type { RuleContext, Snapshot } from '@/domain';
import type { LoadedScenario } from '@/data';
import {
  allFaultsFound,
  completeSteps,
  createRun,
  diagnose,
  finishRun,
  HISTORY_SAMPLE_S,
  openHint,
  progressOf,
  recordDangerFindings,
  recordEvents,
  recordQuantitySample,
} from './scenario-run';

const RUBRIC = {
  stepPoints: 10,
  hintPenalty: [2, 5] as [number, number],
  faultPoints: 40,
  faultNoEvidencePoints: 20,
  wrongAnswerPenalty: 5,
  damagePenalty: 10,
  dangerFindingPenalty: 5,
  passPct: 70,
};
const SCENARIO: LoadedScenario = {
  id: 'uji',
  version: 2,
  title: 'Uji',
  package: 'min',
  mode: 'troubleshoot',
  goal: 'Uji.',
  steps: [
    {
      id: 'satu',
      text: 'a',
      icon: 'clock',
      done: { kind: 'value', quantity: 'sim-time-s', min: 10 },
      hints: ['samar', 'jelas'],
    },
    {
      id: 'dua',
      text: 'b',
      icon: 'clock',
      done: { kind: 'value', quantity: 'sim-time-s', min: 5 },
      hints: ['samar'],
    },
    { id: 'tiga', text: 'c', icon: 'wrench', done: { kind: 'fault-found' }, hints: [] },
  ],
  faults: [],
  faultCount: 1,
  rubric: RUBRIC,
};
const FAULT = { kind: 'wire-open' as const, target: 'w4' };

function snapshotAt(timeS: number, events: Snapshot['events'] = []): Snapshot {
  return {
    timeS,
    components: {},
    events,
    operatingPoint: { batteries: {}, pvModules: {}, loads: {} },
  } as unknown as Snapshot;
}

const contextAt = (timeS: number) =>
  ({
    components: [],
    wires: [],
    closedSwitchIds: [],
    snapshot: snapshotAt(timeS),
  }) as unknown as Omit<RuleContext, 'history' | 'faultFound'>;

const fresh = () => createRun(SCENARIO, [FAULT], ' Ani ', 1000);

describe('createRun dan completeSteps', () => {
  it('mulai di langkah pertama dengan log start', () => {
    const run = fresh();
    expect(run.stepIndex).toBe(0);
    expect(run.log).toEqual([{ realS: 0, simS: 0, action: 'start', detail: 'uji v2' }]);
  });

  it('langkah dicentang berurutan; yang sudah terpenuhi ikut dicentang', () => {
    expect(completeSteps(fresh(), contextAt(5), 2000).stepIndex).toBe(0);
    const run = completeSteps(fresh(), contextAt(12), 3500);
    expect(run.completed.map((step) => step.stepId)).toEqual(['satu', 'dua']);
    expect(run.completed[0]).toMatchObject({ realS: 2.5, simS: 12 });
    expect(run.log.filter((entry) => entry.action === 'step-done')).toHaveLength(2);
  });

  it('langkah fault-found menunggu semua gangguan ditemukan', () => {
    let run = completeSteps(fresh(), contextAt(12), 2000);
    run = diagnose(run, 'wire-open', 'w4', 12, 2500).run;
    expect(allFaultsFound(run)).toBe(true);
    expect(completeSteps(run, contextAt(12), 3000).stepIndex).toBe(3);
  });
});

describe('petunjuk', () => {
  it('paling banyak sejumlah petunjuk langkah itu, dicatat di log', () => {
    let run = fresh();
    for (let i = 0; i < 4; i++) run = openHint(run, 0, 1000);
    expect(run.hintsUsed).toEqual({ satu: 2 });
    expect(run.log.filter((entry) => entry.action === 'hint')).toHaveLength(2);
  });

  it('mode Asesmen tanpa petunjuk', () => {
    const run = createRun({ ...SCENARIO, mode: 'assessment' }, [], '', 0);
    expect(openHint(run, 0, 0)).toBe(run);
  });
});

describe('diagnose', () => {
  it('jawaban salah menambah hitungan salah', () => {
    const { run, fault } = diagnose(fresh(), 'fuse-blown', 'w4', 0, 1000);
    expect(fault).toBeUndefined();
    expect(run.wrongAnswers).toBe(1);
    expect(run.log.at(-1)?.action).toBe('diagnosis-wrong');
  });

  it('jawaban benar dengan dan tanpa bukti ukur', () => {
    const blind = diagnose(fresh(), 'wire-open', 'w4', 0, 1000);
    expect(blind.fault).toBe(blind.run.faults[0]);
    expect(progressOf(blind.run).diagnosis).toEqual({ correct: true, withEvidence: false });
    const measured = diagnose({ ...fresh(), measured: true }, 'wire-open', 'w4', 0, 1000).run;
    expect(progressOf(measured).diagnosis).toEqual({ correct: true, withEvidence: true });
  });

  it('gangguan yang sudah ditemukan tidak bisa ditebak lagi', () => {
    const once = diagnose(fresh(), 'wire-open', 'w4', 0, 1000).run;
    expect(diagnose(once, 'wire-open', 'w4', 0, 1000).fault).toBeUndefined();
  });
});

describe('catatan simulasi', () => {
  it('cuplikan riwayat tiap HISTORY_SAMPLE_S detik', () => {
    let run = recordQuantitySample(fresh(), snapshotAt(0));
    run = recordQuantitySample(run, snapshotAt(HISTORY_SAMPLE_S - 1));
    run = recordQuantitySample(run, snapshotAt(HISTORY_SAMPLE_S));
    expect(run.history.map((sample) => sample.timeS)).toEqual([0, HISTORY_SAMPLE_S]);
  });

  it('kerusakan dihitung sekali per komponen', () => {
    const damaged = { kind: 'component-damaged' as const, timeS: 3, componentId: 'scc' };
    const trip = { kind: 'mcb-trip' as const, timeS: 4, componentId: 'mcb-pv' };
    let run = recordEvents(fresh(), snapshotAt(4, [damaged, trip]), 1000);
    run = recordEvents(run, snapshotAt(5, [damaged]), 1000);
    expect(run.damagedIds).toEqual(['scc']);
    expect(run.log.filter((entry) => entry.action === 'sim-event')).toHaveLength(3);
  });

  it('temuan bahaya dicatat sekali per kode', () => {
    let run = recordDangerFindings(fresh(), ['short-circuit', 'short-circuit'], 0, 1000);
    run = recordDangerFindings(run, ['short-circuit', 'reverse-polarity'], 0, 1000);
    expect(run.dangerFindingCodes).toEqual(['short-circuit', 'reverse-polarity']);
  });

  it('selesai menghentikan perubahan', () => {
    const done = finishRun(fresh(), 30, 5000);
    expect(done.finishedAtMs).toBe(5000);
    expect(done.log.at(-1)).toMatchObject({ action: 'finish', realS: 4, simS: 30 });
    expect(completeSteps(done, contextAt(99), 6000)).toBe(done);
    expect(finishRun(done, 40, 7000)).toBe(done);
  });
});
