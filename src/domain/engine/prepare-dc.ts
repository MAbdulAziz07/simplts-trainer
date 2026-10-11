// Model satu bus baterai untuk satu langkah: bank baterai, kurva array PV, dan setelan SCC PWM
// dari katalog dan keadaan (MODEL_FISIKA §1.5, §2.2). Dipakai solve-dc.ts.
import type { DcBus, DcConsumer, SccNode, SystemTopology } from '../circuit/subsystem-types';
import type { PlacedComponent } from '../circuit/types';
import { pvCellTempC, pvCurveAt, type PvCurve } from '../components/pv';
import { pvArrayVocV, pvShadedIrradianceWm2 } from '../components/pv-array';
import { pwmDetectVoltageScale, pwmSetpoints, pwmVocStatus } from '../components/scc';
import type { SccVocStatus } from '../components/scc';
import type { CatalogItemOf, ComponentCategory, PvModuleItem, SccPwmItem } from '../types';
import { bankRestVoltageV } from './dc-bus';
import type { BatteryBank } from './dc-bus';
import type { SolverEnvironment, SolverState } from './types';

const DEFAULT_SOC_PCT = 100;

export type ItemLookup = <C extends ComponentCategory>(
  id: string,
  category: C,
) => CatalogItemOf<C> | undefined;

export interface PreparedScc {
  node: SccNode;
  item: SccPwmItem;
  /** Kurva modul tiap string pada iradiasi dan suhu saat ini. */
  strings: PvCurve[][];
  vocStatus: SccVocStatus;
  /** Tegangan yang ditahan di terminal baterai SCC (absorption atau float). */
  limitV: number;
  /** Pemakai di terminal beban; kosong bila terminal beban sedang diputus. */
  consumers: DcConsumer[];
}

export interface PreparedBus {
  bus: DcBus;
  /** `undefined` = bus tidak bisa dihitung (bank tidak seragam, SCC MPPT, susunan campuran). */
  bank?: BatteryBank;
  sccs: PreparedScc[];
  consumers: DcConsumer[];
}

export function itemLookup(components: readonly PlacedComponent[]): ItemLookup {
  const byId = new Map(components.map((component) => [component.id, component.item]));
  return <C extends ComponentCategory>(id: string, category: C) => {
    const item = byId.get(id);
    return item?.category === category ? (item as CatalogItemOf<C>) : undefined;
  };
}

/** Kurva I-V satu modul pada iradiasi (dikurangi bayangan) dan suhu sel saat ini. */
export function pvModuleCurve(
  id: string,
  module: PvModuleItem,
  environment: SolverEnvironment,
  state: SolverState,
): PvCurve {
  const shadedFraction = state.shadedFractionByPvId?.[id] ?? 0;
  const irradianceWm2 = pvShadedIrradianceWm2(environment.irradianceWm2, shadedFraction);
  const cellTempC = pvCellTempC(environment.ambientTempC, irradianceWm2, module.electrical.noctC);
  return pvCurveAt(module.electrical, irradianceWm2, cellTempC);
}

function prepareBank(bus: DcBus, itemOf: ItemLookup, state: SolverState): BatteryBank | undefined {
  const { strings, irregular } = bus.battery;
  const ids = strings.flat();
  const items = ids.map((id) => itemOf(id, 'battery'));
  const [first] = items;
  const seriesCount = strings[0]?.length ?? 0;
  const uniform =
    items.every((item) => item !== undefined && item.id === first?.id) &&
    strings.every((string) => string.length === seriesCount);
  if (irregular || !first || !uniform) return undefined;
  const socSumPct = ids.reduce(
    (sumPct, id) => sumPct + (state.socPctByBatteryId?.[id] ?? DEFAULT_SOC_PCT),
    0,
  );
  return {
    electrical: first.electrical,
    seriesCount,
    parallelCount: strings.length,
    socPct: socSumPct / ids.length,
  };
}

/** Model satu bus untuk satu langkah; bus yang memuat bagian belum didukung tidak punya `bank`. */
export function prepareDcBus(
  bus: DcBus,
  topology: SystemTopology,
  itemOf: ItemLookup,
  environment: SolverEnvironment,
  state: SolverState,
): PreparedBus {
  const bank = prepareBank(bus, itemOf, state);
  const nodes = topology.sccs.filter((node) => node.busId === bus.id);
  const consumers = topology.dcConsumers.filter((consumer) => consumer.busId === bus.id);
  const sccs: PreparedScc[] = [];
  for (const node of nodes) {
    const item = itemOf(node.id, 'scc-pwm');
    const modules = node.pv.strings.map((ids) =>
      ids.map((id) => ({ id, item: itemOf(id, 'pv-module') })),
    );
    if (!bank || !item || node.pv.irregular || modules.flat().some((module) => !module.item)) {
      return { bus, sccs: [], consumers };
    }
    const strings = modules.map((string) =>
      string.flatMap(({ id, item: module }) =>
        module ? [pvModuleCurve(id, module, environment, state)] : [],
      ),
    );
    const sccState = state.sccById?.[node.id] ?? {};
    const scale =
      sccState.voltageScale ?? pwmDetectVoltageScale(item.electrical, bankRestVoltageV(bank));
    const setpoints = pwmSetpoints(item.electrical, sccState.batteryType ?? 'sealed', scale);
    sccs.push({
      node,
      item,
      strings,
      vocStatus: pwmVocStatus(pvArrayVocV(strings), setpoints.pvVocMaxV, item.protection),
      limitV: sccState.stage === 'float' ? setpoints.floatV : setpoints.absorptionV,
      consumers:
        sccState.loadConnected === false
          ? []
          : topology.dcConsumers.filter((consumer) => consumer.sccId === node.id),
    });
  }
  return bank ? { bus, bank, sccs, consumers } : { bus, sccs, consumers };
}
