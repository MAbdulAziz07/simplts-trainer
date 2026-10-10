// Model beban resistif DC/AC yang dayanya bisa diatur (docs/MODEL_FISIKA.md §5.3, §12):
// resistansi ditetapkan dari setelan daya pada tegangan nominal, lalu P = V²/R.
import type { LoadElectrical } from '../catalog/balance';
import { clamp } from './numeric';

/** Setelan daya dibulatkan ke langkah beban dan dibatasi rentang beban. */
export function loadSnapPowerW(load: LoadElectrical, powerSettingW: number): number {
  const stepped =
    load.stepW > 0 ? Math.round(powerSettingW / load.stepW) * load.stepW : powerSettingW;
  return clamp(stepped, load.minPowerW, load.maxPowerW);
}

/** Resistansi beban untuk setelan daya pada tegangan nominal; setelan 0 = terbuka (Infinity). */
export function loadResistanceOhm(load: LoadElectrical, powerSettingW: number): number {
  const powerW = clamp(powerSettingW, load.minPowerW, load.maxPowerW);
  return powerW > 0 ? load.ratedVoltageV ** 2 / powerW : Number.POSITIVE_INFINITY;
}

/** Arus beban pada tegangan terminal sebenarnya. */
export function loadCurrentA(resistanceOhm: number, voltageV: number): number {
  return resistanceOhm > 0 ? Math.abs(voltageV) / resistanceOhm : 0;
}

/** Daya yang diserap pada tegangan terminal sebenarnya: P = V²/R. */
export function loadPowerW(resistanceOhm: number, voltageV: number): number {
  return resistanceOhm > 0 ? voltageV ** 2 / resistanceOhm : 0;
}
