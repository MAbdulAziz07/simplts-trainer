// Pilihan kabel di meja kerja: penampang yang ditawarkan dan kabel bawaan untuk sambungan baru.
import { conductorGroup, type CableItem, type TerminalKind, type Wire } from '@/domain';

/** Penampang yang ditawarkan di meja kerja; yang tidak ada di tabel kabel katalog dinonaktifkan. */
export const WIRE_AREAS_MM2 = [1.5, 2.5, 4, 6, 10, 16, 25] as const;

export const DEFAULT_WIRE_LENGTH_M = 1;
export const WIRE_LENGTH_MIN_M = 0.5;
export const WIRE_LENGTH_MAX_M = 100;
export const WIRE_LENGTH_STEP_M = 0.5;

// [PERLU VERIFIKASI] Penampang bawaan: 4 mm² untuk DC (kabel PV), 2,5 mm² untuk AC, PE, dan data.
const DEFAULT_DC_AREA_MM2 = 4;
const DEFAULT_AC_AREA_MM2 = 2.5;

export type WireSpec = Pick<Wire, 'cableId' | 'areaMm2' | 'lengthM'>;

/** Penampang yang ditawarkan dan ada di tabel kabel itu. */
export function cableAreasMm2(cable: CableItem): number[] {
  const inTable = new Set(cable.electrical.sizes.map((size) => size.areaMm2));
  return WIRE_AREAS_MM2.filter((areaMm2) => inTable.has(areaMm2));
}

/** Penampang tersedia yang terdekat; bila sama dekat, yang lebih besar. */
export function nearestAreaMm2(cable: CableItem, areaMm2: number): number {
  const areas = cableAreasMm2(cable);
  let best = areas[0] ?? areaMm2;
  for (const candidate of areas)
    if (Math.abs(candidate - areaMm2) <= Math.abs(best - areaMm2)) best = candidate;
  return best;
}

export function clampWireLengthM(lengthM: number): number {
  if (!Number.isFinite(lengthM)) return DEFAULT_WIRE_LENGTH_M;
  const stepped = Math.round(lengthM / WIRE_LENGTH_STEP_M) * WIRE_LENGTH_STEP_M;
  return Math.min(WIRE_LENGTH_MAX_M, Math.max(WIRE_LENGTH_MIN_M, stepped));
}

/** Kabel untuk sambungan baru menurut terminal asal: kabel DC untuk kutub +/−, selain itu NYY. */
export function defaultWireSpec(kind: TerminalKind, cables: readonly CableItem[]): WireSpec {
  const group = conductorGroup(kind);
  const isDc = group === 'positive' || group === 'negative';
  const cable =
    cables.find((candidate) => (candidate.electrical.currentType === 'dc') === isDc) ?? cables[0];
  if (!cable) throw new Error('Katalog tidak memuat kabel');
  return {
    cableId: cable.id,
    areaMm2: nearestAreaMm2(cable, isDc ? DEFAULT_DC_AREA_MM2 : DEFAULT_AC_AREA_MM2),
    lengthM: DEFAULT_WIRE_LENGTH_M,
  };
}
