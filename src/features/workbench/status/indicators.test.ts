import { describe, expect, it } from 'vitest';
import {
  LOAD_LEVELS,
  batteryKey,
  flowSpeedPxPerS,
  ledOf,
  loadLevelOf,
  sccLcdKey,
  sccLcdOf,
  workingOf,
} from './indicators';
import {
  INVERTER_COMPONENTS,
  INVERTER_WIRES,
  NIGHT,
  SCC_COMPONENTS,
  SCC_WIRES,
  SUNNY,
  catalogItem,
  place,
  solve,
  wire,
} from './status-fixtures';

const SCC = catalogItem('scc-pwm-rbl-20a');
const INVERTER = catalogItem('inv-offgrid-500w-12v');
const HALF_FULL = { socPctByBatteryId: { bat: 50 } };

describe('ledOf — SCC PWM', () => {
  it('berkedip hijau saat mengisi, hijau tetap di malam hari', () => {
    expect(ledOf('scc', SCC, solve(SCC_COMPONENTS, SCC_WIRES, SUNNY, HALF_FULL).snapshot)).toBe(
      'green-blink',
    );
    expect(ledOf('scc', SCC, solve(SCC_COMPONENTS, SCC_WIRES, NIGHT, HALF_FULL).snapshot)).toBe(
      'green',
    );
  });

  it('padam tanpa baterai; merah saat rusak', () => {
    const pvOnly = SCC_WIRES.slice(0, 2);
    expect(ledOf('scc', SCC, solve(SCC_COMPONENTS, pvOnly).snapshot)).toBe('off');
    const damaged = solve(SCC_COMPONENTS, SCC_WIRES, SUNNY, { damagedComponentIds: ['scc'] });
    expect(ledOf('scc', SCC, damaged.snapshot)).toBe('red');
  });

  it('kuning saat arus terminal beban di atas batas 10 A', () => {
    const components = [...SCC_COMPONENTS, place('load', 'load-dc-12v-200w')];
    const wires = [...SCC_WIRES, wire('scc.load-pos', 'load.a'), wire('scc.load-neg', 'load.b')];
    const { snapshot } = solve(components, wires, NIGHT);
    expect(Math.abs(snapshot.operatingPoint.sccs.scc?.loadCurrentA ?? 0)).toBeGreaterThan(10);
    expect(ledOf('scc', SCC, snapshot)).toBe('yellow');
  });

  it('komponen tanpa LED mengembalikan undefined', () => {
    const { snapshot } = solve(SCC_COMPONENTS, SCC_WIRES);
    expect(ledOf('bat', catalogItem('bat-vrla-agm-12v-100ah'), snapshot)).toBeUndefined();
  });
});

describe('ledOf — inverter off-grid', () => {
  it('hijau saat hidup, padam tanpa baterai', () => {
    expect(ledOf('inv', INVERTER, solve(INVERTER_COMPONENTS, INVERTER_WIRES).snapshot)).toBe(
      'green',
    );
    expect(ledOf('inv', INVERTER, solve(INVERTER_COMPONENTS, []).snapshot)).toBe('off');
  });

  it('kuning saat beban di atas daya nominal; merah setelah mati karena beban lebih', () => {
    // Kipas 50 W + beban 500 W pada inverter 500 W.
    const components = [...INVERTER_COMPONENTS, place('heater', 'load-ac-500w')];
    const wires = [...INVERTER_WIRES, wire('inv.ac-l', 'heater.a'), wire('inv.ac-n', 'heater.b')];
    const over = solve(components, wires);
    expect(over.snapshot.operatingPoint.inverters.inv?.acPowerW).toBeGreaterThan(500);
    expect(ledOf('inv', INVERTER, over.snapshot)).toBe('yellow');

    const off = solve(components, wires, SUNNY, {
      inverterById: { inv: { on: false, lowVoltageS: 0, offReason: 'overload' } },
    });
    expect(off.snapshot.components.inv?.condition).toBe('overload');
    expect(ledOf('inv', INVERTER, off.snapshot)).toBe('red');
  });

  it('kuning saat tegangan baterai di bawah ambang alarm', () => {
    // Ambang alarm katalog 11,0 V; LVD 10,5 V.
    const snapshot = structuredClone(solve(INVERTER_COMPONENTS, INVERTER_WIRES, NIGHT).snapshot);
    const inverter = snapshot.operatingPoint.inverters.inv;
    if (!inverter) throw new Error('inverter tidak terhitung');
    inverter.dcVoltageV = 11.2;
    expect(ledOf('inv', INVERTER, snapshot)).toBe('green');
    inverter.dcVoltageV = 10.8;
    expect(ledOf('inv', INVERTER, snapshot)).toBe('yellow');
  });
});

describe('sccLcdOf dan sccLcdKey', () => {
  it('menampilkan V dan A baterai serta PV saat mengisi', () => {
    const { snapshot } = solve(SCC_COMPONENTS, SCC_WIRES, SUNNY, HALF_FULL);
    const values = sccLcdOf('scc', snapshot);
    expect(values?.batteryVoltageV).toBeGreaterThan(12);
    expect(values?.chargeCurrentA).toBeGreaterThan(4);
    expect(values?.pvVoltageV).toBeGreaterThan(values?.batteryVoltageV ?? 0);
    expect(values?.pvCurrentA).toBeCloseTo(values?.chargeCurrentA ?? 0, 1);
    expect(sccLcdKey('scc', snapshot)).toMatch(/^\d+\.\d\|\d+\.\d\|\d+\.\d\|\d+\.\d$/);
  });

  it('padam (kosong) tanpa baterai', () => {
    const { snapshot } = solve(SCC_COMPONENTS, SCC_WIRES.slice(0, 2));
    expect(sccLcdOf('scc', snapshot)).toBeUndefined();
    expect(sccLcdKey('scc', snapshot)).toBe('');
  });
});

describe('loadLevelOf', () => {
  const FAN = catalogItem('load-ac-fan-50w');

  it('penuh saat beban mendapat tegangan nominal, nol saat tidak tersambung', () => {
    const on = solve(INVERTER_COMPONENTS, INVERTER_WIRES).snapshot;
    expect(loadLevelOf('fan', FAN, on)).toBe(LOAD_LEVELS);
    const offline = solve(INVERTER_COMPONENTS, INVERTER_WIRES.slice(0, 2)).snapshot;
    expect(loadLevelOf('fan', FAN, offline)).toBe(0);
  });

  it('komponen bukan beban selalu nol', () => {
    const { snapshot } = solve(INVERTER_COMPONENTS, INVERTER_WIRES);
    expect(loadLevelOf('inv', INVERTER, snapshot)).toBe(0);
  });
});

describe('batteryKey', () => {
  it('SoC bulat dan arah arus', () => {
    const charging = solve(SCC_COMPONENTS, SCC_WIRES, SUNNY, HALF_FULL).snapshot;
    expect(batteryKey('bat', charging)).toBe('50|charging');
    expect(batteryKey('bat', solve(INVERTER_COMPONENTS, INVERTER_WIRES).snapshot)).toBe(
      '100|discharging',
    );
    expect(batteryKey('bat', solve(INVERTER_COMPONENTS, []).snapshot)).toBe('100|idle');
    expect(batteryKey('inv', charging)).toBe('');
  });
});

describe('flowSpeedPxPerS', () => {
  it('nol tanpa arus; tanda mengikuti arah arus', () => {
    expect(flowSpeedPxPerS(0)).toBe(0);
    expect(flowSpeedPxPerS(0.004)).toBe(0);
    expect(flowSpeedPxPerS(Number.NaN)).toBe(0);
    expect(flowSpeedPxPerS(5)).toBeGreaterThan(0);
    expect(flowSpeedPxPerS(-5)).toBe(-flowSpeedPxPerS(5));
  });

  it('naik bersama arus, dijepit di 8 dan 240 px/s', () => {
    expect(flowSpeedPxPerS(20)).toBeGreaterThan(flowSpeedPxPerS(5) * 3);
    expect(flowSpeedPxPerS(0.1)).toBeCloseTo(8, 0);
    expect(flowSpeedPxPerS(500)).toBeLessThanOrEqual(240 * 1.08);
  });

  it('arus yang hampir sama memberi kecepatan yang sama (tidak tersentak)', () => {
    expect(flowSpeedPxPerS(10)).toBe(flowSpeedPxPerS(10.2));
  });
});

describe('workingOf', () => {
  const FAN = catalogItem('load-ac-fan-50w');
  const BATTERY = catalogItem('bat-vrla-agm-12v-100ah');

  it('komponen normal yang dialiri arus sedang bekerja', () => {
    const { snapshot } = solve(INVERTER_COMPONENTS, INVERTER_WIRES);
    expect(workingOf('fan', FAN, snapshot)).toBe(true);
    expect(workingOf('bat', BATTERY, snapshot)).toBe(true);
  });

  it('tanpa arus, rusak, atau komponen ber-LED: tidak bertanda bekerja', () => {
    const idle = solve(INVERTER_COMPONENTS, INVERTER_WIRES.slice(0, 2)).snapshot;
    expect(workingOf('fan', FAN, idle)).toBe(false);
    const damaged = solve(INVERTER_COMPONENTS, INVERTER_WIRES, SUNNY, {
      damagedComponentIds: ['fan'],
    }).snapshot;
    expect(workingOf('fan', FAN, damaged)).toBe(false);
    const running = solve(INVERTER_COMPONENTS, INVERTER_WIRES).snapshot;
    expect(workingOf('inv', INVERTER, running)).toBe(false);
  });
});
