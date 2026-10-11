import { describe, expect, it } from 'vitest';
import { FINDING_CODES } from './types';
import { validateCircuit } from './validate';
import {
  busbar,
  CABLES,
  OFFGRID_COMPONENTS,
  OFFGRID_WIRES,
  pair,
  place,
  wire,
} from './validate-fixtures';

describe('validateCircuit', () => {
  it('rangkaian kosong: tanpa temuan', () => {
    expect(validateCircuit({ components: [], wires: [], cables: CABLES })).toEqual([]);
  });

  it('off-grid kecil yang benar: tanpa temuan', () => {
    expect(
      validateCircuit({ components: OFFGRID_COMPONENTS, wires: OFFGRID_WIRES, cables: CABLES }),
    ).toEqual([]);
  });

  it('off-grid dengan inverter, beban AC, dan pembumian: tanpa temuan', () => {
    const components = [
      ...OFFGRID_COMPONENTS,
      place('inv1', 'inverter-offgrid'),
      place('mcb2', 'mcb-ac'),
      place('lamp1', 'load-ac'),
      place('gnd1', 'grounding'),
      busbar('pe1', 'pe'),
    ];
    const wires = [
      ...OFFGRID_WIRES,
      ...pair('bat1', 'inv1', 'dc'),
      wire('inv1.ac-l', 'mcb2.l-in'),
      wire('mcb2.l-out', 'lamp1.a'),
      wire('inv1.ac-n', 'mcb2.n-in'),
      wire('mcb2.n-out', 'lamp1.b'),
      wire('inv1.pe', 'pe1.t1'),
      wire('pe1.t2', 'gnd1.pe'),
    ];
    expect(validateCircuit({ components, wires, cables: CABLES })).toEqual([]);
  });

  it('urut: bahaya, peringatan, info; lalu urutan kode', () => {
    const components = [
      place('bat1', 'battery'),
      place('inv1', 'inverter-offgrid'),
      place('pv1', 'pv-module'),
      place('scc1', 'scc-pwm'),
    ];
    const wires = [
      wire('bat1.pos', 'inv1.dc-neg'),
      wire('bat1.neg', 'inv1.dc-pos'),
      wire('pv1.pos', 'scc1.pv-pos'),
      wire('pv1.neg', 'scc1.pv-neg'),
      wire('inv1.ac-l', 'inv1.ac-n'),
    ];
    const found = validateCircuit({ components, wires, cables: CABLES });
    expect(found.map((f) => [f.severity, f.code])).toEqual([
      ['danger', 'reverse-polarity'],
      ['danger', 'short-circuit'],
      ['warning', 'pv-before-battery'],
      ['warning', 'pe-not-connected'],
    ]);
    expect(found.every((f) => FINDING_CODES.includes(f.code))).toBe(true);
  });

  it('hasil tidak bergantung pada urutan masukan', () => {
    const wires = [wire('bat1.pos', 'bat1.neg'), ...OFFGRID_WIRES.slice(0, 5)];
    const forward = validateCircuit({ components: OFFGRID_COMPONENTS, wires, cables: CABLES });
    const backward = validateCircuit({
      components: [...OFFGRID_COMPONENTS].reverse(),
      wires: [...wires].reverse(),
      cables: CABLES,
    });
    expect(forward.length).toBeGreaterThan(0);
    expect(backward).toEqual(forward);
  });
});
