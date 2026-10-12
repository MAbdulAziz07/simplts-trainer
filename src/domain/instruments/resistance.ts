// Tahanan antara dua terminal untuk fungsi ohm multimeter: jaringan tahanan dari kabel, sambungan
// dalam komponen (MCB/fuse tertutup, busbar), dan beban resistif, dihitung dengan analisis simpul.
// Sumber, SCC, dan inverter dianggap rangkaian terbuka. [PERLU VERIFIKASI]
import { deriveBridges } from '../circuit/bridges';
import type { PlacedComponent, TerminalRef, Wire } from '../circuit/types';
import { terminalKey, wireResistanceOhm } from '../engine/wire-flow';
import type { CableItem } from '../types';

/** Ruas penghantar antara dua terminal (`komponen.terminal`); 0 Ω = sambungan langsung. */
export interface ResistiveEdge {
  from: string;
  to: string;
  resistanceOhm: number;
}

export interface ResistiveNetworkInput {
  components: readonly PlacedComponent[];
  /** Kabel yang masih menghantar (kabel rusak sudah dibuang). */
  wires: readonly Wire[];
  cables: readonly CableItem[];
  /** MCB/fuse yang ON. */
  closedSwitchIds: readonly string[];
  /** Suhu konduktor kabel; bawaan 20 °C. */
  conductorTempC?: number;
  /** Setelan daya beban; bawaan daya maksimum beban. */
  powerSettingWByLoadId?: Readonly<Record<string, number>>;
}

const DEFAULT_CONDUCTOR_TEMP_C = 20;

/** Ruas tahanan seluruh rangkaian: kabel, sambungan dalam komponen, dan elemen beban resistif. */
export function buildResistiveNetwork(input: ResistiveNetworkInput): ResistiveEdge[] {
  const cableById = new Map(input.cables.map((cable) => [cable.id, cable]));
  const tempC = input.conductorTempC ?? DEFAULT_CONDUCTOR_TEMP_C;
  const edges: ResistiveEdge[] = input.wires.map((wire) => ({
    from: terminalKey(wire.from),
    to: terminalKey(wire.to),
    resistanceOhm: wireResistanceOhm(wire, cableById.get(wire.cableId), tempC),
  }));
  for (const bridge of deriveBridges(input.components, input.closedSwitchIds)) {
    edges.push({ from: terminalKey(bridge.from), to: terminalKey(bridge.to), resistanceOhm: 0 });
  }
  for (const { id, item } of input.components) {
    if (item.category !== 'load-dc' && item.category !== 'load-ac') continue;
    const [first, second] = item.terminals;
    const powerW = input.powerSettingWByLoadId?.[id] ?? item.electrical.maxPowerW;
    if (!first || !second || powerW <= 0) continue;
    edges.push({
      from: terminalKey({ componentId: id, terminalId: first.id }),
      to: terminalKey({ componentId: id, terminalId: second.id }),
      resistanceOhm: item.electrical.ratedVoltageV ** 2 / powerW,
    });
  }
  return edges;
}

/** Menyelesaikan `matrix · x = rhs` dengan eliminasi Gauss berpivot; `undefined` bila singular. */
function solveLinear(matrix: number[][], rhs: number[]): number[] | undefined {
  const size = rhs.length;
  const rows = matrix.map((row, i) => [...row, rhs[i] ?? 0]);
  for (let col = 0; col < size; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < size; row += 1) {
      if (Math.abs(rows[row]?.[col] ?? 0) > Math.abs(rows[pivot]?.[col] ?? 0)) pivot = row;
    }
    const pivotRow = rows[pivot];
    const pivotValue = pivotRow?.[col] ?? 0;
    if (!pivotRow || Math.abs(pivotValue) < 1e-15) return undefined;
    rows[pivot] = rows[col] ?? pivotRow;
    rows[col] = pivotRow;
    for (let row = col + 1; row < size; row += 1) {
      const current = rows[row];
      if (!current) continue;
      const factor = (current[col] ?? 0) / pivotValue;
      if (factor === 0) continue;
      for (let k = col; k <= size; k += 1)
        current[k] = (current[k] ?? 0) - factor * (pivotRow[k] ?? 0);
    }
  }
  const solution = new Array<number>(size).fill(0);
  for (let row = size - 1; row >= 0; row -= 1) {
    const current = rows[row] ?? [];
    let sum = current[size] ?? 0;
    for (let k = row + 1; k < size; k += 1) sum -= (current[k] ?? 0) * (solution[k] ?? 0);
    solution[row] = sum / (current[row] ?? 1);
  }
  return solution;
}

/**
 * Tahanan setara antara terminal `a` dan `b` (Ω). `Infinity` bila tidak ada jalur penghantar; 0
 * bila keduanya tersambung langsung atau terminal yang sama.
 */
export function resistanceBetweenOhm(
  edges: readonly ResistiveEdge[],
  a: TerminalRef,
  b: TerminalRef,
): number {
  // Terminal yang tersambung 0 Ω dilebur menjadi satu simpul.
  const parent = new Map<string, string>();
  const find = (key: string): string => {
    let root = key;
    for (
      let next = parent.get(root);
      next !== undefined && next !== root;
      next = parent.get(root)
    ) {
      root = next;
    }
    parent.set(key, root);
    return root;
  };
  for (const edge of edges) {
    if (edge.resistanceOhm > 0) continue;
    const [rootFrom, rootTo] = [find(edge.from), find(edge.to)];
    if (rootFrom !== rootTo) parent.set(rootFrom, rootTo);
  }
  const start = find(terminalKey(a));
  const end = find(terminalKey(b));
  if (start === end) return 0;

  const neighbors = new Map<string, { other: string; conductanceS: number }[]>();
  const link = (node: string, other: string, conductanceS: number) => {
    const list = neighbors.get(node);
    if (list) list.push({ other, conductanceS });
    else neighbors.set(node, [{ other, conductanceS }]);
  };
  for (const edge of edges) {
    if (!(edge.resistanceOhm > 0)) continue;
    const [from, to] = [find(edge.from), find(edge.to)];
    if (from === to) continue;
    link(from, to, 1 / edge.resistanceOhm);
    link(to, from, 1 / edge.resistanceOhm);
  }

  // Simpul yang terjangkau dari `a`; `b` menjadi acuan 0 V dan tidak masuk matriks.
  const order = [start];
  const index = new Map([[start, 0]]);
  let reachesEnd = false;
  for (let i = 0; i < order.length; i += 1) {
    for (const { other } of neighbors.get(order[i] ?? '') ?? []) {
      if (other === end) reachesEnd = true;
      else if (!index.has(other)) index.set(other, order.push(other) - 1);
    }
  }
  if (!reachesEnd) return Infinity;

  const size = order.length;
  const matrix = order.map(() => new Array<number>(size).fill(0));
  order.forEach((node, row) => {
    for (const { other, conductanceS } of neighbors.get(node) ?? []) {
      const current = matrix[row];
      if (!current) continue;
      current[row] = (current[row] ?? 0) + conductanceS;
      const col = index.get(other);
      if (col !== undefined) current[col] = (current[col] ?? 0) - conductanceS;
    }
  });
  // Suntik 1 A di `a`: tegangan `a` terhadap `b` sama dengan tahanan setaranya.
  const rhs = order.map((_, row) => (row === 0 ? 1 : 0));
  return solveLinear(matrix, rhs)?.[0] ?? Infinity;
}
