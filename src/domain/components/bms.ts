// Model BMS di dalam baterai LiFePO4: pemutusan karena tegangan, arus lebih, dan hubung singkat
// (docs/MODEL_FISIKA.md §4.5). Arus > 0 = mengisi, arus < 0 = melepas. BMS eksternal dan batas
// suhu belum dimodelkan.
import type { BatteryProtection } from '../catalog/storage';

/** Tunda arus lebih bila katalog tidak memuatnya (§4.5). [PERLU VERIFIKASI] */
export const BMS_DEFAULT_OVER_CURRENT_DELAY_S = 10;
/** Ambang hubung singkat sebagai kelipatan `Idis_max` bila katalog tidak memuatnya. [PERLU VERIFIKASI] */
export const BMS_DEFAULT_SHORT_CIRCUIT_FACTOR = 3;

export type BmsCutoffReason = 'over-voltage' | 'under-voltage' | 'over-current' | 'short-circuit';

export interface BmsLimits {
  overVoltageCutoffV?: number;
  underVoltageCutoffV?: number;
  overCurrentDischargeA?: number;
  overCurrentDelayS: number;
  shortCircuitFactor: number;
}

/** `open = true` berarti BMS memutus baterai; terkunci sampai direset. */
export interface BmsState {
  open: boolean;
  reason?: BmsCutoffReason;
  /** Lama arus lepas terus-menerus di atas `Idis_max`. */
  overCurrentS: number;
}

export const BMS_CLOSED: BmsState = { open: false, overCurrentS: 0 };

/** Batas BMS dari katalog; `undefined` bila baterai tidak punya BMS di dalam. */
export function bmsLimits(protection: BatteryProtection): BmsLimits | undefined {
  if (!protection.internalBms) return undefined;
  const { overVoltageCutoffV, underVoltageCutoffV, overCurrentDischargeA } = protection;
  return {
    ...(overVoltageCutoffV !== undefined && { overVoltageCutoffV }),
    ...(underVoltageCutoffV !== undefined && { underVoltageCutoffV }),
    ...(overCurrentDischargeA !== undefined && { overCurrentDischargeA }),
    overCurrentDelayS: protection.overCurrentDelayS ?? BMS_DEFAULT_OVER_CURRENT_DELAY_S,
    shortCircuitFactor: protection.shortCircuitFactor ?? BMS_DEFAULT_SHORT_CIRCUIT_FACTOR,
  };
}

/**
 * Keadaan BMS setelah `dtS` pada tegangan terminal dan arus baterai. Hubung singkat dan batas
 * tegangan memutus seketika; arus lebih memutus setelah tunda. Tegangan lebih hanya memutus saat
 * mengisi, tegangan kurang hanya saat tidak mengisi.
 */
export function bmsStep(
  limits: BmsLimits,
  state: BmsState,
  voltageV: number,
  currentA: number,
  dtS: number,
): BmsState {
  if (state.open) return state;
  const open = (reason: BmsCutoffReason): BmsState => ({ open: true, reason, overCurrentS: 0 });
  const dischargeA = Math.max(-currentA, 0);
  const maxA = limits.overCurrentDischargeA;
  if (maxA !== undefined && dischargeA > limits.shortCircuitFactor * maxA) {
    return open('short-circuit');
  }
  if (limits.overVoltageCutoffV !== undefined && currentA > 0) {
    if (voltageV > limits.overVoltageCutoffV) return open('over-voltage');
  }
  if (limits.underVoltageCutoffV !== undefined && currentA <= 0) {
    if (voltageV < limits.underVoltageCutoffV) return open('under-voltage');
  }
  if (maxA === undefined || dischargeA <= maxA) return { open: false, overCurrentS: 0 };
  const overCurrentS = state.overCurrentS + dtS;
  return overCurrentS >= limits.overCurrentDelayS
    ? open('over-current')
    : { open: false, overCurrentS };
}
