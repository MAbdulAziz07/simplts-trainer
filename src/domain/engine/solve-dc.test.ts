import { describe, expect, it } from 'vitest';
import { recognizeSubsystems } from '../circuit/subsystems';
import type { PlacedComponent, TerminalRef, Wire } from '../circuit/types';
import {
  CABLES,
  OFFGRID_COMPONENTS,
  OFFGRID_WIRES,
  place,
  ref,
  wire,
} from '../circuit/validate-fixtures';
import { batteryConstantPowerPoint } from '../components/battery';
import { pwmChargePoint } from '../components/scc';
import { BATTERY_VRLA_100AH, within } from '../components/test-fixtures';
import { PWM_RBL_20A } from '../components/test-fixtures-bos';
import { CHARGE_COMPONENTS, chargeWires, NIGHT, NOON } from './engine-fixtures';
import { itemLookup, prepareDcBus } from './prepare-dc';
import {
  bankPort,
  chainOffsetV,
  consumerPathOhm,
  injectDcBus,
  portOffsetV,
  solveDcBus,
} from './solve-dc';
import type { OffsetFn, Sink } from './solve-dc';
import type { SolverState } from './types';
import { buildFlowEdges, terminalKey } from './wire-flow';

const NO_OFFSET: OffsetFn = () => 0;
/** Potensial tetap per terminal, untuk menguji rumus selisih. */
const offsetFrom = (potentialV: Record<string, number>): OffsetFn => {
  return (a, b) => (potentialV[terminalKey(a)] ?? 0) - (potentialV[terminalKey(b)] ?? 0);
};

function setup(
  components: readonly PlacedComponent[],
  wires: readonly Wire[],
  state: SolverState = {},
  environment = NOON,
) {
  const topology = recognizeSubsystems(components, wires);
  const [bus] = topology.dcBuses;
  if (!bus) throw new Error('rangkaian uji tanpa bus baterai');
  const prepared = prepareDcBus(bus, topology, itemLookup(topology.components), environment, state);
  if (!prepared.bank) throw new Error('bus uji tidak didukung');
  const edges = buildFlowEdges(topology.netlist.wires, topology.bridges, CABLES, () => 20);
  return { prepared: { ...prepared, bank: prepared.bank }, edges };
}

describe('portOffsetV', () => {
  it('selisih kutub positif dikurangi selisih kutub negatif', () => {
    const offsetV = offsetFrom({ 'load1.a': -0.2, 'load1.b': 0.3 });
    const port = { pos: ref('load1.a'), neg: ref('load1.b') };
    const reference = { pos: ref('bat1.pos'), neg: ref('bat1.neg') };
    expect(portOffsetV(port, reference, offsetV)).toBeCloseTo(-0.5, 9);
  });
});

describe('chainOffsetV', () => {
  const reference = { pos: ref('scc1.pv-pos'), neg: ref('scc1.pv-neg') };

  it('ujung string ditambah kabel antarmodul', () => {
    const offsetV = offsetFrom({ 'pvB.pos': 0.1, 'pvA.neg': -0.1, 'pvA.pos': 0.05 });
    expect(chainOffsetV(['pvA', 'pvB'], reference, offsetV)).toBeCloseTo(0.25, 9);
  });

  it('string kosong: 0', () => {
    expect(chainOffsetV([], reference, offsetFrom({}))).toBe(0);
  });
});

describe('bankPort', () => {
  it('kutub negatif baterai pertama dan positif baterai terakhir string pertama', () => {
    const bus = {
      id: 'dc1',
      posNetId: 'n1',
      negNetId: 'n2',
      battery: { strings: [['batA', 'batB']], irregular: false },
    };
    expect(bankPort(bus)).toEqual({ pos: ref('batB.pos'), neg: ref('batA.neg') });
  });
});

describe('consumerPathOhm', () => {
  it('beban langsung di baterai: tahanan dua kabel 2 m 4 mm²', () => {
    const components = [place('bat1', 'battery'), place('load1', 'load-dc')];
    const wires = [wire('bat1.pos', 'load1.a'), wire('bat1.neg', 'load1.b')];
    const { prepared, edges } = setup(components, wires);
    expect(consumerPathOhm(prepared, edges).get('load1')).toBeCloseTo((0.0175 * 4) / 4, 9);
  });

  it('beban di terminal beban SCC: kabel baterai–SCC ditambah kabel SCC–beban', () => {
    const { prepared, edges } = setup(OFFGRID_COMPONENTS, OFFGRID_WIRES);
    expect(consumerPathOhm(prepared, edges).get('load1')).toBeCloseTo((0.0175 * 8) / 4, 9);
  });
});

describe('solveDcBus', () => {
  it('arus isi = pwmChargePoint pada tegangan baterai di SCC (§2.2)', () => {
    const state = { socPctByBatteryId: { bat1: 50 } };
    const { prepared } = setup(CHARGE_COMPONENTS, chargeWires(), state);
    const round = solveDcBus(prepared, new Map(), NO_OFFSET);
    const [scc] = prepared.sccs;
    const expected = pwmChargePoint(PWM_RBL_20A, scc?.strings ?? [], round.solution.voltageV);
    expect(round.sccs[0]?.chargeCurrentA).toBeCloseTo(expected.chargeCurrentA, 6);
    expect(round.sccs[0]?.stringCurrentsA).toHaveLength(1);
    // Yang masuk baterai = arus isi dikurangi konsumsi SCC sendiri (10 mA).
    expect(-round.solution.batteryCurrentA).toBeCloseTo(expected.chargeCurrentA - 0.01, 6);
  });

  it('malam: SCC tidak mengisi, baterai hanya menanggung konsumsi SCC', () => {
    const { prepared } = setup(CHARGE_COMPONENTS, chargeWires(), {}, NIGHT);
    const round = solveDcBus(prepared, new Map(), NO_OFFSET);
    expect(round.sccs[0]?.chargeCurrentA).toBe(0);
    expect(round.solution.batteryCurrentA).toBeCloseTo(0.01, 6);
  });

  it('daya konstan 568,2 W lewat kabel 1,4 mΩ: 47,9 A dan 11,86 V (§4.7)', () => {
    const components = [place('bat1', 'battery'), place('inv1', 'inverter-offgrid')];
    const wires = [wire('bat1.pos', 'inv1.dc-pos'), wire('bat1.neg', 'inv1.dc-neg')];
    const { prepared } = setup(components, wires, { socPctByBatteryId: { bat1: 50 } });
    const sinks = new Map<string, Sink>([['inv1', { kind: 'power', powerW: 568.2 }]]);
    const round = solveDcBus(prepared, sinks, NO_OFFSET, new Map([['inv1', 0.0014]]));
    const currentA = round.currentAByConsumerId.get('inv1') ?? 0;
    expect(within(currentA, 47.9)).toBe(true);
    expect(within(round.solution.voltageV - currentA * 0.0014, 11.86)).toBe(true);
    const closedForm = batteryConstantPowerPoint(BATTERY_VRLA_100AH, 50, 568.2, 0.0014);
    expect(currentA).toBeCloseTo(closedForm?.currentA ?? 0, 4);
  });

  it('putaran berikutnya tidak menghitung jatuh tegangan sendiri dua kali', () => {
    const components = [place('bat1', 'battery'), place('load1', 'load-dc')];
    const wires = [wire('bat1.pos', 'load1.a'), wire('bat1.neg', 'load1.b')];
    const { prepared } = setup(components, wires, { socPctByBatteryId: { bat1: 80 } });
    const sinks = new Map<string, Sink>([['load1', { kind: 'resistive', resistanceOhm: 0.72 }]]);
    const pathOhm = new Map([['load1', 0.0175]]);
    const first = solveDcBus(prepared, sinks, NO_OFFSET, pathOhm);
    const firstA = first.currentAByConsumerId.get('load1') ?? 0;
    // Jatuh tegangan kabel dari putaran pertama: −I·R di terminal beban.
    const offsetV = offsetFrom({ 'load1.a': -firstA * 0.0175 });
    const second = solveDcBus(prepared, sinks, offsetV, pathOhm, first);
    expect(second.currentAByConsumerId.get('load1')).toBeCloseTo(firstA, 9);
  });

  it('daya tidak tersedia: runtuh, semua arus nol', () => {
    const components = [place('bat1', 'battery'), place('inv1', 'inverter-offgrid')];
    const wires = [wire('bat1.pos', 'inv1.dc-pos'), wire('bat1.neg', 'inv1.dc-neg')];
    const { prepared } = setup(components, wires, { socPctByBatteryId: { bat1: 50 } });
    const sinks = new Map<string, Sink>([['inv1', { kind: 'power', powerW: 568.2 }]]);
    const round = solveDcBus(prepared, sinks, NO_OFFSET, new Map([['inv1', 0.08]]));
    expect(round.solution.collapsed).toBe(true);
    expect(round.currentAByConsumerId.get('inv1')).toBe(0);
  });
});

describe('injectDcBus', () => {
  it('tiap alat menyuntik dan menarik arus yang sama; jumlah seluruhnya nol', () => {
    const state = { socPctByBatteryId: { bat1: 60 } };
    const { prepared } = setup(OFFGRID_COMPONENTS, OFFGRID_WIRES, state);
    const sinks = new Map<string, Sink>([['load1', { kind: 'resistive', resistanceOhm: 0.72 }]]);
    const round = solveDcBus(prepared, sinks, NO_OFFSET);
    const injected = new Map<string, number>();
    injectDcBus(prepared, round, (terminal: TerminalRef, currentA) => {
      const key = terminalKey(terminal);
      injected.set(key, (injected.get(key) ?? 0) + currentA);
    });
    const loadA = round.currentAByConsumerId.get('load1') ?? 0;
    const chargeA = round.sccs[0]?.chargeCurrentA ?? 0;
    expect(injected.get('load1.a')).toBeCloseTo(-loadA, 9);
    expect(injected.get('load1.b')).toBeCloseTo(loadA, 9);
    expect(injected.get('scc1.load-pos')).toBeCloseTo(loadA, 9);
    expect(injected.get('pv1.pos')).toBeCloseTo(chargeA, 9);
    expect(injected.get('scc1.pv-pos')).toBeCloseTo(-chargeA, 9);
    expect(injected.get('scc1.bat-pos')).toBeCloseTo(chargeA - 0.01 - loadA, 9);
    expect(injected.get('bat1.pos')).toBeCloseTo(round.solution.batteryCurrentA, 9);
    // Net baterai seimbang: arus baterai + arus terminal baterai SCC = 0.
    expect((injected.get('bat1.pos') ?? 0) + (injected.get('scc1.bat-pos') ?? 0)).toBeCloseTo(0, 9);
    const total = [...injected.values()].reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo(0, 9);
  });
});
