import { describe, expect, it } from 'vitest';
import { CABLES, ref, wire } from '../circuit/validate-fixtures';
import type { NetlistWire } from '../circuit/types';
import {
  buildFlowEdges,
  potentialDiffV,
  solveFlow,
  summarizeFlow,
  terminalKey,
  wireResistanceOhm,
} from './wire-flow';
import type { FlowEdge } from './wire-flow';

const [CABLE_PV] = CABLES;
const edge = (
  from: string,
  to: string,
  resistanceOhm: number,
  wireId = `${from}>${to}`,
): FlowEdge => {
  return { from, to, resistanceOhm, wireId };
};
const injections = (values: Record<string, number>) => new Map(Object.entries(values));

describe('terminalKey', () => {
  it('menggabungkan id komponen dan terminal', () => {
    expect(terminalKey(ref('bat1.pos'))).toBe('bat1.pos');
  });
});

describe('wireResistanceOhm', () => {
  it('satu penghantar 2,5 mm² 10 m pada 20 °C: setengah dari 0,140 Ω pergi-pulang (§8.3)', () => {
    expect(wireResistanceOhm({ areaMm2: 2.5, lengthM: 10 }, CABLE_PV, 20)).toBeCloseTo(0.07, 6);
  });

  it('naik bersama suhu konduktor', () => {
    const cold = wireResistanceOhm({ areaMm2: 4, lengthM: 3 }, CABLE_PV, 20);
    const hot = wireResistanceOhm({ areaMm2: 4, lengthM: 3 }, CABLE_PV, 70);
    expect(hot / cold).toBeCloseTo(1 + 0.00393 * 50, 6);
  });

  it('kabel di luar katalog memakai tembaga 0,0175', () => {
    expect(wireResistanceOhm({ areaMm2: 2.5, lengthM: 10 }, undefined, 70)).toBeCloseTo(0.07, 6);
  });

  it('penampang nol: tanpa tahanan, bukan pembagian dengan nol', () => {
    expect(wireResistanceOhm({ areaMm2: 0, lengthM: 10 }, CABLE_PV, 20)).toBe(0);
  });
});

describe('buildFlowEdges', () => {
  const wires: NetlistWire[] = [{ ...wire('bat1.pos', 'mcb1.pos-in'), netId: 'n1' }];
  const bridges = [{ from: ref('mcb1.pos-in'), to: ref('mcb1.pos-out') }];

  it('kabel bertahanan, sambungan dalam komponen 0 Ω', () => {
    const edges = buildFlowEdges(wires, bridges, CABLES, () => 20);
    expect(edges).toEqual([
      {
        from: 'bat1.pos',
        to: 'mcb1.pos-in',
        resistanceOhm: expect.closeTo(0.00875, 6),
        wireId: 'bat1.pos>mcb1.pos-in',
      },
      { from: 'mcb1.pos-in', to: 'mcb1.pos-out', resistanceOhm: 0, componentId: 'mcb1' },
    ]);
  });

  it('memakai suhu konduktor tiap kabel', () => {
    const [cold] = buildFlowEdges(wires, [], CABLES, () => 20);
    const [hot] = buildFlowEdges(wires, [], CABLES, () => 60);
    expect(hot?.resistanceOhm).toBeGreaterThan(cold?.resistanceOhm ?? 0);
  });
});

describe('solveFlow', () => {
  it('rantai: arus sama di tiap ruas, potensial turun I·R ke arah arus', () => {
    const edges = [edge('a', 'b', 0.1), edge('b', 'c', 0.2)];
    const flow = solveFlow(edges, injections({ a: 2, c: -2 }));
    expect(flow.currentA).toEqual([2, 2]);
    expect(flow.potentialV.get('a')).toBe(0);
    expect(flow.potentialV.get('b')).toBeCloseTo(-0.2, 9);
    expect(flow.potentialV.get('c')).toBeCloseTo(-0.6, 9);
    expect(flow.loopEdges).toEqual([]);
  });

  it('arah arus mengikuti from → to ruas', () => {
    const flow = solveFlow([edge('b', 'a', 0.1)], injections({ a: 3, b: -3 }));
    expect(flow.currentA).toEqual([-3]);
  });

  it('cabang: arus batang = jumlah arus cabang', () => {
    const edges = [edge('src', 'hub', 0.01), edge('hub', 'x', 0.05), edge('hub', 'y', 0.02)];
    const flow = solveFlow(edges, injections({ src: 5, x: -2, y: -3 }));
    expect(flow.currentA[0]).toBeCloseTo(5, 9);
    expect(flow.currentA[1]).toBeCloseTo(2, 9);
    expect(flow.currentA[2]).toBeCloseTo(3, 9);
    const drop = (from: string, to: string) =>
      (flow.potentialV.get(from) ?? 0) - (flow.potentialV.get(to) ?? 0);
    expect(drop('src', 'x')).toBeCloseTo(5 * 0.01 + 2 * 0.05, 9);
    expect(drop('src', 'y')).toBeCloseTo(5 * 0.01 + 3 * 0.02, 9);
  });

  it('selisih potensial tidak bergantung pada urutan ruas', () => {
    const edges = [edge('src', 'hub', 0.01), edge('hub', 'x', 0.05), edge('hub', 'y', 0.02)];
    const values = injections({ src: 5, x: -2, y: -3 });
    const forward = solveFlow(edges, values);
    const backward = solveFlow([...edges].reverse(), values);
    const drop = (flow: typeof forward) =>
      (flow.potentialV.get('x') ?? 0) - (flow.potentialV.get('y') ?? 0);
    expect(drop(backward)).toBeCloseTo(drop(forward), 9);
  });

  it('dua pulau dihitung terpisah', () => {
    const edges = [edge('a', 'b', 1), edge('p', 'q', 2)];
    const flow = solveFlow(edges, injections({ a: 1, b: -1, p: -4, q: 4 }));
    expect(flow.currentA).toEqual([1, -4]);
    expect(flow.potentialV.get('q')).toBeCloseTo(8, 9);
  });

  it('kabel ganda menutup lingkaran: dilaporkan dan tanpa arus', () => {
    const edges = [edge('a', 'b', 0.1, 'w1'), edge('a', 'b', 0.1, 'w2')];
    const flow = solveFlow(edges, injections({ a: 2, b: -2 }));
    expect(flow.loopEdges).toEqual([1]);
    expect(flow.currentA).toEqual([2, 0]);
  });

  it('suntikan tak seimbang diserap akar pulau', () => {
    const flow = solveFlow([edge('a', 'b', 0.5)], injections({ b: -2 }));
    expect(flow.currentA).toEqual([2]);
    expect(flow.potentialV.get('b')).toBeCloseTo(-1, 9);
  });

  it('tanpa suntikan: semua nol', () => {
    const flow = solveFlow([edge('a', 'b', 0.5)], new Map());
    expect(flow.currentA).toEqual([0]);
    expect([...flow.potentialV.values()]).toEqual([0, 0]);
  });
});

describe('potentialDiffV', () => {
  const flow = solveFlow([edge('x.a', 'y.b', 0.5)], injections({ 'x.a': 2, 'y.b': -2 }));

  it('selisih a − b', () => {
    expect(potentialDiffV(flow, ref('x.a'), ref('y.b'))).toBeCloseTo(1, 9);
    expect(potentialDiffV(flow, ref('y.b'), ref('x.a'))).toBeCloseTo(-1, 9);
  });

  it('tanpa hasil aliran atau terminal tanpa kabel: 0', () => {
    expect(potentialDiffV(undefined, ref('x.a'), ref('y.b'))).toBe(0);
    expect(potentialDiffV(flow, ref('z.c'), ref('z.d'))).toBe(0);
  });
});

describe('summarizeFlow', () => {
  const edges: FlowEdge[] = [
    edge('bat1.pos', 'mcb1.pos-in', 0.01, 'w1'),
    { from: 'mcb1.pos-in', to: 'mcb1.pos-out', resistanceOhm: 0, componentId: 'mcb1' },
    edge('mcb1.pos-out', 'load1.a', 0.02, 'w2'),
    { from: 'bus1.t1', to: 'bus1.t2', resistanceOhm: 0, componentId: 'bus1' },
    edge('bat1.pos', 'mcb1.pos-in', 0.01, 'w0'),
  ];
  const flow = solveFlow(edges, injections({ 'bat1.pos': 10, 'load1.a': -10 }));
  const categories = new Map([
    ['mcb1', 'mcb-dc'],
    ['bus1', 'busbar'],
  ] as const);
  const summary = summarizeFlow(edges, flow, categories);

  it('arus, jatuh tegangan, dan rugi tiap kabel', () => {
    expect(summary.currentAByWireId).toEqual({ w1: 10, w2: 10, w0: 0 });
    expect(summary.flowAByWireId).toEqual({ w1: 10, w2: 10, w0: 0 });
    expect(summary.voltageDropVByWireId.w2).toBeCloseTo(0.2, 9);
    expect(summary.wireLossW).toBeCloseTo(100 * 0.01 + 100 * 0.02, 9);
  });

  it('arus bertanda negatif bila mengalir dari `to` ke `from`', () => {
    const reversed = [edge('load1.a', 'bat1.pos', 0.01, 'w1')];
    const reverseFlow = solveFlow(reversed, injections({ 'bat1.pos': 10, 'load1.a': -10 }));
    const reverseSummary = summarizeFlow(reversed, reverseFlow, new Map());
    expect(reverseSummary.flowAByWireId).toEqual({ w1: -10 });
    expect(reverseSummary.currentAByWireId).toEqual({ w1: 10 });
  });

  it('arus MCB dilaporkan, busbar tidak; kabel ganda masuk loopWireIds', () => {
    expect(summary.currentAByComponentId).toEqual({ mcb1: 10 });
    expect(summary.loopWireIds).toEqual(['w0']);
  });
});
