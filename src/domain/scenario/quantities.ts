// Besaran dan nilai acuan yang diperiksa aturan skenario, dibaca dari snapshot simulasi.
import type { PlacedComponent } from '../circuit/types';
import { batteryOcvV } from '../components/battery';
import { pvCellTempC, pvPointsAt } from '../components/pv';
import type { Snapshot } from '../engine/step-types';
import type { SolverEnvironment } from '../engine/types';
import type { ExpectedValue, ReferenceId, ScenarioQuantity } from './types';

export type QuantityValues = Record<ScenarioQuantity, number>;

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const average = (values: readonly number[]) =>
  values.length === 0 ? 0 : sum(values) / values.length;

/**
 * Besaran saat ini: SoC dan tegangan baterai dirata-rata, arus dan daya dijumlah. Arus baterai
 * positif = diisi.
 */
export function quantitiesOf(snapshot: Snapshot): QuantityValues {
  const { operatingPoint: point } = snapshot;
  const batteries = Object.values(point.batteries);
  const socs = Object.values(snapshot.components)
    .map((status) => status.socPct)
    .filter((soc): soc is number => soc !== undefined);
  return {
    'soc-pct': average(socs),
    'battery-voltage-v': average(batteries.map((reading) => reading.voltageV)),
    'battery-current-a': sum(batteries.map((reading) => reading.currentA)),
    'pv-power-w': sum(Object.values(point.pvModules).map((reading) => reading.powerW)),
    'load-power-w': sum(Object.values(point.loads).map((reading) => reading.powerW)),
    'sim-time-s': snapshot.timeS,
  };
}

/**
 * Nilai acuan: Voc dan Isc satu modul PV (modul pertama) pada iradiasi dan suhu saat ini, dan
 * OCV baterai pertama pada SoC-nya. Acuan yang tidak bisa dihitung tidak dicantumkan.
 */
export function referencesOf(
  components: readonly PlacedComponent[],
  environment: SolverEnvironment,
  snapshot: Snapshot,
): Partial<Record<ReferenceId, number>> {
  const references: Partial<Record<ReferenceId, number>> = {};
  for (const { id, item } of components) {
    if (item.category === 'pv-module' && references['module-voc'] === undefined) {
      const { irradianceWm2, ambientTempC } = environment;
      const cellTempC = pvCellTempC(ambientTempC, irradianceWm2, item.electrical.noctC);
      const points = pvPointsAt(item.electrical, irradianceWm2, cellTempC);
      references['module-voc'] = points.vocV;
      references['module-isc'] = points.iscA;
    }
    if (item.category === 'battery' && references['battery-ocv'] === undefined) {
      const socPct = snapshot.components[id]?.socPct;
      if (socPct !== undefined) references['battery-ocv'] = batteryOcvV(item.electrical, socPct);
    }
  }
  return references;
}

/** Nilai yang diharapkan; `undefined` bila acuannya tidak ada. */
export function expectedValue(
  expected: ExpectedValue,
  references: Partial<Record<ReferenceId, number>>,
): number | undefined {
  if (typeof expected === 'number') return expected;
  const base = references[expected.ref];
  return base === undefined ? undefined : base * (expected.factor ?? 1);
}

/** `true` bila `value` dalam ±`tolerancePct` persen dari `target`. */
export function withinTolerance(value: number, target: number, tolerancePct: number): boolean {
  return Math.abs(value - target) <= (Math.abs(target) * tolerancePct) / 100;
}
