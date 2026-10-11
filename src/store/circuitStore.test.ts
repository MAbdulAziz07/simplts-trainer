import { beforeEach, describe, expect, it } from 'vitest';
import { loadPreset } from '@/data';
import { catalogItems } from './catalog';
import { EMPTY_DOC } from './circuit-doc';
import { useCircuitStore } from './circuitStore';
import { emptyHistory } from './history';

const store = () => useCircuitStore.getState();
const ref = (componentId: string, terminalId: string) => ({ componentId, terminalId });

/** c1 = panel 100 Wp, c2 = SCC PWM, c3 = MCB DC 16 A. */
function placeThree(): void {
  store().addComponent('pv-generic-100wp', { xPx: 48, yPx: 48 });
  store().addComponent('scc-pwm-rbl-20a', { xPx: 240, yPx: 48 });
  store().addComponent('mcb-dc-16a', { xPx: 600, yPx: 48 });
}

beforeEach(() => {
  useCircuitStore.setState({
    packageId: 'min',
    level: 'beginner',
    doc: EMPTY_DOC,
    history: emptyHistory(),
    gestureStart: undefined,
    selectedComponentIds: [],
    selectedWireIds: [],
  });
});

describe('circuitStore — komponen', () => {
  it('menaruh komponen, memilihnya, dan menolak kabel atau id tak dikenal', () => {
    expect(store().addComponent('pv-generic-100wp', { xPx: 48, yPx: 72 })).toBe('c1');
    expect(store().selectedComponentIds).toEqual(['c1']);
    expect(store().addComponent('cable-nyy-2core', { xPx: 0, yPx: 0 })).toBeUndefined();
    expect(store().addComponent('tidak-ada', { xPx: 0, yPx: 0 })).toBeUndefined();
    expect(store().doc.components).toHaveLength(1);
  });

  it('satu seretan menjadi satu langkah undo', () => {
    placeThree();
    store().beginGesture();
    store().moveComponents([{ id: 'c1', xPx: 72, yPx: 48 }]);
    store().moveComponents([{ id: 'c1', xPx: 120, yPx: 96 }]);
    store().endGesture();
    expect(store().doc.components[0]).toMatchObject({ xPx: 120, yPx: 96 });

    store().undo();
    expect(store().doc.components[0]).toMatchObject({ xPx: 48, yPx: 48 });
    store().redo();
    expect(store().doc.components[0]).toMatchObject({ xPx: 120, yPx: 96 });
  });

  it('seretan tanpa perpindahan tidak menambah riwayat', () => {
    placeThree();
    const before = store().history.past.length;
    store().beginGesture();
    store().endGesture();
    expect(store().history.past).toHaveLength(before);
  });

  it('memutar dan menghapus yang terpilih, lalu undo mengembalikannya', () => {
    placeThree();
    store().select(['c1'], []);
    store().rotateSelected();
    expect(store().doc.components[0]!.rotationDeg).toBe(90);

    store().connect(ref('c1', 'pos'), ref('c2', 'pv-pos'));
    store().select(['c1'], []);
    store().removeSelected();
    expect(store().doc.components.map((part) => part.id)).toEqual(['c2', 'c3']);
    expect(store().doc.wires).toEqual([]);
    expect(store().selectedComponentIds).toEqual([]);

    store().undo();
    expect(store().doc.components).toHaveLength(3);
    expect(store().doc.wires).toHaveLength(1);
  });

  it('MCB bisa di-ON-kan dan di-OFF-kan', () => {
    placeThree();
    store().toggleSwitch('c3');
    expect(store().doc.closedSwitchIds).toEqual(['c3']);
    store().toggleSwitch('c3');
    expect(store().doc.closedSwitchIds).toEqual([]);
  });
});

describe('circuitStore — kabel', () => {
  it('memasang kabel dengan jenis bawaan menurut terminal asal', () => {
    placeThree();
    expect(store().connect(ref('c1', 'pos'), ref('c2', 'pv-pos'))).toEqual({ ok: true });
    expect(store().doc.wires).toEqual([
      {
        id: 'w1',
        from: ref('c1', 'pos'),
        to: ref('c2', 'pv-pos'),
        cableId: 'cable-pv-h1z2z2k',
        areaMm2: 4,
        lengthM: 1,
      },
    ]);
  });

  it('Pemula menolak polaritas terbalik, Mahir mengizinkannya', () => {
    placeThree();
    expect(store().connect(ref('c1', 'pos'), ref('c2', 'pv-neg'))).toEqual({
      ok: false,
      reason: 'polarity',
    });
    expect(store().doc.wires).toEqual([]);

    store().setLevel('expert');
    expect(store().connect(ref('c1', 'pos'), ref('c2', 'pv-neg')).ok).toBe(true);
    expect(store().doc.wires).toHaveLength(1);
  });

  it('terminal penuh ditolak di kedua tingkat', () => {
    placeThree();
    store().setLevel('expert');
    store().connect(ref('c1', 'pos'), ref('c2', 'pv-pos'));
    expect(store().connect(ref('c3', 'pos-out'), ref('c2', 'pv-pos')).reason).toBe('terminal-full');
  });

  it('mengganti jenis kabel menyesuaikan penampang ke yang tersedia', () => {
    placeThree();
    store().connect(ref('c1', 'pos'), ref('c2', 'pv-pos'));
    store().updateWire('w1', { cableId: 'cable-nyy-2core', areaMm2: 1.5, lengthM: 7.2 });
    expect(store().doc.wires[0]).toMatchObject({
      cableId: 'cable-nyy-2core',
      areaMm2: 1.5,
      lengthM: 7,
    });
    store().updateWire('w1', { cableId: 'cable-pv-h1z2z2k' });
    expect(store().doc.wires[0]).toMatchObject({ cableId: 'cable-pv-h1z2z2k', areaMm2: 2.5 });
  });
});

describe('circuitStore — proyek', () => {
  it('memuat preset mengganti meja dan paket, dan bisa dibatalkan', () => {
    placeThree();
    const preset = loadPreset('rek', catalogItems);
    store().loadProject(preset);
    expect(store().packageId).toBe('rek');
    expect(store().doc.components).toEqual(preset.components);
    expect(store().selectedComponentIds).toEqual([]);

    store().undo();
    expect(store().doc.components.map((part) => part.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('mengosongkan meja bisa dibatalkan', () => {
    placeThree();
    store().clear();
    expect(store().doc).toBe(EMPTY_DOC);
    store().undo();
    expect(store().doc.components).toHaveLength(3);
  });

  it('undo dan redo pada riwayat kosong tidak melakukan apa-apa', () => {
    store().undo();
    store().redo();
    expect(store().doc).toBe(EMPTY_DOC);
  });
});
