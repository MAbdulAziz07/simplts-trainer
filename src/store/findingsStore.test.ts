import { beforeEach, describe, expect, it } from 'vitest';
import type { TerminalRef } from '@/domain';
import { EMPTY_DOC, addWire, type CircuitDoc } from './circuit-doc';
import { useCircuitStore } from './circuitStore';
import { useFindingsStore, wiringEventsBetween } from './findingsStore';
import { emptyHistory } from './history';
import { docToProject } from './project-io';
import { DEFAULT_ENV } from './sim-env';
import { useSimStore } from './simStore';

const circuit = () => useCircuitStore.getState();
const codes = () => useFindingsStore.getState().findings.map((finding) => finding.code);
const ref = (componentId: string, terminalId: string): TerminalRef => ({ componentId, terminalId });

beforeEach(() => {
  useCircuitStore.setState({ level: 'expert', gestureStart: undefined });
  circuit().loadProject(docToProject(EMPTY_DOC, 'min'));
  useCircuitStore.setState({ history: emptyHistory() });
  useSimStore.setState({ running: false, speed: 1 });
  useSimStore.getState().patchSettings(DEFAULT_ENV);
});

describe('wiringEventsBetween', () => {
  const wire = { from: ref('a', 'pos'), to: ref('b', 'pos'), cableId: 'x', areaMm2: 4, lengthM: 1 };
  const one: CircuitDoc = { ...addWire(EMPTY_DOC, wire).doc, closedSwitchIds: ['mcb'] };
  const two = addWire(one, { ...wire, to: ref('c', 'pos') }).doc;

  it('kabel baru = connect, kabel hilang = disconnect, dengan tuas saat itu', () => {
    expect(wiringEventsBetween(one, two)).toEqual([
      { action: 'connect', wire: two.wires[1], closedSwitchIds: ['mcb'] },
    ]);
    expect(wiringEventsBetween(two, one)).toEqual([
      { action: 'disconnect', wire: two.wires[1], closedSwitchIds: ['mcb'] },
    ]);
  });

  it('kabel yang sama tidak menghasilkan kejadian', () => {
    expect(wiringEventsBetween(one, { ...one, closedSwitchIds: [] })).toEqual([]);
  });
});

describe('findingsStore', () => {
  it('meja kosong tanpa temuan; polaritas terbalik langsung muncul dan hilang saat kabel dilepas', () => {
    expect(codes()).toEqual([]);
    circuit().addComponent('bat-vrla-agm-12v-100ah', { xPx: 0, yPx: 0 });
    circuit().addComponent('load-dc-12v-200w', { xPx: 240, yPx: 0 });
    circuit().connect(ref('c1', 'pos'), ref('c2', 'b'));
    circuit().connect(ref('c1', 'neg'), ref('c2', 'a'));
    expect(codes()).toContain('reverse-polarity');

    circuit().select([], ['w1', 'w2']);
    circuit().removeSelected();
    expect(codes()).not.toContain('reverse-polarity');
  });

  it('mencatat riwayat pemasangan: merangkai saat MCB ON menjadi temuan', () => {
    circuit().addComponent('bat-vrla-agm-12v-100ah', { xPx: 0, yPx: 0 });
    circuit().addComponent('mcb-dc-32a', { xPx: 240, yPx: 0 });
    circuit().addComponent('load-dc-12v-200w', { xPx: 480, yPx: 0 });
    circuit().connect(ref('c1', 'pos'), ref('c2', 'pos-in'));
    circuit().connect(ref('c1', 'neg'), ref('c2', 'neg-in'));
    expect(codes()).not.toContain('live-rewiring');

    circuit().toggleSwitch('c2');
    circuit().connect(ref('c2', 'pos-out'), ref('c3', 'a'));
    expect(useFindingsStore.getState().wiringLog).toHaveLength(3);
    expect(codes()).toContain('live-rewiring');
  });

  it('memuat rangkaian lain mengosongkan riwayat pemasangan', () => {
    circuit().addComponent('bat-vrla-agm-12v-100ah', { xPx: 0, yPx: 0 });
    circuit().addComponent('load-dc-12v-200w', { xPx: 240, yPx: 0 });
    circuit().connect(ref('c1', 'pos'), ref('c2', 'a'));
    expect(useFindingsStore.getState().wiringLog).toHaveLength(1);
    circuit().loadProject(docToProject(circuit().doc, 'min'));
    expect(useFindingsStore.getState().wiringLog).toEqual([]);
  });

  it('saat simulasi berjalan arus terukur dipakai: kabel 2,5 mm² dengan 46 A', () => {
    circuit().addComponent('bat-vrla-agm-12v-100ah', { xPx: 0, yPx: 0 });
    circuit().addComponent('inv-offgrid-500w-12v', { xPx: 240, yPx: 0 });
    circuit().addComponent('load-ac-500w', { xPx: 480, yPx: 0 });
    circuit().connect(ref('c1', 'pos'), ref('c2', 'dc-pos'));
    circuit().connect(ref('c1', 'neg'), ref('c2', 'dc-neg'));
    circuit().connect(ref('c2', 'ac-l'), ref('c3', 'a'));
    circuit().connect(ref('c2', 'ac-n'), ref('c3', 'b'));
    circuit().updateWire('w1', { cableId: 'cable-nyy-2core', areaMm2: 2.5 });

    useSimStore.getState().setRunning(true);
    useSimStore.getState().advance(0.05);
    useFindingsStore.getState().refresh();
    const finding = useFindingsStore
      .getState()
      .findings.find((candidate) => candidate.code === 'cable-overcurrent');
    expect(finding?.wireIds).toContain('w1');
  });

  it('hasil yang sama tidak mengganti daftar temuan', () => {
    circuit().addComponent('bat-vrla-agm-12v-100ah', { xPx: 0, yPx: 0 });
    const before = useFindingsStore.getState().findings;
    useFindingsStore.getState().refresh();
    expect(useFindingsStore.getState().findings).toBe(before);
  });
});
