import { describe, expect, it } from 'vitest';
import type { Wire, WiringEvent } from './types';
import {
  findingsOf,
  OFFGRID_BATTERY_WIRES,
  OFFGRID_COMPONENTS,
  OFFGRID_LOAD_WIRES,
  OFFGRID_PV_WIRES,
  OFFGRID_WIRES,
} from './validate-fixtures';

function connect(wires: readonly Wire[], closedSwitchIds: readonly string[]): WiringEvent[] {
  return wires.map((wire) => ({ action: 'connect', wire, closedSwitchIds }));
}

const LAST_PV_WIRE_ID = 'mcb1.neg-out>scc1.pv-neg';

describe('pvBeforeBattery', () => {
  it('tanpa riwayat: PV terpasang tanpa baterai adalah peringatan', () => {
    expect(findingsOf('pv-before-battery', OFFGRID_COMPONENTS, OFFGRID_PV_WIRES)).toEqual([
      { code: 'pv-before-battery', severity: 'warning', componentIds: ['scc1'] },
    ]);
  });

  it('tanpa riwayat: rangkaian lengkap, atau MCB PV masih OFF: tanpa temuan', () => {
    expect(findingsOf('pv-before-battery', OFFGRID_COMPONENTS, OFFGRID_WIRES)).toEqual([]);
    const open = { closedSwitchIds: [] };
    expect(findingsOf('pv-before-battery', OFFGRID_COMPONENTS, OFFGRID_PV_WIRES, open)).toEqual([]);
  });

  it('riwayat baterai → PV → beban: tanpa temuan', () => {
    const wiringLog = connect(
      [...OFFGRID_BATTERY_WIRES, ...OFFGRID_PV_WIRES, ...OFFGRID_LOAD_WIRES],
      [],
    );
    expect(
      findingsOf('pv-before-battery', OFFGRID_COMPONENTS, OFFGRID_WIRES, { wiringLog }),
    ).toEqual([]);
  });

  it('riwayat PV lebih dulu: tetap tercatat walau baterai kemudian dipasang', () => {
    const wiringLog = connect([...OFFGRID_PV_WIRES, ...OFFGRID_BATTERY_WIRES], ['mcb1']);
    const found = findingsOf('pv-before-battery', OFFGRID_COMPONENTS, OFFGRID_WIRES, { wiringLog });
    expect(found).toHaveLength(1);
    expect(found[0]?.wireIds).toEqual([LAST_PV_WIRE_ID]);
  });

  it('PV dirangkai lebih dulu dengan MCB PV OFF: tanpa temuan', () => {
    const wiringLog = connect([...OFFGRID_PV_WIRES, ...OFFGRID_BATTERY_WIRES], []);
    expect(
      findingsOf('pv-before-battery', OFFGRID_COMPONENTS, OFFGRID_WIRES, { wiringLog }),
    ).toEqual([]);
  });
});

describe('liveRewiring', () => {
  const check = (wiringLog: WiringEvent[]) =>
    findingsOf('live-rewiring', OFFGRID_COMPONENTS, OFFGRID_WIRES, { wiringLog });

  it('tanpa riwayat atau semua MCB OFF: tanpa temuan', () => {
    expect(findingsOf('live-rewiring', OFFGRID_COMPONENTS, OFFGRID_WIRES)).toEqual([]);
    expect(check(connect(OFFGRID_WIRES, []))).toEqual([]);
  });

  it('MCB ON tetapi belum tersambung ke sumber: tanpa temuan', () => {
    expect(check(connect(OFFGRID_BATTERY_WIRES, ['mcb1']))).toEqual([]);
  });

  it('kabel di net MCB yang ON dan bertegangan: bahaya', () => {
    const [first] = check(connect(OFFGRID_PV_WIRES, ['mcb1']));
    expect(first).toEqual({
      code: 'live-rewiring',
      severity: 'danger',
      componentIds: ['mcb1'],
      wireIds: ['mcb1.neg-out>scc1.pv-neg'],
    });
    expect(check(connect(OFFGRID_PV_WIRES, ['mcb1']))).toHaveLength(4);
  });

  it('kabel di bagian lain saat MCB ON: peringatan', () => {
    const wiringLog = [
      ...connect(OFFGRID_PV_WIRES, []),
      ...connect(OFFGRID_BATTERY_WIRES, ['mcb1']),
    ];
    expect(check(wiringLog).map((f) => [f.severity, f.wireIds])).toEqual([
      ['warning', ['bat1.neg>scc1.bat-neg']],
      ['warning', ['bat1.pos>scc1.bat-pos']],
    ]);
  });

  it('melepas kabel saat MCB ON: bahaya', () => {
    const [pvWire] = OFFGRID_PV_WIRES;
    if (!pvWire) throw new Error('fixture');
    const wiringLog: WiringEvent[] = [
      ...connect(OFFGRID_PV_WIRES, []),
      { action: 'disconnect', wire: pvWire, closedSwitchIds: ['mcb1'] },
    ];
    expect(check(wiringLog)).toEqual([
      { code: 'live-rewiring', severity: 'danger', componentIds: ['mcb1'], wireIds: [pvWire.id] },
    ]);
  });
});
