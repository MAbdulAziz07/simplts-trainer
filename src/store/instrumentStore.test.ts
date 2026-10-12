import { beforeEach, describe, expect, it } from 'vitest';
import type { MeterReading, TerminalRef } from '@/domain';
import { EMPTY_DOC } from './circuit-doc';
import { useCircuitStore } from './circuitStore';
import { emptyHistory } from './history';
import { useInstrumentStore } from './instrumentStore';
import { docToProject } from './project-io';
import { DEFAULT_ENV } from './sim-env';
import { useSimStore } from './simStore';

const circuit = () => useCircuitStore.getState();
const meters = () => useInstrumentStore.getState();
const ref = (componentId: string, terminalId: string): TerminalRef => ({ componentId, terminalId });
const MID = () => 0.5;
const valueOf = (reading: MeterReading): number =>
  reading.kind === 'value' ? reading.value : Number.NaN;

/** c1 = VRLA 12 V, c2 = MCB DC 32 A (OFF), c3 = beban DC 200 W; w1–w4. */
function buildCircuit(): void {
  circuit().addComponent('bat-vrla-agm-12v-100ah', { xPx: 0, yPx: 0 });
  circuit().addComponent('mcb-dc-32a', { xPx: 240, yPx: 0 });
  circuit().addComponent('load-dc-12v-200w', { xPx: 480, yPx: 0 });
  circuit().connect(ref('c1', 'pos'), ref('c2', 'pos-in'));
  circuit().connect(ref('c1', 'neg'), ref('c2', 'neg-in'));
  circuit().connect(ref('c2', 'pos-out'), ref('c3', 'a'));
  circuit().connect(ref('c2', 'neg-out'), ref('c3', 'b'));
  expect(circuit().doc.wires).toHaveLength(4);
}

beforeEach(() => {
  useCircuitStore.setState({ level: 'beginner', gestureStart: undefined });
  circuit().loadProject(docToProject(EMPTY_DOC, 'min'));
  useCircuitStore.setState({ history: emptyHistory() });
  useSimStore.getState().patchSettings(DEFAULT_ENV);
  useInstrumentStore.setState({
    open: { multimeter: false, clamp: false, solar: false },
    meterFunction: 'vdc',
    probes: {},
    clampMode: 'dc',
    clampWireId: undefined,
    placing: undefined,
  });
  buildCircuit();
});

describe('instrumentStore — multimeter', () => {
  it('VDC di kutub baterai; probe terbalik bertanda minus', () => {
    meters().attachProbe('red', ref('c1', 'pos'));
    meters().attachProbe('black', ref('c1', 'neg'));
    meters().sample(MID);
    const voltageV = valueOf(meters().readings.multimeter);
    expect(voltageV).toBeGreaterThan(12);
    expect(voltageV).toBeLessThan(13.5);

    meters().attachProbe('red', ref('c1', 'neg'));
    meters().attachProbe('black', ref('c1', 'pos'));
    meters().sample(MID);
    expect(valueOf(meters().readings.multimeter)).toBeCloseTo(-voltageV, 9);
  });

  it('di belakang MCB OFF tidak ada tegangan; setelah ON ada', () => {
    meters().attachProbe('red', ref('c3', 'a'));
    meters().attachProbe('black', ref('c3', 'b'));
    meters().sample(MID);
    expect(valueOf(meters().readings.multimeter)).toBe(0);
    circuit().toggleSwitch('c2');
    meters().sample(MID);
    expect(valueOf(meters().readings.multimeter)).toBeGreaterThan(12);
  });

  it('salah fungsi: VAC pada DC terbaca nol', () => {
    meters().attachProbe('red', ref('c1', 'pos'));
    meters().attachProbe('black', ref('c1', 'neg'));
    meters().setMeterFunction('vac');
    meters().sample(MID);
    expect(valueOf(meters().readings.multimeter)).toBe(0);
  });

  it('ohm: beban tanpa tegangan terbaca tahanannya; pada rangkaian bertegangan tidak', () => {
    meters().setMeterFunction('ohm');
    meters().attachProbe('red', ref('c3', 'a'));
    meters().attachProbe('black', ref('c3', 'b'));
    meters().sample(MID);
    // 12² / 200 = 0,72 Ω ditambah kabel probe 0,2 Ω.
    expect(valueOf(meters().readings.multimeter)).toBeCloseTo(0.92, 2);

    circuit().toggleSwitch('c2');
    meters().sample(() => 0);
    expect(meters().readings.multimeter).toEqual({ kind: 'overload' });
  });

  it('ohm: probe lepas atau jalur terbuka = OL', () => {
    meters().setMeterFunction('ohm');
    meters().sample(MID);
    expect(meters().readings.multimeter).toEqual({ kind: 'overload' });
    meters().attachProbe('red', ref('c1', 'pos'));
    meters().attachProbe('black', ref('c3', 'a'));
    meters().sample(MID);
    expect(meters().readings.multimeter).toEqual({ kind: 'overload' });
  });

  it('probe terlepas saat komponennya dihapus; menutup alat melepas probe', () => {
    meters().toggle('multimeter');
    meters().attachProbe('red', ref('c3', 'a'));
    meters().attachProbe('black', ref('c1', 'neg'));
    circuit().select(['c3'], []);
    circuit().removeSelected();
    meters().sample(MID);
    expect(meters().probes).toEqual({ red: undefined, black: ref('c1', 'neg') });
    meters().toggle('multimeter');
    expect(meters().probes).toEqual({});
  });
});

describe('instrumentStore — tang ampere dan solar power meter', () => {
  it('mode DC menampilkan arus bertanda; mode AC pada kabel DC terbaca nol', () => {
    circuit().toggleSwitch('c2');
    // w1 = c1.pos → c2.pos-in: arus keluar dari kutub positif, searah kabel.
    meters().attachClamp('w1');
    meters().sample(MID);
    const currentA = valueOf(meters().readings.clamp);
    expect(currentA).toBeGreaterThan(14);
    expect(currentA).toBeLessThan(19);
    // w2 = c1.neg → c2.neg-in: arus kembali ke kutub negatif, melawan arah kabel.
    meters().attachClamp('w2');
    meters().sample(MID);
    expect(valueOf(meters().readings.clamp)).toBeCloseTo(-currentA, 6);

    meters().setClampMode('ac');
    meters().sample(MID);
    expect(valueOf(meters().readings.clamp)).toBe(0);
  });

  it('tanpa kabel terbaca nol; jepitan lepas saat kabelnya dihapus', () => {
    meters().sample(MID);
    expect(valueOf(meters().readings.clamp)).toBe(0);
    meters().attachClamp('w1');
    circuit().select([], ['w1']);
    circuit().removeSelected();
    meters().sample(MID);
    expect(meters().clampWireId).toBeUndefined();
  });

  it('solar power meter mengikuti iradiasi lingkungan', () => {
    useSimStore.getState().patchSettings({ manualIrradianceWm2: 640 });
    meters().sample(MID);
    expect(meters().readings.solarWm2).toBe(640);
    meters().sample(() => 1);
    expect(meters().readings.solarWm2).toBeCloseTo(640 * 1.005, 9);
  });
});
