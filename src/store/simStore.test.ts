import { beforeEach, describe, expect, it } from 'vitest';
import { loadPreset } from '@/data';
import type { TerminalRef } from '@/domain';
import { catalogItems } from './catalog';
import { EMPTY_DOC } from './circuit-doc';
import { useCircuitStore } from './circuitStore';
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
