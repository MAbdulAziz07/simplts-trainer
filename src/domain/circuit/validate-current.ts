// Aturan arus: arus terhadap rating MCB/fuse dan KHA kabel, serta kabel yang tidak ada di katalog.
import { cableEffectiveAmpacityA, cableTableAmpacityA } from '../components/cable';
import type { CatalogItem, ComponentCategory } from '../types';
import { deriveBridges, SWITCH_CATEGORIES } from './bridges';
import { buildNetlist } from './graph';
import type { Finding, Wire } from './types';
import { finding, netOf, ofCategory } from './validate-context';
import type { ValidationContext } from './validate-context';

/** Faktor arus rancangan jalur PV terhadap Isc (MODEL_FISIKA §9.1). [PERLU VERIFIKASI] */
export const PV_DESIGN_CURRENT_FACTOR = 1.25;
/** Suhu sekitar bawaan untuk KHA kabel. [PERLU VERIFIKASI] */
export const DEFAULT_AMBIENT_TEMP_C = 30;
/** Komponen yang hanya dilewati arus pada jalur tanpa cabang. */
const PASS_THROUGH: readonly ComponentCategory[] = [...SWITCH_CATEGORIES, 'kwh-meter'];

/** Arus rancangan di sebuah terminal; `undefined` bila tidak bisa ditaksir dari katalog. */
export function designCurrentA(item: CatalogItem, terminalId: string): number | undefined {
  const kind = item.terminals.find((terminal) => terminal.id === terminalId)?.kind;
  if (kind === undefined || kind === 'pe' || kind === 'data') return undefined;
  const isAc = kind === 'acL' || kind === 'acN';
  switch (item.category) {
    case 'pv-module':
      return item.electrical.iscA * PV_DESIGN_CURRENT_FACTOR;
    case 'load-dc':
    case 'load-ac':
      return item.electrical.maxPowerW / item.electrical.ratedVoltageV;
    case 'inverter-offgrid': {
      const { ratedAcPowerW, acOutputVoltageV, efficiencyAtFullLoad, nominalDcV } = item.electrical;
      if (isAc) return ratedAcPowerW / acOutputVoltageV;
      return ratedAcPowerW / (efficiencyAtFullLoad * nominalDcV);
    }
    case 'inverter-gridtie':
      if (isAc) return item.electrical.ratedAcPowerW / item.electrical.acOutputVoltageV;
      return item.electrical.dcCurrentMaxA;
    case 'scc-pwm':
      if (terminalId.startsWith('load')) return item.electrical.loadCurrentMaxA;
      return item.electrical.chargeCurrentMaxA;
    case 'scc-mppt':
      if (terminalId.startsWith('pv')) return item.electrical.inputCurrentMaxA;
      return item.electrical.chargeCurrentMaxA;
    default:
      return undefined;
  }
}

/**
 * Taksiran statis arus per net jalur. Hanya untuk jalur tanpa cabang: tepat dua terminal alat,
 * dengan MCB/fuse/kWh meter di antaranya; arus = yang terkecil dari arus rancangan kedua ujung.
 */
function estimateByPath(ctx: ValidationContext) {
  const bridges = deriveBridges(ctx.components, undefined, PASS_THROUGH);
  const path = buildNetlist(ctx.components, ctx.input.wires, bridges);
  const currentAByNet = new Map<string, number>();
  for (const net of path.nets) {
    const ends = net.terminals.filter((ref) => {
      const category = ctx.byId.get(ref.componentId)?.item.category;
      return category !== undefined && !PASS_THROUGH.includes(category);
    });
    if (ends.length !== 2) continue;
    const known = ends
      .map((ref) => {
        const item = ctx.byId.get(ref.componentId)?.item;
        return item && designCurrentA(item, ref.terminalId);
      })
      .filter((currentA) => currentA !== undefined);
    if (known.length > 0) currentAByNet.set(net.id, Math.min(...known));
  }
  return { path, currentAByNet };
}

/** KHA efektif sebuah kabel pada suhu sekitar; `undefined` bila kabel atau penampang tak dikenal. */
export function wireAmpacityA(ctx: ValidationContext, wire: Wire): number | undefined {
  const cable = ctx.input.cables.find((item) => item.id === wire.cableId)?.electrical;
  const tableAmpacityA = cable && cableTableAmpacityA(cable, wire.areaMm2);
  if (!cable || tableAmpacityA === undefined) return undefined;
  return cableEffectiveAmpacityA(
    cable,
    tableAmpacityA,
    ctx.input.ambientTempC ?? DEFAULT_AMBIENT_TEMP_C,
  );
}

/** Arus (terukur, atau taksiran bila belum ada) di atas rating MCB/fuse atau KHA kabel. */
export function overcurrent(ctx: ValidationContext): Finding[] {
  const { path, currentAByNet } = estimateByPath(ctx);
  const { currentAByComponentId = {}, currentAByWireId = {} } = ctx.input;
  const findings: Finding[] = [];
  const resolve = (measuredA: number | undefined, estimates: (number | undefined)[]) => {
    const known = estimates.filter((currentA) => currentA !== undefined);
    if (measuredA !== undefined) return { currentA: Math.abs(measuredA), estimated: 0 };
    return known.length > 0 ? { currentA: Math.max(...known), estimated: 1 } : undefined;
  };

  for (const { id, item } of ofCategory(ctx, 'mcb-dc', 'mcb-ac', 'fuse')) {
    const estimates = item.terminals.map((t) => currentAByNet.get(netOf(path, id, t.id) ?? ''));
    const current = resolve(currentAByComponentId[id], estimates);
    const { ratedCurrentA } = item.electrical;
    if (!current || current.currentA <= ratedCurrentA) continue;
    findings.push(
      finding('breaker-overcurrent', 'warning', [id], { params: { ...current, ratedCurrentA } }),
    );
  }
  for (const wire of path.wires) {
    const current = resolve(currentAByWireId[wire.id], [currentAByNet.get(wire.netId)]);
    const ampacityA = wireAmpacityA(ctx, wire);
    if (!current || ampacityA === undefined || current.currentA <= ampacityA) continue;
    findings.push(
      finding('cable-overcurrent', 'danger', [wire.from.componentId, wire.to.componentId], {
        wireIds: [wire.id],
        params: { ...current, ampacityA },
      }),
    );
  }
  return findings;
}

/** Kabel yang `cableId` atau penampangnya tidak ada di katalog, sehingga KHA-nya tidak diketahui. */
export function cableUnknown(ctx: ValidationContext): Finding[] {
  return ctx.design.wires
    .filter((wire) => wireAmpacityA(ctx, wire) === undefined)
    .map((wire) =>
      finding('cable-unknown', 'warning', [wire.from.componentId, wire.to.componentId], {
        wireIds: [wire.id],
        params: { areaMm2: wire.areaMm2 },
      }),
    );
}
