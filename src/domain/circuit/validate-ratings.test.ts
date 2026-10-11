import { describe, expect, it } from 'vitest';
import type { PlacedComponent, Wire } from './types';
import { findingsOf, OFFGRID_COMPONENTS, OFFGRID_WIRES, place, wire } from './validate-fixtures';
import { systemVoltageClassV } from './validate-ratings';

/** `count` modul seri `pv1…` ke port PV `device`. */
function pvString(count: number, device: string, port = 'pv') {
  const ids = Array.from({ length: count }, (_, i) => `pv${i + 1}`);
  const components = ids.map((id) => place(id, 'pv-module'));
  const wires: Wire[] = [
    wire(`${ids[0]}.neg`, `${device}.${port}-neg`),
    wire(`${ids[count - 1]}.pos`, `${device}.${port}-pos`),
    ...ids.slice(1).map((id, i) => wire(`${ids[i]}.pos`, `${id}.neg`)),
  ];
  return { components, wires };
}

/** `count` baterai 12 V seri `b1…` ke port `device`. */
function bank(count: number, device: string, port: string) {
  const ids = Array.from({ length: count }, (_, i) => `b${i + 1}`);
  const components = ids.map((id) => place(id, 'battery'));
  const wires: Wire[] = [
    wire(`${ids[0]}.neg`, `${device}.${port}-neg`),
    wire(`${ids[count - 1]}.pos`, `${device}.${port}-pos`),
    ...ids.slice(1).map((id, i) => wire(`${ids[i]}.pos`, `${id}.neg`)),
  ];
  return { components, wires };
}

function join(
  device: PlacedComponent,
  ...parts: { components: PlacedComponent[]; wires: Wire[] }[]
) {
  return {
    components: [device, ...parts.flatMap((part) => part.components)],
    wires: parts.flatMap((part) => part.wires),
  };
}

describe('pvVocOverLimit', () => {
  const pwm = place('scc1', 'scc-pwm');

  it('1 modul 100 Wp pada sistem 12 V (22,35 V ≤ 24 V): tanpa temuan', () => {
    expect(findingsOf('pv-voc-over-limit', OFFGRID_COMPONENTS, OFFGRID_WIRES)).toEqual([]);
  });

  it('2 modul seri pada sistem 12 V: bahaya, Voc dingin 44,70 V', () => {
    const { components, wires } = join(pwm, pvString(2, 'scc1'), bank(1, 'scc1', 'bat'));
    const [found] = findingsOf('pv-voc-over-limit', components, wires);
    expect(found?.severity).toBe('danger');
    expect(found?.componentIds).toEqual(['pv1', 'pv2', 'scc1']);
    expect(found?.params?.vocColdV).toBeCloseTo(44.704, 3);
    expect(found?.params).toMatchObject({ limitV: 24, minCellTempC: 20 });
  });

  it('di antara batas dan batas × faktor galat: peringatan', () => {
    const { components, wires } = join(pwm, pvString(1, 'scc1'), bank(1, 'scc1', 'bat'));
    const [found] = findingsOf('pv-voc-over-limit', components, wires, { minCellTempC: -10 });
    expect(found?.severity).toBe('warning');
    expect(found?.params?.vocColdV).toBeCloseTo(24.464, 3);
  });

  it('SCC PWM tanpa baterai atau dengan bank 24 V memakai batas 48 V', () => {
    const noBattery = join(pwm, pvString(2, 'scc1'));
    expect(findingsOf('pv-voc-over-limit', noBattery.components, noBattery.wires)).toEqual([]);
    const bank24 = join(pwm, pvString(3, 'scc1'), bank(2, 'scc1', 'bat'));
    const [found] = findingsOf('pv-voc-over-limit', bank24.components, bank24.wires);
    expect(found?.params?.limitV).toBe(48);
    expect(found?.severity).toBe('danger');
  });

  it('string paralel tidak menambah Voc', () => {
    const components = [...OFFGRID_COMPONENTS, place('pv2', 'pv-module')];
    const wires = [...OFFGRID_WIRES, wire('pv2.pos', 'pv1.pos'), wire('pv2.neg', 'pv1.neg')];
    expect(findingsOf('pv-voc-over-limit', components, wires)).toEqual([]);
  });

  it('SCC MPPT (batas 100 V, faktor 1,1) dan grid-tie (batas 60 V)', () => {
    const mppt = join(place('m1', 'scc-mppt'), pvString(5, 'm1'));
    const cold = findingsOf('pv-voc-over-limit', mppt.components, mppt.wires);
    expect(cold[0]?.severity).toBe('danger');
    const stc = findingsOf('pv-voc-over-limit', mppt.components, mppt.wires, { minCellTempC: 25 });
    expect(stc[0]?.severity).toBe('warning');
    const gridtie = join(place('gt1', 'inverter-gridtie'), pvString(3, 'gt1'));
    const [found] = findingsOf('pv-voc-over-limit', gridtie.components, gridtie.wires);
    expect(found?.severity).toBe('danger');
    expect(found?.params?.limitV).toBe(60);
  });
});

describe('systemVoltageClassV', () => {
  it('membulatkan nominal baterai ke kelipatan 12 V', () => {
    expect([12, 12.8, 25.6, 51.2].map(systemVoltageClassV)).toEqual([12, 12, 24, 48]);
  });
});

describe('systemVoltageMismatch', () => {
  it('sistem 12 V yang cocok: tanpa temuan', () => {
    expect(findingsOf('system-voltage-mismatch', OFFGRID_COMPONENTS, OFFGRID_WIRES)).toEqual([]);
  });

  it('bank 24 V ke inverter 12 V: bahaya', () => {
    const { components, wires } = join(place('inv1', 'inverter-offgrid'), bank(2, 'inv1', 'dc'));
    expect(findingsOf('system-voltage-mismatch', components, wires)).toEqual([
      {
        code: 'system-voltage-mismatch',
        severity: 'danger',
        componentIds: ['b1', 'b2', 'inv1'],
        params: { systemVoltageV: 24, ratedVoltageV: 12 },
      },
    ]);
  });

  it('bank 24 V: SCC PWM mendukung, beban DC 12 V di keluaran bebannya tidak', () => {
    const { components, wires } = join(place('scc1', 'scc-pwm'), bank(2, 'scc1', 'bat'));
    const found = findingsOf(
      'system-voltage-mismatch',
      [...components, place('load1', 'load-dc')],
      [...wires, wire('scc1.load-pos', 'load1.a'), wire('scc1.load-neg', 'load1.b')],
    );
    expect(found.map((f) => [f.severity, f.componentIds])).toEqual([
      ['danger', ['b1', 'b2', 'load1']],
    ]);
  });

  it('bank 12 V ke SCC MPPT 24 V: peringatan; beban DC langsung di baterai diperiksa', () => {
    const mppt = join(place('m1', 'scc-mppt'), bank(1, 'm1', 'bat'));
    const [low] = findingsOf('system-voltage-mismatch', mppt.components, mppt.wires);
    expect(low?.severity).toBe('warning');
    expect(low?.params).toEqual({ systemVoltageV: 12, ratedVoltageV: 24 });
    const components = [place('b1', 'battery'), place('load1', 'load-dc', { ratedVoltageV: 24 })];
    const wires = [wire('b1.pos', 'load1.a'), wire('b1.neg', 'load1.b')];
    expect(findingsOf('system-voltage-mismatch', components, wires)).toHaveLength(1);
  });
});
