import { describe, expect, it } from 'vitest';
import { busbar, CABLES, place, ref, wire } from '../circuit/validate-fixtures';
import { wireResistanceOhm } from '../engine/wire-flow';
import { buildResistiveNetwork, resistanceBetweenOhm } from './resistance';
import type { ResistiveEdge } from './resistance';

const edge = (from: string, to: string, resistanceOhm: number): ResistiveEdge => ({
  from,
  to,
  resistanceOhm,
});

describe('resistanceBetweenOhm', () => {
  it('seri dijumlah, paralel digabung', () => {
    const series = [edge('a.x', 'b.x', 10), edge('b.x', 'c.x', 5)];
    expect(resistanceBetweenOhm(series, ref('a.x'), ref('c.x'))).toBeCloseTo(15, 9);
    const parallel = [edge('a.x', 'b.x', 10), edge('a.x', 'b.x', 10)];
    expect(resistanceBetweenOhm(parallel, ref('a.x'), ref('b.x'))).toBeCloseTo(5, 9);
  });

  it('jembatan Wheatstone seimbang: lengan tengah tidak berpengaruh', () => {
    const bridge = [
      edge('a.x', 'b.x', 10),
      edge('a.x', 'c.x', 20),
      edge('b.x', 'd.x', 10),
      edge('c.x', 'd.x', 20),
      edge('b.x', 'c.x', 7),
    ];
    // (10 + 10) paralel (20 + 20) = 13,33 Ω.
    expect(resistanceBetweenOhm(bridge, ref('a.x'), ref('d.x'))).toBeCloseTo(40 / 3, 9);
  });

  it('sambungan 0 Ω melebur terminal; terminal yang sama = 0', () => {
    const edges = [edge('a.x', 'b.x', 0), edge('b.x', 'c.x', 4)];
    expect(resistanceBetweenOhm(edges, ref('a.x'), ref('b.x'))).toBe(0);
    expect(resistanceBetweenOhm(edges, ref('a.x'), ref('c.x'))).toBeCloseTo(4, 9);
    expect(resistanceBetweenOhm(edges, ref('c.x'), ref('c.x'))).toBe(0);
  });

  it('tanpa jalur penghantar = tak hingga', () => {
    const edges = [edge('a.x', 'b.x', 4), edge('c.x', 'd.x', 4)];
    expect(resistanceBetweenOhm(edges, ref('a.x'), ref('d.x'))).toBe(Infinity);
    expect(resistanceBetweenOhm([], ref('a.x'), ref('b.x'))).toBe(Infinity);
  });

  it('cabang buntu tidak mengubah hasil', () => {
    const edges = [edge('a.x', 'b.x', 3), edge('b.x', 'stub.x', 100)];
    expect(resistanceBetweenOhm(edges, ref('a.x'), ref('b.x'))).toBeCloseTo(3, 9);
  });
});

describe('buildResistiveNetwork', () => {
  const components = [
    place('bat1', 'battery'),
    place('mcb1', 'mcb-dc'),
    place('load1', 'load-dc'),
    place('load2', 'load-dc'),
    busbar('pos', 'dc+'),
    busbar('neg', 'dc-'),
  ];
  const wires = [
    wire('bat1.pos', 'mcb1.pos-in'),
    wire('bat1.neg', 'mcb1.neg-in'),
    wire('mcb1.pos-out', 'pos.t1'),
    wire('mcb1.neg-out', 'neg.t1'),
    wire('pos.t2', 'load1.a'),
    wire('neg.t2', 'load1.b'),
    wire('pos.t3', 'load2.a'),
    wire('neg.t3', 'load2.b'),
  ];
  const network = (closedSwitchIds: string[], powerSettingWByLoadId = {}) =>
    buildResistiveNetwork({
      components,
      wires,
      cables: CABLES,
      closedSwitchIds,
      powerSettingWByLoadId,
    });
  const wireOhm = wireResistanceOhm({ areaMm2: 4, lengthM: 2 }, CABLES[0], 20);

  it('beban 12 V 200 W terbaca 0,72 Ω di terminalnya; dua beban paralel lewat busbar', () => {
    // Dari rel: tiap cabang = beban + dua kabel; dua cabang paralel.
    const branchOhm = 0.72 + 2 * wireOhm;
    const edges = network([]);
    expect(resistanceBetweenOhm(edges, ref('pos.t1'), ref('neg.t1'))).toBeCloseTo(branchOhm / 2, 6);
    // Di terminal beban sendiri: 0,72 Ω paralel dengan jalur lewat beban lain.
    const otherPathOhm = branchOhm + 2 * wireOhm;
    const expectedOhm = (0.72 * otherPathOhm) / (0.72 + otherPathOhm);
    expect(resistanceBetweenOhm(edges, ref('load1.a'), ref('load1.b'))).toBeCloseTo(expectedOhm, 6);
  });

  it('MCB OFF memutus jalur; MCB ON menyambungnya', () => {
    expect(resistanceBetweenOhm(network([]), ref('bat1.pos'), ref('pos.t1'))).toBe(Infinity);
    expect(resistanceBetweenOhm(network(['mcb1']), ref('bat1.pos'), ref('pos.t1'))).toBeCloseTo(
      2 * wireOhm,
      9,
    );
  });

  it('baterai dianggap rangkaian terbuka', () => {
    const batteryOnly = buildResistiveNetwork({
      components,
      wires: wires.slice(0, 2),
      cables: CABLES,
      closedSwitchIds: ['mcb1'],
    });
    expect(resistanceBetweenOhm(batteryOnly, ref('bat1.pos'), ref('bat1.neg'))).toBe(Infinity);
  });

  it('setelan daya beban mengubah tahanannya; beban 0 W terbuka', () => {
    const half = network([], { load1: 100, load2: 0 });
    expect(resistanceBetweenOhm(half, ref('load1.a'), ref('load1.b'))).toBeCloseTo(1.44, 9);
    expect(resistanceBetweenOhm(half, ref('load2.a'), ref('load2.b'))).toBeGreaterThan(1.44);
  });

  it('satu kabel terbaca tahanan penghantarnya, diparalel jalur lewat kedua beban', () => {
    const aroundOhm = 2 * 0.72 + 3 * wireOhm;
    const expectedOhm = (wireOhm * aroundOhm) / (wireOhm + aroundOhm);
    expect(resistanceBetweenOhm(network([]), ref('pos.t2'), ref('load1.a'))).toBeCloseTo(
      expectedOhm,
      9,
    );
    // Jalur keliling jauh lebih besar, jadi bacaan hampir sama dengan tahanan kabelnya.
    expect(expectedOhm).toBeCloseTo(wireOhm, 3);
  });
});
