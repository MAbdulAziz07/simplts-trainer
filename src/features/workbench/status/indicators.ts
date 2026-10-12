// Apa yang ditunjukkan sebuah komponen di meja kerja, diturunkan dari snapshot simulasi. Fungsi
// murni yang mengembalikan nilai sederhana (teks/angka), supaya komponen React hanya digambar
// ulang saat tampilannya memang berubah.
import type { CatalogItem, ComponentCondition, Snapshot } from '@/domain';

/** Lampu indikator SCC/inverter: hijau normal, kuning peringatan, merah gangguan. */
export type LedState = 'off' | 'green' | 'green-blink' | 'yellow' | 'red';

/** Arus isi terkecil yang membuat LED SCC berkedip. */
const CHARGING_MIN_A = 0.05;
/** Di bawah tegangan ini SCC dianggap belum mendapat catu dari baterai. */
const POWERED_MIN_V = 1;

const SCC_RED: readonly ComponentCondition[] = ['damaged', 'fault', 'overload'];
const INVERTER_RED: readonly ComponentCondition[] = [
  'damaged',
  'fault',
  'overload',
  'lvd',
  'hvd',
  'collapsed',
];

/** Keadaan LED sebuah SCC PWM atau inverter off-grid; `undefined` untuk komponen tanpa LED. */
export function ledOf(id: string, item: CatalogItem, snapshot: Snapshot): LedState | undefined {
  const status = snapshot.components[id];
  if (item.category === 'scc-pwm') {
    if (status && SCC_RED.includes(status.condition)) return 'red';
    const scc = snapshot.operatingPoint.sccs[id];
    if (!scc || scc.status === 'no-battery' || scc.batteryVoltageV < POWERED_MIN_V) return 'off';
    const isOverLimit = Math.abs(scc.loadCurrentA) > item.electrical.loadCurrentMaxA;
    if (status?.loadConnected === false || isOverLimit) return 'yellow';
    return scc.chargeCurrentA > CHARGING_MIN_A ? 'green-blink' : 'green';
  }
  if (item.category === 'inverter-offgrid') {
    if (status && INVERTER_RED.includes(status.condition)) return 'red';
    const inverter = snapshot.operatingPoint.inverters[id];
    if (!inverter || inverter.status !== 'on') return 'off';
    const isOverLimit = inverter.acPowerW > item.electrical.ratedAcPowerW;
    const isLowBattery = inverter.dcVoltageV < item.electrical.dcVoltageLowAlarmV;
    return isOverLimit || isLowBattery ? 'yellow' : 'green';
  }
  return undefined;
}

export interface SccLcdValues {
  batteryVoltageV: number;
  chargeCurrentA: number;
  pvVoltageV: number;
  pvCurrentA: number;
}

/** Angka LCD SCC; `undefined` = LCD padam (SCC belum mendapat catu dari baterai). */
export function sccLcdOf(id: string, snapshot: Snapshot): SccLcdValues | undefined {
  const scc = snapshot.operatingPoint.sccs[id];
  if (snapshot.components[id]?.condition === 'damaged') return undefined;
  if (!scc || scc.status === 'no-battery' || scc.batteryVoltageV < POWERED_MIN_V) return undefined;
  return {
    batteryVoltageV: scc.batteryVoltageV,
    chargeCurrentA: scc.chargeCurrentA,
    pvVoltageV: scc.pvVoltageV,
    pvCurrentA: scc.pvVoltageV > 0 ? scc.pvPowerW / scc.pvVoltageV : 0,
  };
}

/** Angka LCD sebagai satu teks `Vbat|Ichg|Vpv|Ipv` (satu desimal); kosong = LCD padam. */
export function sccLcdKey(id: string, snapshot: Snapshot): string {
  const values = sccLcdOf(id, snapshot);
  if (!values) return '';
  const { batteryVoltageV, chargeCurrentA, pvVoltageV, pvCurrentA } = values;
  return [batteryVoltageV, chargeCurrentA, pvVoltageV, pvCurrentA]
    .map((value) => (Math.round(value * 10) / 10 || 0).toFixed(1))
    .join('|');
}

/** Jumlah tingkat terang lampu atau putaran kipas. */
export const LOAD_LEVELS = 20;

/** Daya terserap beban sebagai tingkat 0..`LOAD_LEVELS` terhadap daya maksimumnya. */
export function loadLevelOf(id: string, item: CatalogItem, snapshot: Snapshot): number {
  if (item.category !== 'load-dc' && item.category !== 'load-ac') return 0;
  if (snapshot.components[id]?.condition === 'damaged') return 0;
  const powerW = snapshot.operatingPoint.loads[id]?.powerW ?? 0;
  const ratio = Math.min(Math.max(powerW / item.electrical.maxPowerW, 0), 1);
  // Daya sekecil apa pun tetap terlihat menyala.
  return ratio > 0 ? Math.max(1, Math.round(ratio * LOAD_LEVELS)) : 0;
}

export type ChargeDirection = 'charging' | 'discharging' | 'idle';

/** Arus baterai terkecil yang ditampilkan sebagai mengisi atau melepas. */
const BATTERY_IDLE_A = 0.05;

/** SoC bulat (%) dan arah arus baterai sebagai `80|charging`; kosong bila bukan baterai. */
export function batteryKey(id: string, snapshot: Snapshot): string {
  const socPct = snapshot.components[id]?.socPct;
  if (socPct === undefined) return '';
  const currentA = snapshot.operatingPoint.batteries[id]?.currentA ?? 0;
  const direction: ChargeDirection =
    currentA > BATTERY_IDLE_A ? 'charging' : currentA < -BATTERY_IDLE_A ? 'discharging' : 'idle';
  return `${Math.round(socPct)}|${direction}`;
}

/** Arus terminal terkecil yang dianggap komponen sedang bekerja. */
const WORKING_MIN_A = 0.01;

/**
 * `true` bila komponen berkondisi normal dan sedang dialiri arus di salah satu terminalnya. SCC
 * dan inverter tidak dihitung: keadaannya sudah ditunjukkan LED-nya.
 */
export function workingOf(id: string, item: CatalogItem, snapshot: Snapshot): boolean {
  if (item.category === 'scc-pwm' || item.category === 'inverter-offgrid') return false;
  if (snapshot.components[id]?.condition !== 'ok') return false;
  return item.terminals.some(
    (terminal) =>
      Math.abs(snapshot.terminals[`${id}.${terminal.id}`]?.currentA ?? 0) >= WORKING_MIN_A,
  );
}

export type BadgeTone = 'warning' | 'trip' | 'danger' | 'broken' | 'muted';

/** Warna tanda status per kondisi (docs/UX.md §2.4); `ok` dan `off` tidak diberi tanda. */
export const BADGE_TONE: Partial<Record<ComponentCondition, BadgeTone>> = {
  tripped: 'trip',
  blown: 'trip',
  cutoff: 'trip',
  lvd: 'warning',
  hvd: 'warning',
  collapsed: 'warning',
  overload: 'danger',
  fault: 'danger',
  damaged: 'broken',
  unsupported: 'muted',
};

/** Arus di bawah ini tidak dianimasikan. */
export const FLOW_MIN_A = 0.01;
/** Kecepatan titik arus: sebanding arus, dijepit agar tetap terlihat dan tidak kabur. */
const FLOW_PX_PER_S_PER_A = 6;
const FLOW_MIN_PX_PER_S = 8;
const FLOW_MAX_PX_PER_S = 240;
/** Kecepatan dibulatkan ke kelipatan ini (skala log) agar animasi tidak tersentak tiap hitungan. */
const FLOW_SPEED_STEP = 1.15;

/**
 * Kecepatan titik arus sebuah kabel (px/s), bertanda: positif = dari `wire.from` ke `wire.to`.
 * 0 = tanpa arus.
 */
export function flowSpeedPxPerS(flowA: number): number {
  const currentA = Math.abs(flowA);
  if (!(currentA >= FLOW_MIN_A)) return 0;
  const speed = Math.min(
    Math.max(currentA * FLOW_PX_PER_S_PER_A, FLOW_MIN_PX_PER_S),
    FLOW_MAX_PX_PER_S,
  );
  const level = Math.round(Math.log(speed) / Math.log(FLOW_SPEED_STEP));
  const rounded = Math.round(FLOW_SPEED_STEP ** level * 10) / 10;
  return flowA < 0 ? -rounded : rounded;
}
