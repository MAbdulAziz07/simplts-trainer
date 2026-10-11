import { describe, expect, it } from 'vitest';
import { place, wire } from '../circuit/validate-fixtures';
import { BATTERY_LFP_24V_100AH } from '../components/test-fixtures';
import { advanceMeters, advanceWiring, meterPowerW } from './advance-wiring';
import { directLoadWires, frameOf, METER_COMPONENTS, meterWires } from './step-fixtures';

const LFP_LOAD = [place('bat1', 'battery', BATTERY_LFP_24V_100AH), place('load1', 'load-dc')];
/** NYY 2,5 mm² (KHA 25 A, Tmax 70 °C) dialiri sekitar 35 A. */
const THIN_WIRES = directLoadWires(undefined, 2.5, 'cable-nyy');
const POSITIVE = 'bat1.pos>load1.a';

describe('meterPowerW', () => {
  it('jaringan → meter → beban: daya positif (impor) pada tegangan jaringan', () => {
    const { frame } = frameOf(METER_COMPONENTS, meterWires());
    const { voltageV, powerW } = meterPowerW(frame, 'm1');
    expect(voltageV).toBeCloseTo(220, 0);
    expect(powerW).toBeCloseTo(frame.point.grids.grid1?.powerW ?? 0, 0);
    expect(powerW).toBeGreaterThan(490);
  });

  it('L IN/L OUT tertukar: tanda daya terbalik', () => {
    const { frame } = frameOf(METER_COMPONENTS, meterWires(true));
    expect(meterPowerW(frame, 'm1').powerW).toBeLessThan(-490);
  });

  it('netral meter tidak tersambung: tegangan dan daya 0', () => {
    const wires = [
      wire('grid1.l', 'm1.l-in', 2.5, 'cable-nyy'),
      wire('m1.l-out', 'lamp1.a', 2.5, 'cable-nyy'),
      wire('grid1.n', 'lamp1.b', 2.5, 'cable-nyy'),
    ];
    const { frame } = frameOf(METER_COMPONENTS, wires);
    expect(frame.point.loads.lamp1?.powerW).toBeGreaterThan(490);
    expect(meterPowerW(frame, 'm1')).toEqual({ voltageV: 0, powerW: 0 });
  });

  it('meter yang tidak ada: 0', () => {
    const { frame } = frameOf(METER_COMPONENTS, meterWires());
    expect(meterPowerW(frame, 'm9')).toEqual({ voltageV: 0, powerW: 0 });
  });
});

describe('advanceMeters', () => {
  it('satu jam beban 500 W: sekitar 0,5 kWh impor', () => {
    const { frame, state } = frameOf(METER_COMPONENTS, meterWires());
    const energy = advanceMeters(frame, state, 3600).m1;
    expect(energy?.importWh).toBeCloseTo(meterPowerW(frame, 'm1').powerW, 9);
    expect(energy?.exportWh).toBe(0);
  });

  it('terpasang terbalik: tercatat sebagai ekspor', () => {
    const { frame, state } = frameOf(METER_COMPONENTS, meterWires(true));
    const energy = advanceMeters(frame, state, 3600).m1;
    expect(energy?.importWh).toBe(0);
    expect(energy?.exportWh).toBeGreaterThan(490);
  });

  it('jaringan padam (di luar jendela tegangan): tidak menghitung', () => {
    const { frame, state } = frameOf(METER_COMPONENTS, meterWires(), {
      controls: { gridAvailableById: { grid1: false } },
      state: { meterEnergyById: { m1: { importWh: 12, exportWh: 3 } } },
    });
    expect(advanceMeters(frame, state, 3600)).toEqual({ m1: { importWh: 12, exportWh: 3 } });
  });
});

describe('advanceWiring', () => {
  it('kabel di bawah KHA: suhu naik sedikit menuju suhu tunak, tanpa kejadian', () => {
    const { frame, state } = frameOf(LFP_LOAD, directLoadWires());
    const outcome = advanceWiring(frame, state, 600);
    const tempC = outcome.state.conductorTempCByWireId[POSITIVE] ?? 0;
    expect(tempC).toBeGreaterThan(20);
    expect(tempC).toBeLessThan(40);
    expect(outcome).toMatchObject({ events: [], transition: false, instant: false });
  });

  it('suhu mengikuti konstanta waktu 10 menit: 63% dari kenaikan tunak setelah 600 s', () => {
    const { frame, state } = frameOf(LFP_LOAD, THIN_WIRES);
    const after = (dtS: number) =>
      advanceWiring(frame, state, dtS).state.conductorTempCByWireId[POSITIVE] ?? 0;
    const steadyRiseC = after(1e6) - 20;
    expect(steadyRiseC).toBeGreaterThan(70);
    expect((after(600) - 20) / steadyRiseC).toBeCloseTo(1 - Math.exp(-1), 6);
  });

  it('masuk zona rusak (Tmax + 20 K): penghitung mulai dan ditandai sebagai perubahan', () => {
    const { frame, state } = frameOf(LFP_LOAD, THIN_WIRES, {
      state: { conductorTempCByWireId: { [POSITIVE]: 89.9 } },
    });
    const outcome = advanceWiring(frame, state, 5);
    expect(outcome.state.overheatSByWireId[POSITIVE]).toBe(5);
    expect(outcome.transition).toBe(true);
    expect(outcome.state.damagedWireIds).toEqual([]);
  });

  it('60 s di zona rusak: kabel rusak dengan kejadian', () => {
    const { frame, state } = frameOf(LFP_LOAD, THIN_WIRES, {
      state: {
        timeS: 500,
        conductorTempCByWireId: { [POSITIVE]: 95 },
        overheatSByWireId: { [POSITIVE]: 59 },
      },
    });
    const outcome = advanceWiring(frame, state, 1);
    expect(outcome.state.damagedWireIds).toEqual([POSITIVE]);
    expect(outcome.events).toHaveLength(1);
    expect(outcome.events[0]).toMatchObject({
      kind: 'component-damaged',
      timeS: 501,
      wireId: POSITIVE,
      cause: 'cable-overheat',
    });
    expect(outcome.events[0]?.params?.conductorTempC).toBeGreaterThan(90);
  });

  it('suhu turun dari zona rusak: penghitung kembali nol', () => {
    const { frame, state } = frameOf(LFP_LOAD, THIN_WIRES, {
      state: { closedSwitchIds: [], overheatSByWireId: { [POSITIVE]: 30 } },
      controls: { powerSettingWByLoadId: { load1: 10 } },
    });
    const outcome = advanceWiring(frame, state, 60);
    expect(outcome.state.overheatSByWireId[POSITIVE]).toBe(0);
    expect(outcome.transition).toBe(true);
  });

  it('penampang di luar tabel katalog dilewati', () => {
    const { frame, state } = frameOf(LFP_LOAD, directLoadWires(undefined, 25));
    expect(advanceWiring(frame, state, 600).state.conductorTempCByWireId).toEqual({});
  });
});
