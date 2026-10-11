// Aturan rating tegangan: Voc array dingin dan tegangan sistem. Aturan arus: validate-current.ts.
import { pvStringVocColdV } from '../components/pv';
import type { CatalogItem } from '../types';
import type { Finding } from './types';
import { finding, netOf, ofCategory, seriesPath, sourceEdges } from './validate-context';
import type { SeriesEdge, SeriesSum, ValidationContext } from './validate-context';

/** Kelas tegangan sistem per 12 V: 12,8 → 12; 25,6 → 24; 51,2 → 48. */
const SYSTEM_VOLTAGE_STEP_V = 12;

export function systemVoltageClassV(nominalVoltageV: number): number {
  return Math.round(nominalVoltageV / SYSTEM_VOLTAGE_STEP_V) * SYSTEM_VOLTAGE_STEP_V;
}

function batteryEdges(ctx: ValidationContext): SeriesEdge[] {
  return sourceEdges(ctx, ctx.design, 'battery', (item) =>
    systemVoltageClassV(item.electrical.nominalVoltageV),
  );
}

function bankAt(
  ctx: ValidationContext,
  edges: readonly SeriesEdge[],
  componentId: string,
  port: string,
): SeriesSum | undefined {
  const [pos, neg] = port === '' ? ['a', 'b'] : [`${port}-pos`, `${port}-neg`];
  return seriesPath(
    edges,
    netOf(ctx.design, componentId, neg),
    netOf(ctx.design, componentId, pos),
  );
}

/** Batas Voc masukan PV dan faktor batas rusak; SCC PWM bergantung pada tegangan baterai. */
function vocLimit(item: CatalogItem, bankVoltageV: number | undefined) {
  switch (item.category) {
    case 'scc-pwm': {
      const { pvVocMax12VV, pvVocMax24VV } = item.electrical;
      const limitV = bankVoltageV !== undefined && bankVoltageV <= 12 ? pvVocMax12VV : pvVocMax24VV;
      return { limitV, faultFactor: item.protection.vocFaultFactor };
    }
    case 'scc-mppt':
      return { limitV: item.protection.vocMaxV, faultFactor: item.protection.vocFaultFactor };
    case 'inverter-gridtie':
      return { limitV: item.protection.dcVocMaxV, faultFactor: 1 };
    case 'inverter-hybrid':
      return { limitV: item.electrical.pvVocMaxV, faultFactor: 1 };
    default:
      return undefined;
  }
}

/** Voc array pada suhu sel terendah melebihi batas masukan PV. */
export function pvVocOverLimit(ctx: ValidationContext): Finding[] {
  const pvEdges = sourceEdges(ctx, ctx.design, 'pv-module', (item) =>
    pvStringVocColdV(item.electrical, 1, ctx.minCellTempC),
  );
  const batteries = batteryEdges(ctx);
  const findings: Finding[] = [];
  const devices = ofCategory(ctx, 'scc-pwm', 'scc-mppt', 'inverter-gridtie', 'inverter-hybrid');
  for (const { id, item } of devices) {
    const limit = vocLimit(item, bankAt(ctx, batteries, id, 'bat')?.sum);
    const ports = item.terminals.filter((t) => t.kind === 'pv+').map((t) => t.id.slice(0, -4));
    for (const port of ports) {
      const array = bankAt(ctx, pvEdges, id, port);
      if (!limit || !array || array.sum <= limit.limitV) continue;
      const severity = array.sum > limit.limitV * limit.faultFactor ? 'danger' : 'warning';
      findings.push(
        finding('pv-voc-over-limit', severity, [id, ...array.ids], {
          params: { vocColdV: array.sum, limitV: limit.limitV, minCellTempC: ctx.minCellTempC },
        }),
      );
    }
  }
  return findings;
}

function supportedVoltagesV(item: CatalogItem): number[] {
  switch (item.category) {
    case 'scc-pwm':
      return item.electrical.batteryVoltagesV;
    case 'scc-mppt':
      return [item.electrical.batteryNominalV];
    case 'inverter-offgrid':
    case 'inverter-hybrid':
      return [item.electrical.nominalDcV];
    case 'load-dc':
      return [item.electrical.ratedVoltageV];
    default:
      return [];
  }
}

/** Tegangan bank baterai (12/24/48 V) tidak didukung alat yang tersambung ke bank itu. */
export function systemVoltageMismatch(ctx: ValidationContext): Finding[] {
  const edges = batteryEdges(ctx);
  const findings: Finding[] = [];
  const check = (id: string, item: CatalogItem, bank: SeriesSum | undefined): void => {
    const supported = supportedVoltagesV(item);
    if (!bank || supported.includes(bank.sum)) return;
    const ratedVoltageV = Math.max(...supported);
    const severity = bank.sum > ratedVoltageV ? 'danger' : 'warning';
    findings.push(
      finding('system-voltage-mismatch', severity, [id, ...bank.ids], {
        params: { systemVoltageV: bank.sum, ratedVoltageV },
      }),
    );
  };
  const sccs = ofCategory(ctx, 'scc-pwm', 'scc-mppt');
  for (const { id, item } of sccs) check(id, item, bankAt(ctx, edges, id, 'bat'));
  for (const { id, item } of ofCategory(ctx, 'inverter-offgrid')) {
    check(id, item, bankAt(ctx, edges, id, 'dc'));
  }
  for (const { id, item } of ofCategory(ctx, 'inverter-hybrid')) {
    check(id, item, bankAt(ctx, edges, id, 'bat'));
  }
  for (const { id, item } of ofCategory(ctx, 'load-dc')) {
    // Beban di keluaran beban SCC mengikuti bank baterai SCC itu.
    const feeder = ofCategory(ctx, 'scc-pwm').find(
      (scc) =>
        netOf(ctx.design, scc.id, 'load-pos') === netOf(ctx.design, id, 'a') &&
        netOf(ctx.design, scc.id, 'load-neg') === netOf(ctx.design, id, 'b'),
    );
    const bank = feeder ? bankAt(ctx, edges, feeder.id, 'bat') : bankAt(ctx, edges, id, '');
    check(id, item, bank);
  }
  return findings;
}
