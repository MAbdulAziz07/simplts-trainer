import { beforeEach, describe, expect, it } from 'vitest';
import { loadPreset } from '@/data';
import type { TerminalRef } from '@/domain';
import { catalogItems } from './catalog';
import { useChartStore } from './chartStore';
import { EMPTY_DOC } from './circuit-doc';
import { useCircuitStore } from './circuitStore';
import { useFindingsStore } from './findingsStore';
import { emptyHistory } from './history';
import { docToProject } from './project-io';
import { DEFAULT_ENV } from './sim-env';
import { INITIAL_SOC_PCT } from './sim-reconcile';
import { useSimStore } from './simStore';

const circuit = () => useCircuitStore.getState();
const sim = () => useSimStore.getState();
const ref = (componentId: string, terminalId: string): TerminalRef => ({ componentId, terminalId });

function terminalIds(componentId: string): string[] {
  return Object.keys(sim().snapshot.terminals)
    .filter((key) => key.startsWith(`${componentId}.`))
    .map((key) => key.slice(componentId.length + 1));
}

/**
 * c1 = VRLA 12 V, c2 = MCB DC 16 A (OFF), c3 dan c4 = beban DC 200 W yang diparalel lewat busbar
 * c5 (+) dan c6 (−) di belakang MCB: sekitar 2 × arus rating.
 */
function buildOverloadedCircuit(): void {
  circuit().addComponent('bat-vrla-agm-12v-100ah', { xPx: 0, yPx: 0 });
  circuit().addComponent('mcb-dc-16a', { xPx: 240, yPx: 0 });
  circuit().addComponent('load-dc-12v-200w', { xPx: 480, yPx: 0 });
  circuit().addComponent('load-dc-12v-200w', { xPx: 480, yPx: 240 });
  circuit().addComponent('busbar-dc-pos', { xPx: 360, yPx: 0 });
  circuit().addComponent('busbar-dc-neg', { xPx: 360, yPx: 240 });
  const [p1 = '', p2 = '', p3 = ''] = terminalIds('c5');
  const [n1 = '', n2 = '', n3 = ''] = terminalIds('c6');
  const links: [TerminalRef, TerminalRef][] = [
    [ref('c1', 'pos'), ref('c2', 'pos-in')],
    [ref('c1', 'neg'), ref('c2', 'neg-in')],
    [ref('c2', 'pos-out'), ref('c5', p1)],
    [ref('c2', 'neg-out'), ref('c6', n1)],
    [ref('c5', p2), ref('c3', 'a')],
    [ref('c6', n2), ref('c3', 'b')],
    [ref('c5', p3), ref('c4', 'a')],
    [ref('c6', n3), ref('c4', 'b')],
  ];
  for (const [from, to] of links) expect(circuit().connect(from, to)).toMatchObject({ ok: true });
}

beforeEach(() => {
  useCircuitStore.setState({
    packageId: 'min',
    level: 'beginner',
    history: emptyHistory(),
    gestureStart: undefined,
    selectedComponentIds: [],
    selectedWireIds: [],
  });
  circuit().loadProject(docToProject(EMPTY_DOC, 'min'));
  useCircuitStore.setState({ history: emptyHistory() });
  useSimStore.setState({ running: false, speed: 1 });
  sim().patchSettings(DEFAULT_ENV);
});

describe('simStore — rangkaian dan snapshot', () => {
  it('meja kosong: snapshot kosong, jam 10:00, matahari bersinar', () => {
    expect(sim().snapshot.components).toEqual({});
    expect(sim().clockHour).toBe(10);
    expect(sim().environment.irradianceWm2).toBeGreaterThan(500);
  });

  it('saat jeda rangkaian tetap terbaca: baterai baru pada SoC awal dan bertegangan', () => {
    circuit().addComponent('bat-vrla-agm-12v-100ah', { xPx: 0, yPx: 0 });
    expect(sim().snapshot.components.c1).toMatchObject({
      condition: 'ok',
      socPct: INITIAL_SOC_PCT,
    });
    expect(sim().snapshot.terminals['c1.pos']?.voltageV).toBeGreaterThan(12);
    expect(sim().state.timeS).toBe(0);
  });

  it('menggeser komponen tidak mengganti snapshot', () => {
    circuit().addComponent('bat-vrla-agm-12v-100ah', { xPx: 0, yPx: 0 });
    const before = sim().snapshot;
    circuit().moveComponents([{ id: 'c1', xPx: 96, yPx: 48 }]);
    expect(sim().snapshot).toBe(before);
  });

  it('memuat rangkaian lain menjeda simulasi dan mengulang waktu', () => {
    circuit().addComponent('bat-vrla-agm-12v-100ah', { xPx: 0, yPx: 0 });
    sim().setRunning(true);
    sim().advance(1);
    expect(sim().state.timeS).toBe(1);
    circuit().loadProject(loadPreset('min', catalogItems));
    expect(sim().running).toBe(false);
    expect(sim().state.timeS).toBe(0);
    expect(Object.keys(sim().snapshot.components).length).toBeGreaterThan(3);
  });
});

describe('simStore — waktu dan lingkungan', () => {
  it('advance memajukan waktu × kecepatan dan jam ikut maju', () => {
    sim().setSpeed(600);
    sim().advance(6);
    expect(sim().state.timeS).toBeCloseTo(3600, 6);
    expect(sim().clockHour).toBeCloseTo(11, 6);
  });

  it('menyetel jam ke malam memadamkan iradiasi; slider manual menimpanya', () => {
    sim().setClockHour(22);
    expect(sim().clockHour).toBeCloseTo(22, 9);
    expect(sim().environment.irradianceWm2).toBe(0);
    sim().patchSettings({ manualIrradianceWm2: 650 });
    expect(sim().environment.irradianceWm2).toBe(650);
    sim().patchSettings({ manualIrradianceWm2: undefined });
    expect(sim().environment.irradianceWm2).toBe(0);
  });
});

describe('simStore — trip dan pemulihan', () => {
  it('beban 2 × rating: MCB trip, tuas ke OFF tanpa langkah undo, reset menghidupkan lagi', () => {
    buildOverloadedCircuit();
    circuit().toggleSwitch('c2');
    expect(sim().snapshot.wires.w1?.currentA).toBeGreaterThan(25);
    expect(sim().snapshot.wires.w1?.flowA).toBeGreaterThan(25);
    const undoSteps = circuit().history.past.length;

    sim().setSpeed(60);
    for (let i = 0; i < 400 && sim().snapshot.components.c2?.condition === 'ok'; i += 1) {
      sim().advance(0.05);
    }
    expect(sim().snapshot.components.c2?.condition).toBe('tripped');
    expect(circuit().doc.closedSwitchIds).not.toContain('c2');
    expect(circuit().history.past.length).toBe(undoSteps);
    expect(sim().snapshot.wires.w1?.currentA).toBe(0);
    expect(sim().snapshot.components.c1?.socPct).toBeLessThan(INITIAL_SOC_PCT);

    sim().repairComponent('c2');
    expect(circuit().doc.closedSwitchIds).toContain('c2');
    expect(sim().snapshot.components.c2?.condition).toBe('ok');
    expect(sim().snapshot.wires.w1?.currentA).toBeGreaterThan(25);
  });
});

describe('simStore — reset percobaan', () => {
  it('mengembalikan trip, SoC, dan jam; mempertahankan rangkaian, tuas, dan setelan lingkungan', () => {
    buildOverloadedCircuit();
    circuit().toggleSwitch('c2');
    sim().patchSettings({ cloudCoverPct: 40, manualAmbientTempC: 35 });
    sim().setRunning(true);
    sim().setSpeed(60);
    for (let i = 0; i < 400 && sim().snapshot.components.c2?.condition === 'ok'; i += 1) {
      sim().advance(0.05);
    }
    expect(sim().snapshot.components.c2?.condition).toBe('tripped');
    expect(sim().state.thermalDoseBySwitchId.c2).toBeGreaterThan(0);
    expect(useChartStore.getState().bins.some(Boolean)).toBe(true);
    expect(useFindingsStore.getState().wiringLog.length).toBeGreaterThan(0);
    const { doc } = circuit();

    sim().resetExperiment();
    expect(sim().running).toBe(false);
    expect(sim().state.timeS).toBe(0);
    expect(sim().clockHour).toBe(10);
    expect(sim().snapshot.components.c1?.socPct).toBe(INITIAL_SOC_PCT);
    expect(sim().state.trippedSwitchIds).toEqual([]);
    expect(sim().state.thermalDoseBySwitchId).toEqual({});
    // Tuas MCB yang trip tetap OFF, tanpa tanda trip.
    expect(sim().snapshot.components.c2?.condition).toBe('off');
    expect(circuit().doc).toBe(doc);
    expect(sim().settings).toMatchObject({ cloudCoverPct: 40, manualAmbientTempC: 35 });
    expect(useChartStore.getState().bins.some(Boolean)).toBe(false);
    expect(useFindingsStore.getState().wiringLog).toEqual([]);
  });

  it('komponen dan kabel rusak pulih; jam yang digeser kembali ke 10:00', () => {
    circuit().addComponent('bat-vrla-agm-12v-100ah', { xPx: 0, yPx: 0 });
    circuit().addComponent('load-dc-12v-200w', { xPx: 240, yPx: 0 });
    circuit().connect(ref('c1', 'pos'), ref('c2', 'a'));
    circuit().connect(ref('c1', 'neg'), ref('c2', 'b'));
    useSimStore.setState({
      state: { ...sim().state, damagedComponentIds: ['c2'], damagedWireIds: ['w1'], timeS: 500 },
    });
    sim().setClockHour(21);
    expect(sim().snapshot.components.c2?.condition).toBe('damaged');

    sim().resetExperiment();
    expect(sim().snapshot.components.c2?.condition).toBe('ok');
    expect(sim().snapshot.wires.w1?.condition).toBe('ok');
    expect(sim().snapshot.wires.w1?.currentA).toBeGreaterThan(10);
    expect(sim().clockHour).toBe(10);
  });
});

describe('simStore — setelan daya beban', () => {
  it('menurunkan setelan menurunkan daya dan arus; 0 W memutus arus', () => {
    circuit().addComponent('bat-vrla-agm-12v-100ah', { xPx: 0, yPx: 0 });
    circuit().addComponent('load-dc-12v-200w', { xPx: 240, yPx: 0 });
    circuit().connect(ref('c1', 'pos'), ref('c2', 'a'));
    circuit().connect(ref('c1', 'neg'), ref('c2', 'b'));
    const fullW = sim().snapshot.operatingPoint.loads.c2?.powerW ?? 0;
    expect(fullW).toBeGreaterThan(180);

    circuit().setLoadPower('c2', 100);
    const halfW = sim().snapshot.operatingPoint.loads.c2?.powerW ?? 0;
    expect(halfW).toBeGreaterThan(fullW * 0.45);
    expect(halfW).toBeLessThan(fullW * 0.6);

    circuit().setLoadPower('c2', 0);
    expect(sim().snapshot.operatingPoint.loads.c2?.powerW).toBe(0);
    expect(sim().snapshot.wires.w1?.currentA).toBe(0);
  });

  it('beban 100 W di terminal beban SCC tidak lagi beban lebih', () => {
    circuit().addComponent('bat-vrla-agm-12v-100ah', { xPx: 0, yPx: 0 });
    circuit().addComponent('scc-pwm-rbl-20a', { xPx: 240, yPx: 0 });
    circuit().addComponent('load-dc-12v-200w', { xPx: 480, yPx: 0 });
    circuit().connect(ref('c2', 'bat-pos'), ref('c1', 'pos'));
    circuit().connect(ref('c2', 'bat-neg'), ref('c1', 'neg'));
    circuit().connect(ref('c2', 'load-pos'), ref('c3', 'a'));
    circuit().connect(ref('c2', 'load-neg'), ref('c3', 'b'));
    circuit().setLoadPower('c3', 100);
    sim().setSpeed(60);
    for (let i = 0; i < 40; i += 1) sim().advance(0.05);
    expect(sim().snapshot.components.c2?.condition).toBe('ok');
    expect(Math.abs(sim().snapshot.operatingPoint.sccs.c2?.loadCurrentA ?? 0)).toBeLessThan(10);

    circuit().setLoadPower('c3', 200);
    for (let i = 0; i < 40 && sim().snapshot.components.c2?.condition === 'ok'; i += 1) {
      sim().advance(0.05);
    }
    expect(sim().snapshot.components.c2?.condition).toBe('overload');
  });
});
