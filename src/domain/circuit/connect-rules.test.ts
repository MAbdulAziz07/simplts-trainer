// Terminal uji meniru katalog (src/data/catalog): panel, baterai, SCC PWM, inverter, busbar.
import { describe, expect, it } from 'vitest';
import { TERMINAL_KINDS } from '../types';
import type { ComponentCategory, TerminalKind } from '../types';
import {
  CONDUCTOR_GROUPS,
  checkConnection,
  conductorGroup,
  type ConnectionLevel,
  type ConnectionRejection,
} from './connect-rules';
import type { CircuitComponent, TerminalRef, Wire } from './types';

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

const POLAR_PV: TerminalSpec[] = [
  ['pos', 'pv+'],
  ['neg', 'pv-'],
];
const POLAR_DC: TerminalSpec[] = [
  ['pos', 'dc+', 2],
  ['neg', 'dc-', 2],
];

const components = [
  component('pv1', 'pv-module', POLAR_PV),
  component('pv2', 'pv-module', POLAR_PV),
  component('bat1', 'battery', POLAR_DC),
  component('bat2', 'battery', POLAR_DC),
  component('scc', 'scc-pwm', [
    ['pv-pos', 'pv+'],
    ['pv-neg', 'pv-'],
    ['bat-pos', 'dc+'],
    ['bat-neg', 'dc-'],
  ]),
  component('inv', 'inverter-offgrid', [
    ['dc-pos', 'dc+'],
    ['dc-neg', 'dc-'],
    ['ac-l', 'acL'],
    ['ac-n', 'acN'],
    ['pe', 'pe'],
  ]),
  component('lfp', 'battery', [...POLAR_DC, ['bms', 'data']]),
  component('rod', 'grounding', [['pe', 'pe']]),
  component('lamp', 'load-ac', [
    ['a', 'acL'],
    ['b', 'acN'],
  ]),
];

function check(from: string, to: string, level: ConnectionLevel, wires: [string, string][] = []) {
  const placed: Pick<Wire, 'from' | 'to'>[] = wires.map(([a, b]) => ({ from: ref(a), to: ref(b) }));
  return checkConnection({ components, wires: placed, from: ref(from), to: ref(to), level });
}

describe('conductorGroup', () => {
  it('menggolongkan setiap jenis terminal', () => {
    for (const kind of TERMINAL_KINDS) expect(CONDUCTOR_GROUPS).toContain(conductorGroup(kind));
  });

  it('menyamakan kutub PV dan DC', () => {
    expect(conductorGroup('pv+')).toBe(conductorGroup('dc+'));
    expect(conductorGroup('pv-')).toBe(conductorGroup('dc-'));
    expect(conductorGroup('pv+')).not.toBe(conductorGroup('pv-'));
  });
});

describe('checkConnection — penolakan mekanis di semua tingkat', () => {
  const levels: ConnectionLevel[] = ['beginner', 'expert'];

  it.each(levels)('%s: terminal tak dikenal', (level) => {
    expect(check('pv1.pos', 'hilang.pos', level)).toEqual({
      ok: false,
      reason: 'unknown-terminal',
      terminal: ref('hilang.pos'),
    });
    expect(check('pv1.tidak-ada', 'scc.pv-pos', level).reason).toBe('unknown-terminal');
  });

  it.each(levels)('%s: kabel ke terminal yang sama', (level) => {
    expect(check('pv1.pos', 'pv1.pos', level).reason).toBe('same-terminal');
  });

  it.each(levels)('%s: kabel ganda, arah mana pun', (level) => {
    const wires: [string, string][] = [['bat1.pos', 'inv.dc-pos']];
    expect(check('bat1.pos', 'inv.dc-pos', level, wires).reason).toBe('duplicate-wire');
    expect(check('inv.dc-pos', 'bat1.pos', level, wires).reason).toBe('duplicate-wire');
  });

  it.each(levels)('%s: terminal penuh menurut maxWires', (level) => {
    const wires: [string, string][] = [['pv1.pos', 'scc.pv-pos']];
    expect(check('pv2.pos', 'scc.pv-pos', level, wires)).toEqual({
      ok: false,
      reason: 'terminal-full',
      terminal: ref('scc.pv-pos'),
    });
    // Baterai menerima dua kabel per kutub.
    expect(check('bat1.pos', 'scc.bat-pos', level, [['bat1.pos', 'inv.dc-pos']]).ok).toBe(true);
  });
});

describe('checkConnection — tingkat pemula', () => {
  it.each([
    ['pv1.pos', 'scc.pv-pos'],
    ['pv1.neg', 'scc.pv-neg'],
    ['bat1.pos', 'scc.bat-pos'],
    ['pv1.pos', 'bat1.pos'],
    ['inv.ac-l', 'lamp.a'],
    ['inv.ac-n', 'lamp.b'],
    ['inv.pe', 'rod.pe'],
  ])('menerima %s → %s', (from, to) => {
    expect(check(from, to, 'beginner')).toEqual({ ok: true });
  });

  it('menerima deret seri panel dan baterai', () => {
    expect(check('pv1.pos', 'pv2.neg', 'beginner').ok).toBe(true);
    expect(check('bat1.neg', 'bat2.pos', 'beginner').ok).toBe(true);
  });

  const rejected: [string, string, ConnectionRejection][] = [
    ['pv1.pos', 'scc.pv-neg', 'polarity'],
    ['bat1.pos', 'inv.dc-neg', 'polarity'],
    ['pv1.pos', 'pv1.neg', 'polarity'],
    ['pv1.pos', 'bat1.neg', 'polarity'],
    ['inv.ac-l', 'lamp.b', 'line-neutral'],
    ['bat1.pos', 'inv.ac-l', 'dc-ac'],
    ['pv1.neg', 'lamp.b', 'dc-ac'],
    ['inv.ac-n', 'rod.pe', 'earth'],
    ['bat1.neg', 'inv.pe', 'earth'],
    ['lfp.bms', 'bat1.pos', 'data'],
    ['lfp.bms', 'rod.pe', 'data'],
  ];
  it.each(rejected)('menolak %s → %s (%s)', (from, to, reason) => {
    expect(check(from, to, 'beginner')).toEqual({ ok: false, reason });
    expect(check(to, from, 'beginner')).toEqual({ ok: false, reason });
  });
});

describe('checkConnection — tingkat mahir', () => {
  it.each([
    ['pv1.pos', 'scc.pv-neg'],
    ['bat1.pos', 'inv.ac-l'],
    ['inv.ac-n', 'rod.pe'],
    ['lfp.bms', 'bat1.pos'],
    ['pv1.pos', 'pv1.neg'],
  ])('mengizinkan %s → %s', (from, to) => {
    expect(check(from, to, 'expert')).toEqual({ ok: true });
  });
});
