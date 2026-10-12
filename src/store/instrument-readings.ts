// Bacaan alat ukur dari rangkaian di meja kerja dan snapshot simulasi. Fungsi murni: derau datang
// dari `random` (0..1) milik pemanggil.
import {
  METER_NOISE_FRACTION,
  activeCircuit,
  buildNetlist,
  buildResistiveNetwork,
  deriveBridges,
  readClamp,
  readMultimeter,
  resistanceBetweenOhm,
  supplyKindOf,
  type ClampMode,
  type MeterFunction,
  type MeterReading,
  type ProbePoint,
  type SimState,
  type Snapshot,
  type TerminalRef,
} from '@/domain';
import { cableItems, toPlacedComponents } from './catalog';
import type { CircuitDoc } from './circuit-doc';

/** Keadaan yang dibaca alat ukur pada satu saat. */
export interface MeasureContext {
  doc: CircuitDoc;
  state: SimState;
  snapshot: Snapshot;
}

export interface ProbeRefs {
  red?: TerminalRef;
  black?: TerminalRef;
}

/** Rangkaian yang masih menghantar: kabel rusak dibuang, fuse putus dan MCB rusak terbuka. */
function conducting({ doc, state }: MeasureContext) {
  const components = toPlacedComponents(doc);
  const { wires, closedSwitchIds } = activeCircuit(state, doc.wires);
  const netlist = buildNetlist(components, wires, deriveBridges(components, closedSwitchIds));
  return { components, wires, closedSwitchIds, netlist };
}

/** `true` bila terminal masih ada di rangkaian. */
export function hasTerminal(snapshot: Snapshot, ref: TerminalRef): boolean {
  return `${ref.componentId}.${ref.terminalId}` in snapshot.terminals;
}

/** Satu cuplikan bacaan multimeter untuk fungsi `fn` dengan probe di `probes`. */
export function multimeterReading(
  context: MeasureContext,
  fn: MeterFunction,
  probes: ProbeRefs,
  random: () => number,
): MeterReading {
  const circuit = conducting(context);
  const pointOf = (ref: TerminalRef | undefined): ProbePoint | undefined => {
    const reading = ref && context.snapshot.terminals[`${ref.componentId}.${ref.terminalId}`];
    if (!ref || !reading) return undefined;
    return {
      voltageV: reading.voltageV,
      floating: reading.floating,
      supply: supplyKindOf(circuit.netlist, ref),
    };
  };
  const red = pointOf(probes.red);
  const black = pointOf(probes.black);
  const resistanceOhm =
    fn === 'ohm' && probes.red && probes.black && red && black
      ? resistanceBetweenOhm(
          buildResistiveNetwork({ ...circuit, cables: cableItems }),
          probes.red,
          probes.black,
        )
      : Infinity;
  return readMultimeter({ fn, red, black, resistanceOhm, random });
}

/** Satu cuplikan bacaan tang ampere pada kabel `wireId`; tanpa kabel terbaca nol. */
export function clampReading(
  context: MeasureContext,
  mode: ClampMode,
  wireId: string | undefined,
  random: () => number,
): MeterReading {
  const wire = context.doc.wires.find((candidate) => candidate.id === wireId);
  if (!wire) return { kind: 'value', value: 0 };
  return readClamp({
    mode,
    flowA: context.snapshot.wires[wire.id]?.flowA ?? 0,
    supply: supplyKindOf(conducting(context).netlist, wire.from),
    random,
  });
}

/** Satu cuplikan bacaan solar power meter: iradiasi pada bidang panel dengan derau ±0,5%. */
export function solarReadingWm2(irradianceWm2: number, random: () => number): number {
  return Math.max(irradianceWm2, 0) * (1 + METER_NOISE_FRACTION * (2 * random() - 1));
}
