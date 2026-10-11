// Skenario ujung-ke-ujung: salah pakai yang baru terlihat saat rangkaian dijalankan. Tiap skenario
// diperiksa dulu (`validateCircuit`), lalu dijalankan sampai kejadiannya muncul.
import { describe, expect, it } from 'vitest';
import type { FindingCode, PlacedComponent, Wire } from '../circuit/types';
import { place, wire } from '../circuit/validate-fixtures';
import { BATTERY_LFP_24V_100AH, PV_240W_60P } from '../components/test-fixtures';
import {
  acBreakerOnDc,
  inspect,
  INVERTER_ONLY_COMPONENTS,
  inverterOnlyWires,
  simulate,
  SMALL_COMPONENTS,
  SMALL_WIRES,
  withComponents,
  withoutWires,
} from './scenario-fixtures';
import type { SimulateOptions } from './scenario-fixtures';
import { bmsBattery, directLoadWires, fuse } from './step-fixtures';
import { SIM_EVENT_KINDS } from './step-types';
import type { ComponentCondition, SimEvent } from './step-types';

interface EventCase {
  name: string;
  event: Partial<SimEvent> & Pick<SimEvent, 'kind'>;
  /** Status komponen setelah kejadian. */
  condition?: [id: string, condition: ComponentCondition];
  /** Beban yang padam setelah kejadian. */
  deadLoadId: string;
  /** Kode temuan pemeriksaan statis untuk rangkaian ini; kosong = tidak ada temuan. */
  warnedBy: FindingCode[];
  components: PlacedComponent[];
  wires: Wire[];
  options?: SimulateOptions;
}

const LFP_24V = place('bat1', 'battery', BATTERY_LFP_24V_100AH);
const HOUR: SimulateOptions = { untilS: 3600, speed: 60 };

const CASES: EventCase[] = [
  {
    name: 'MCB DC 20 A di jalur inverter 500 W (sekitar 50 A)',
    event: { kind: 'mcb-trip', componentId: 'mcb1', cause: 'thermal' },
    condition: ['mcb1', 'tripped'],
    deadLoadId: 'lamp1',
    warnedBy: ['breaker-overcurrent'],
    components: withComponents(INVERTER_ONLY_COMPONENTS, place('mcb1', 'mcb-dc')),
    wires: [
      wire('bat1.pos', 'mcb1.pos-in'),
      wire('mcb1.pos-out', 'inv1.dc-pos'),
      wire('bat1.neg', 'mcb1.neg-in'),
      wire('mcb1.neg-out', 'inv1.dc-neg'),
      ...withoutWires(inverterOnlyWires(), 'bat1'),
    ],
  },
  {
    name: 'fuse 5 A untuk beban DC 200 W',
    event: { kind: 'fuse-blown', componentId: 'f1' },
    condition: ['f1', 'blown'],
    deadLoadId: 'load1',
    warnedBy: ['breaker-overcurrent'],
    components: [place('bat1', 'battery'), fuse('f1', 5), place('load1', 'load-dc')],
    wires: directLoadWires('f1'),
  },
  {
    name: 'beban 12 V di baterai LiFePO4 24 V ber-BMS',
    event: { kind: 'bms-cutoff', componentId: 'bat1', cause: 'over-current' },
    condition: ['bat1', 'cutoff'],
    deadLoadId: 'load1',
    warnedBy: ['system-voltage-mismatch'],
    components: [bmsBattery('bat1'), place('load1', 'load-dc')],
    wires: directLoadWires(),
  },
  {
    name: 'kabel inverter 2,5 mm² sepanjang 5 m: tegangan runtuh',
    event: { kind: 'inverter-lvd', componentId: 'inv1' },
    condition: ['inv1', 'lvd'],
    deadLoadId: 'lamp1',
    warnedBy: ['cable-overcurrent'],
    components: INVERTER_ONLY_COMPONENTS,
    wires: inverterOnlyWires(2.5, 5),
  },
  {
    name: 'baterai 24 V di inverter 12 V',
    event: { kind: 'inverter-hvd', componentId: 'inv1' },
    condition: ['inv1', 'hvd'],
    deadLoadId: 'lamp1',
    warnedBy: ['system-voltage-mismatch'],
    components: withComponents(INVERTER_ONLY_COMPONENTS, LFP_24V),
    wires: inverterOnlyWires(),
  },
  {
    name: 'beban AC 600 W di inverter 500 W',
    event: { kind: 'inverter-overload', componentId: 'inv1' },
    condition: ['inv1', 'overload'],
    deadLoadId: 'lamp1',
    warnedBy: [],
    components: withComponents(
      INVERTER_ONLY_COMPONENTS,
      place('lamp1', 'load-ac', { maxPowerW: 600 }),
    ),
    wires: inverterOnlyWires(),
  },
  {
    name: 'beban DC 160 W di terminal beban SCC 10 A',
    event: { kind: 'scc-load-overload', componentId: 'scc1' },
    condition: ['scc1', 'overload'],
    deadLoadId: 'load1',
    warnedBy: [],
    components: withComponents(SMALL_COMPONENTS, place('load1', 'load-dc', { maxPowerW: 160 })),
    wires: SMALL_WIRES,
  },
  {
    name: 'panel 60 sel (Voc 37 V) di SCC PWM sistem 12 V',
    event: { kind: 'component-damaged', componentId: 'scc1', cause: 'pv-overvoltage' },
    condition: ['scc1', 'damaged'],
    deadLoadId: 'load1',
    warnedBy: ['pv-voc-over-limit'],
    components: withComponents(SMALL_COMPONENTS, place('pv1', 'pv-module', PV_240W_60P)),
    wires: SMALL_WIRES,
  },
  {
    name: 'kabel NYY 2,5 mm² dialiri 35 A',
    event: {
      kind: 'component-damaged',
      wireId: 'bat1.neg>load1.b',
      cause: 'cable-overheat',
    },
    deadLoadId: 'load1',
    warnedBy: ['system-voltage-mismatch'],
    components: [LFP_24V, place('load1', 'load-dc')],
    wires: directLoadWires(undefined, 2.5, 'cable-nyy'),
    options: HOUR,
  },
  {
    name: 'MCB AC tanpa rating DC memutus 36 A di sirkuit DC',
    event: { kind: 'component-damaged', componentId: 'mcb1', cause: 'cannot-interrupt' },
    condition: ['mcb1', 'damaged'],
    deadLoadId: 'load1',
    warnedBy: ['system-voltage-mismatch', 'breaker-overcurrent'],
    components: [LFP_24V, acBreakerOnDc('mcb1'), place('load1', 'load-dc')],
    wires: directLoadWires('mcb1'),
    options: HOUR,
  },
];

describe('salah pakai → kejadian saat dijalankan', () => {
  it('daftar skenario mencakup semua jenis kejadian', () => {
    const kinds = new Set(CASES.map((fault) => fault.event.kind));
    expect([...kinds].sort()).toEqual([...SIM_EVENT_KINDS].sort());
  });

  it.each(CASES)('$name → $event.kind', (fault) => {
    const codes = new Set(inspect(fault.components, fault.wires).map((finding) => finding.code));
    expect([...codes]).toEqual(fault.warnedBy);

    const run = simulate(fault.components, fault.wires, fault.options);
    expect(run.events).toContainEqual(expect.objectContaining(fault.event));
    const { snapshot } = run.last;
    if (fault.condition) {
      const [id, condition] = fault.condition;
      expect(snapshot.components[id]?.condition).toBe(condition);
    }
    if (fault.event.wireId) expect(snapshot.wires[fault.event.wireId]?.condition).toBe('damaged');
    expect(snapshot.operatingPoint.loads[fault.deadLoadId]?.powerW).toBe(0);
  });

  it('rangkaian yang sama tanpa salah pakai tidak menimbulkan kejadian', () => {
    const run = simulate(INVERTER_ONLY_COMPONENTS, inverterOnlyWires());
    expect(inspect(INVERTER_ONLY_COMPONENTS, inverterOnlyWires())).toEqual([]);
    expect(run.events).toEqual([]);
    expect(run.last.snapshot.operatingPoint.loads.lamp1?.powerW).toBeGreaterThan(450);
  });

  it('arus terukur engine membuat pemeriksaan menangkap kabel yang kelebihan arus', () => {
    const components = [LFP_24V, place('load1', 'load-dc')];
    const wires = directLoadWires(undefined, 2.5, 'cable-nyy');
    const { currentAByWireId } = simulate(components, wires, { untilS: 0 }).last.snapshot
      .operatingPoint;
    const found = inspect(components, wires, { currentAByWireId });
    const overloaded = found.filter((finding) => finding.code === 'cable-overcurrent');
    expect(overloaded.map((finding) => finding.wireIds)).toEqual(wires.map((w) => [w.id]).sort());
    expect(overloaded[0]?.params).toMatchObject({ estimated: 0, ampacityA: 25 });
  });
});
