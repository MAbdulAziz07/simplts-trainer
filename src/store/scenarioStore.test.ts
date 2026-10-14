import { beforeEach, describe, expect, it } from 'vitest';
import type { TerminalRef } from '@/domain';
import { EMPTY_DOC } from './circuit-doc';
import { useCircuitStore } from './circuitStore';
import { useFaultStore } from './faultStore';
import { emptyHistory } from './history';
import { useInstrumentStore } from './instrumentStore';
import { docToProject } from './project-io';
import { faultChoicesOf, scenarioList, scoreOf, useScenarioStore } from './scenarioStore';
import { useSimStore } from './simStore';

const scenarios = () => useScenarioStore.getState();
const circuit = () => useCircuitStore.getState();
const byMode = (mode: string) => {
  const scenario = scenarioList.find((candidate) => candidate.mode === mode);
  if (!scenario) throw new Error(mode);
  return scenario;
};
const ref = (componentId: string, terminalId: string): TerminalRef => ({ componentId, terminalId });

beforeEach(() => {
  scenarios().exit();
  useCircuitStore.setState({ level: 'beginner', gestureStart: undefined });
  circuit().loadProject(docToProject(EMPTY_DOC, 'min'));
  useCircuitStore.setState({ history: emptyHistory() });
  useInstrumentStore.setState({
    open: { multimeter: false, clamp: false, solar: false },
    meterFunction: 'vdc',
    probes: {},
    clampWireId: undefined,
  });
});

describe('mulai skenario', () => {
  it('Praktik Terpandu memuat preset paketnya tanpa gangguan, dan mengatur jam', () => {
    scenarios().start(byMode('guided'), { participant: 'Ani' });
    const { run } = scenarios();
    expect(run?.participant).toBe('Ani');
    expect(run?.faults).toEqual([]);
    expect(circuit().doc.components.map((part) => part.id)).toContain('scc');
    expect(circuit().doc.wires).toEqual([]);
    expect(useSimStore.getState().settings.startHour).toBe(10);
    expect(useFaultStore.getState().faults).toEqual([]);
  });

  it('langkah pertama dicentang saat multimeter membaca tegangan baterai', () => {
    scenarios().start(byMode('guided'));
    const meters = useInstrumentStore.getState();
    meters.toggle('multimeter');
    meters.attachProbe('red', ref('bat', 'pos'));
    meters.attachProbe('black', ref('bat', 'neg'));
    meters.sample(() => 0.5);
    scenarios().evaluate();
    expect(scenarios().run?.stepIndex).toBe(1);
    expect(scenarios().run?.log.some((entry) => entry.action === 'measure')).toBe(true);
  });

  it('memasang kabel tercatat di log', () => {
    scenarios().start(byMode('guided'));
    circuit().connect(ref('bat', 'pos'), ref('fuse-bat', 'in'));
    const actions = scenarios().run?.log.map((entry) => entry.action);
    expect(actions).toContain('wire-connect');
    expect(actions).not.toContain('component-add');
  });

  it('petunjuk mengurangi skor', () => {
    scenarios().start(byMode('guided'));
    scenarios().openHint();
    const run = scenarios().run;
    if (!run) throw new Error();
    expect(run.hintsUsed).toEqual({ 'ukur-baterai': 1 });
    expect(scoreOf(run).steps[0]?.hints).toBe(1);
  });
});

describe('Cari Gangguan', () => {
  const trouble = () => byMode('troubleshoot');

  it('pilihan gangguan dari skenario; acak memakai faultCount', () => {
    expect(faultChoicesOf(trouble())).toHaveLength(8);
    scenarios().start(trouble(), { random: () => 0 });
    expect(scenarios().run?.faults).toHaveLength(1);
    expect(useFaultStore.getState().faults).toEqual(scenarios().run?.faults);
  });

  it('kabel BAT SCC putus: SCC tanpa tegangan baterai, meja kerja tidak berubah', () => {
    scenarios().start(trouble(), { faults: [{ kind: 'wire-open', target: 'w4' }] });
    expect(circuit().doc.wires.map((wire) => wire.id)).toContain('w4');
    const sccVoltage = () =>
      useSimStore.getState().snapshot.terminals['scc.bat-pos']?.voltageV ?? Number.NaN;
    expect(sccVoltage()).toBeLessThan(1);

    scenarios().diagnose('fuse-blown', 'fuse-bat');
    expect(scenarios().lastDiagnosis).toBe('wrong');
    scenarios().diagnose('wire-open', 'w4');
    expect(scenarios().lastDiagnosis).toBe('right');
    expect(useFaultStore.getState().faults).toEqual([]);
    expect(sccVoltage()).toBeGreaterThan(11);
    const run = scenarios().run;
    if (!run) throw new Error();
    expect(scoreOf(run).wrongAnswerPenalty).toBe(5);
    expect(scoreOf(run).faultEarned).toBe(20);
  });

  it('fuse putus tersembunyi: tampak utuh tetapi tidak menghantar', () => {
    scenarios().start(trouble(), { faults: [{ kind: 'fuse-blown', target: 'fuse-bat' }] });
    const snapshot = useSimStore.getState().snapshot;
    expect(snapshot.components['fuse-bat']?.condition).toBe('ok');
    expect(snapshot.terminals['fuse-bat.out']?.voltageV ?? 0).toBeLessThan(1);
    expect(useSimStore.getState().state.blownFuseIds).toEqual([]);
  });

  it('mulai ulang memakai gangguan yang sama; keluar mencabut gangguan', () => {
    const faults = [{ kind: 'pv-shaded' as const, target: 'pv1' }];
    scenarios().start(trouble(), { faults });
    scenarios().openHint();
    scenarios().restart();
    expect(scenarios().run?.faults).toEqual(faults);
    expect(scenarios().run?.hintsUsed).toEqual({});
    scenarios().exit();
    expect(scenarios().run).toBeUndefined();
    expect(useFaultStore.getState().faults).toEqual([]);
  });
});

describe('selesai', () => {
  it('finish menghentikan pemeriksaan dan mencatat log', () => {
    scenarios().start(byMode('assessment'), { participant: 'Budi' });
    scenarios().finish();
    const run = scenarios().run;
    expect(run?.finishedAtMs).toBeDefined();
    expect(run?.log.at(-1)?.action).toBe('finish');
    scenarios().openHint();
    expect(scenarios().run).toBe(run);
  });
});
