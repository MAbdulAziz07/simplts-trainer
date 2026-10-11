// Terminal uji meniru katalog (src/data/catalog): panel, SCC PWM, baterai, MCB DC, busbar.
import { describe, expect, it } from 'vitest';
import type { ComponentCategory, TerminalKind } from '../types';
import { buildNetlist, findNetId } from './graph';
import type { Bridge, CircuitComponent, TerminalRef, Wire } from './types';

type TerminalSpec = [id: string, kind: TerminalKind, maxWires?: number];

function component(
  id: string,
  category: ComponentCategory,
  terminals: TerminalSpec[],
): CircuitComponent {
  return {
    id,
    item: {
      id: `catalog-${category}`,
      category,
      terminals: terminals.map(([terminalId, kind, maxWires = 1]) => {
        return { id: terminalId, label: terminalId, kind, xPct: 0, yPct: 0, maxWires };
      }),
    },
  };
}

function ref(text: string): TerminalRef {
  const [componentId = '', terminalId = ''] = text.split('.');
  return { componentId, terminalId };
}

function wire(id: string, from: string, to: string): Wire {
  return { id, from: ref(from), to: ref(to), cableId: 'cable-pv', areaMm2: 4, lengthM: 2 };
}

function bridge(from: string, to: string): Bridge {
  return { from: ref(from), to: ref(to) };
}

const pv = component('pv1', 'pv-module', [
  ['pos', 'pv+'],
  ['neg', 'pv-'],
]);
const scc = component('scc1', 'scc-pwm', [
  ['pv-pos', 'pv+'],
  ['pv-neg', 'pv-'],
  ['bat-pos', 'dc+'],
  ['bat-neg', 'dc-'],
  ['load-pos', 'dc+'],
  ['load-neg', 'dc-'],
]);
const battery = component('bat1', 'battery', [
  ['pos', 'dc+', 2],
  ['neg', 'dc-', 2],
]);
const mcb = component('mcb1', 'mcb-dc', [
  ['pos-in', 'dc+'],
  ['pos-out', 'dc+'],
  ['neg-in', 'dc-'],
  ['neg-out', 'dc-'],
]);
const busbar = component('bus1', 'busbar', [
  ['t1', 'dc+'],
  ['t2', 'dc+'],
  ['t3', 'dc+'],
]);

describe('buildNetlist', () => {
  it('rangkaian kosong: tanpa net, kabel, dan masalah', () => {
    expect(buildNetlist([], [])).toEqual({ nets: [], netIdByTerminal: {}, wires: [], issues: [] });
  });

  it('terminal tanpa kabel menjadi net berisi satu terminal', () => {
    const netlist = buildNetlist([pv], []);
    expect(netlist.nets).toEqual([
      { id: 'n1', terminals: [ref('pv1.pos')], kinds: ['pv+'] },
      { id: 'n2', terminals: [ref('pv1.neg')], kinds: ['pv-'] },
    ]);
    expect(netlist.netIdByTerminal).toEqual({ pv1: { pos: 'n1', neg: 'n2' } });
  });

  it('satu kabel menggabungkan dua terminal dan tetap tercatat dengan netId', () => {
    const netlist = buildNetlist([pv, scc], [wire('w1', 'pv1.pos', 'scc1.pv-pos')]);
    expect(netlist.nets).toHaveLength(7);
    expect(netlist.nets[0]).toEqual({
      id: 'n1',
      terminals: [ref('pv1.pos'), ref('scc1.pv-pos')],
      kinds: ['pv+'],
    });
    expect(netlist.wires).toEqual([{ ...wire('w1', 'pv1.pos', 'scc1.pv-pos'), netId: 'n1' }]);
    expect(netlist.issues).toEqual([]);
  });

  it('rantai dan cabang kabel menjadi satu net', () => {
    const netlist = buildNetlist(
      [battery, busbar, scc],
      [
        wire('w1', 'bat1.pos', 'bus1.t1'),
        wire('w2', 'bus1.t1', 'bus1.t2'),
        wire('w3', 'bus1.t2', 'scc1.bat-pos'),
        wire('w4', 'bat1.pos', 'scc1.load-pos'),
      ],
    );
    const netId = findNetId(netlist, ref('bat1.pos'));
    const net = netlist.nets.find((candidate) => candidate.id === netId);
    expect(net?.terminals).toEqual([
      ref('bat1.pos'),
      ref('bus1.t1'),
      ref('bus1.t2'),
      ref('scc1.bat-pos'),
      ref('scc1.load-pos'),
    ]);
    expect(netlist.wires.map((item) => item.netId)).toEqual([netId, netId, netId, netId]);
    expect(findNetId(netlist, ref('bus1.t3'))).not.toBe(netId);
  });

  it('dua pulau terpisah mendapat net berbeda', () => {
    const netlist = buildNetlist(
      [pv, scc, battery],
      [wire('w1', 'pv1.pos', 'scc1.pv-pos'), wire('w2', 'bat1.neg', 'scc1.bat-neg')],
    );
    const pvNet = findNetId(netlist, ref('pv1.pos'));
    const batteryNet = findNetId(netlist, ref('bat1.neg'));
    expect(pvNet).toBe(findNetId(netlist, ref('scc1.pv-pos')));
    expect(batteryNet).toBe(findNetId(netlist, ref('scc1.bat-neg')));
    expect(pvNet).not.toBe(batteryNet);
  });

  it('bridge menggabungkan terminal tanpa menambah kabel atau hitungan maxWires', () => {
    const wires = [
      wire('w1', 'bat1.pos', 'mcb1.pos-in'),
      wire('w2', 'mcb1.pos-out', 'scc1.bat-pos'),
    ];
    const open = buildNetlist([battery, mcb, scc], wires);
    expect(findNetId(open, ref('bat1.pos'))).not.toBe(findNetId(open, ref('scc1.bat-pos')));

    const closed = buildNetlist([battery, mcb, scc], wires, [
      bridge('mcb1.pos-in', 'mcb1.pos-out'),
    ]);
    expect(findNetId(closed, ref('bat1.pos'))).toBe(findNetId(closed, ref('scc1.bat-pos')));
    expect(closed.wires).toHaveLength(2);
    expect(closed.issues).toEqual([]);
  });

  it('beda polaritas dalam satu net bukan masalah; kinds mencatatnya urut TERMINAL_KINDS', () => {
    const netlist = buildNetlist(
      [battery, pv],
      [wire('w1', 'bat1.neg', 'bat1.pos'), wire('w2', 'bat1.neg', 'pv1.pos')],
    );
    expect(netlist.nets[0]?.kinds).toEqual(['pv+', 'dc+', 'dc-']);
    expect(netlist.issues).toEqual([]);
  });

  it('urutan masukan diacak memberi hasil yang sama', () => {
    const wires = [
      wire('w1', 'pv1.pos', 'scc1.pv-pos'),
      wire('w2', 'pv1.neg', 'scc1.pv-neg'),
      wire('w3', 'scc1.bat-pos', 'bat1.pos'),
      wire('w4', 'scc1.bat-neg', 'bat1.neg'),
    ];
    const ordered = buildNetlist([pv, scc, battery], wires);
    const shuffled = buildNetlist([battery, pv, scc], [...wires].reverse());
    expect(shuffled).toEqual(ordered);
  });

  it('rangkaian off-grid kecil: PV → SCC → MCB → baterai', () => {
    const netlist = buildNetlist(
      [pv, scc, mcb, battery],
      [
        wire('w1', 'pv1.pos', 'scc1.pv-pos'),
        wire('w2', 'pv1.neg', 'scc1.pv-neg'),
        wire('w3', 'scc1.bat-pos', 'mcb1.pos-in'),
        wire('w4', 'scc1.bat-neg', 'mcb1.neg-in'),
        wire('w5', 'mcb1.pos-out', 'bat1.pos'),
        wire('w6', 'mcb1.neg-out', 'bat1.neg'),
      ],
      [bridge('mcb1.pos-in', 'mcb1.pos-out'), bridge('mcb1.neg-in', 'mcb1.neg-out')],
    );
    // 14 terminal: PV+ (2), PV− (2), BAT+ (4), BAT− (4), BEBAN+ dan BEBAN− sendiri-sendiri.
    expect(netlist.nets.map((net) => net.terminals.length).sort()).toEqual([1, 1, 2, 2, 4, 4]);
    expect(netlist.nets.map((net) => net.kinds)).toEqual(
      expect.arrayContaining([['pv+'], ['pv-'], ['dc+'], ['dc-']]),
    );
    expect(netlist.issues).toEqual([]);
  });
});

describe('buildNetlist: issues', () => {
  it('komponen tak dikenal dan terminal tak dikenal: dicatat, kabel dilewati', () => {
    const netlist = buildNetlist(
      [pv],
      [wire('w1', 'pv1.pos', 'ghost.pos'), wire('w2', 'pv1.pos', 'pv1.mid')],
    );
    expect(netlist.issues).toEqual([
      { code: 'unknown-component', wireId: 'w1', terminal: ref('ghost.pos') },
      { code: 'unknown-terminal', wireId: 'w2', terminal: ref('pv1.mid') },
    ]);
    expect(netlist.wires).toEqual([]);
    expect(netlist.nets).toHaveLength(2);
  });

  it('kabel ke terminal yang sama: dicatat dan dilewati', () => {
    const netlist = buildNetlist([battery], [wire('w1', 'bat1.pos', 'bat1.pos')]);
    expect(netlist.issues).toEqual([
      { code: 'self-loop', wireId: 'w1', terminal: ref('bat1.pos') },
    ]);
    expect(netlist.wires).toEqual([]);
  });

  it('kabel ganda pada pasangan terminal yang sama: dicatat pada kabel ber-id lebih besar', () => {
    const netlist = buildNetlist(
      [battery, component('bat2', 'battery', [['pos', 'dc+', 2]])],
      [wire('w2', 'bat2.pos', 'bat1.pos'), wire('w1', 'bat1.pos', 'bat2.pos')],
    );
    expect(netlist.issues).toEqual([{ code: 'duplicate-wire', wireId: 'w2' }]);
    expect(netlist.wires.map((item) => item.id)).toEqual(['w1', 'w2']);
  });

  it('kabel melebihi maxWires: dicatat per terminal, kabel tetap tersambung', () => {
    const netlist = buildNetlist(
      [pv, scc, battery],
      [wire('w1', 'pv1.pos', 'scc1.pv-pos'), wire('w2', 'pv1.pos', 'bat1.pos')],
    );
    expect(netlist.issues).toEqual([{ code: 'too-many-wires', terminal: ref('pv1.pos') }]);
    expect(findNetId(netlist, ref('scc1.pv-pos'))).toBe(findNetId(netlist, ref('bat1.pos')));
  });

  it('id komponen ganda: yang pertama dipakai, sisanya dicatat', () => {
    const netlist = buildNetlist([pv, { ...battery, id: 'pv1' }], []);
    expect(netlist.issues).toEqual([{ code: 'duplicate-component', componentId: 'pv1' }]);
    expect(netlist.nets.map((net) => net.kinds)).toEqual([['pv+'], ['pv-']]);
  });

  it('bridge ke terminal tak dikenal: dicatat tanpa wireId', () => {
    const netlist = buildNetlist([mcb], [], [bridge('mcb1.pos-in', 'mcb1.nope')]);
    expect(netlist.issues).toEqual([{ code: 'unknown-terminal', terminal: ref('mcb1.nope') }]);
  });
});

describe('findNetId', () => {
  it('mengembalikan id net terminal, atau undefined bila tidak ada', () => {
    const netlist = buildNetlist([pv], []);
    expect(findNetId(netlist, ref('pv1.neg'))).toBe('n2');
    expect(findNetId(netlist, ref('pv1.mid'))).toBeUndefined();
    expect(findNetId(netlist, ref('ghost.pos'))).toBeUndefined();
  });
});
