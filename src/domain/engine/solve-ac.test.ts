import { describe, expect, it } from 'vitest';
import { recognizeSubsystems } from '../circuit/subsystems';
import type { PlacedComponent, TerminalRef, Wire } from '../circuit/types';
import { place, wire } from '../circuit/validate-fixtures';
import { INVERTER_COMPONENTS, inverterWires } from './engine-fixtures';
import { itemLookup } from './prepare-dc';
import { injectAcBus, solveAcBus } from './solve-ac';
import type { OffsetFn } from './solve-dc';
import { terminalKey } from './wire-flow';

const NO_OFFSET: OffsetFn = () => 0;
/** Beban AC 500 W pada 220 V. */
const LOAD_OHM = 96.8;

function acRound(
  components: readonly PlacedComponent[],
  wires: readonly Wire[],
  isLive = true,
  offsetV = NO_OFFSET,
) {
  const topology = recognizeSubsystems(components, wires);
  const [bus] = topology.acBuses;
  if (!bus) throw new Error('rangkaian uji tanpa bus AC');
  const itemOf = itemLookup(topology.components);
  return solveAcBus(
    bus,
    itemOf,
    () => isLive,
    () => LOAD_OHM,
    offsetV,
  );
}

describe('solveAcBus', () => {
  it('inverter hidup: 220 V, arus beban V/R', () => {
    const round = acRound(INVERTER_COMPONENTS, inverterWires());
    expect(round).toMatchObject({ status: 'ok', voltageV: 220, source: { id: 'inv1' } });
    expect(round.currentAByLoadId.get('lamp1')).toBeCloseTo(220 / LOAD_OHM, 9);
    expect(round.totalCurrentA).toBeCloseTo(220 / LOAD_OHM, 9);
  });

  it('jatuh tegangan kabel menurunkan arus beban', () => {
    const offsetV: OffsetFn = (a) => (a.terminalId === 'a' ? -2.2 : 0);
    const round = acRound(INVERTER_COMPONENTS, inverterWires(), true, offsetV);
    expect(round.currentAByLoadId.get('lamp1')).toBeCloseTo(217.8 / LOAD_OHM, 9);
  });

  it('sumber mati: 0 V dan tanpa arus', () => {
    const round = acRound(INVERTER_COMPONENTS, inverterWires(), false);
    expect(round).toMatchObject({ status: 'dead', voltageV: 0, totalCurrentA: 0 });
    expect(round.currentAByLoadId.size).toBe(0);
  });

  it('jaringan PLN sebagai sumber', () => {
    const components = [
      place('grid1', 'grid', { nominalVoltageV: 220 }),
      place('lamp1', 'load-ac'),
    ];
    const wires = [wire('grid1.l', 'lamp1.a'), wire('grid1.n', 'lamp1.b')];
    expect(acRound(components, wires)).toMatchObject({
      status: 'ok',
      voltageV: 220,
      source: { id: 'grid1', category: 'grid' },
    });
  });

  it('dua sumber di satu bus: tidak didukung', () => {
    const components = [...INVERTER_COMPONENTS, place('grid1', 'grid', { nominalVoltageV: 220 })];
    const wires = [...inverterWires(), wire('grid1.l', 'inv1.ac-l'), wire('grid1.n', 'inv1.ac-n')];
    const round = acRound(components, wires);
    expect(round).toMatchObject({ status: 'unsupported', voltageV: 0, totalCurrentA: 0 });
    expect(round.source).toBeUndefined();
  });

  it('inverter grid-tie: tidak didukung', () => {
    const components = [place('gti1', 'inverter-gridtie'), place('lamp1', 'load-ac')];
    const wires = [wire('gti1.ac-l', 'lamp1.a'), wire('gti1.ac-n', 'lamp1.b')];
    expect(acRound(components, wires).status).toBe('unsupported');
  });
});

describe('injectAcBus', () => {
  it('sumber mendorong arus di fasa, beban menariknya; netral sebaliknya', () => {
    const injected = new Map<string, number>();
    const inject = (terminal: TerminalRef, currentA: number) => {
      injected.set(terminalKey(terminal), currentA);
    };
    const round = acRound(INVERTER_COMPONENTS, inverterWires());
    injectAcBus(round, inject);
    const currentA = 220 / LOAD_OHM;
    expect(injected.get('inv1.ac-l')).toBeCloseTo(currentA, 9);
    expect(injected.get('inv1.ac-n')).toBeCloseTo(-currentA, 9);
    expect(injected.get('lamp1.a')).toBeCloseTo(-currentA, 9);
    expect(injected.get('lamp1.b')).toBeCloseTo(currentA, 9);
  });

  it('bus tak didukung: tanpa suntikan', () => {
    const injected: TerminalRef[] = [];
    const components = [place('gti1', 'inverter-gridtie'), place('lamp1', 'load-ac')];
    const wires = [wire('gti1.ac-l', 'lamp1.a'), wire('gti1.ac-n', 'lamp1.b')];
    injectAcBus(acRound(components, wires), (terminal) => injected.push(terminal));
    expect(injected).toEqual([]);
  });
});
