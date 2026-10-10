// Parameter katalog: kabel, kWh meter, distribusi, jaringan, dan beban (docs/KATALOG.md §6.8–6.10).
import type { CurvePoint, TripCurve } from './shared';

/** Kabel PV: KHA bebas di udara, di permukaan, dan 2 kabel menyentuh. */
export interface PvCableSize {
  areaMm2: number;
  rMaxOhmPerKm: number;
  ampacityAirA: number;
  ampacitySurfaceA: number;
  ampacityTouchingA: number;
}

/** Kabel NYY: KHA di tanah dan di udara pada 20 °C dan 30 °C. */
export interface NyyCableSize {
  areaMm2: number;
  ampacityGround20A: number;
  ampacityGround30A: number;
  ampacityAir20A: number;
  ampacityAir30A: number;
}

export type CableSize = PvCableSize | NyyCableSize;

export interface CableElectrical {
  conductor: 'copper';
  resistivityOhmMm2PerM: number;
  tempCoeffPerC: number;
  tinnedFactor: number;
  contactResistanceMohm: number;
  thermalTimeConstantMin: number;
  ratedVoltageV: number;
  currentType: 'dc' | 'ac-dc';
  maxConductorTempC: number;
  ampacityRefAmbientC: number;
  ambientDerating?: CurvePoint[];
  sizes: CableSize[];
}

export interface CableProtection {
  maxConductorTempC: number;
  overheatDamageMarginK: number;
  overheatDamageDelayS: number;
}

export interface KwhMeterElectrical {
  network: '1P2W';
  directConnection: boolean;
  currentMinA: number;
  currentRefA: number;
  currentMaxA: number;
  voltageMinV: number;
  voltageMaxV: number;
  frequencyHz: number;
  accuracyClass: number;
  energyAccuracyPct: number;
  lowCurrentErrorPct: number;
  displayMaxKwh: number;
  displayResolutionKwh: number;
  pulseKwhPerPulse: number;
  gainErrorMaxPct: number;
  terminalMaxMm2: number;
  tempOpMinC: number;
  tempOpMaxC: number;
}

export interface KwhMeterProtection {
  currentMaxA: number;
  overCurrentDamageA: number;
  ipRating: string;
}

export interface BusbarElectrical {
  positions: number;
  ratedCurrentA: number;
  ratedVoltageV: number;
}

export interface BusbarProtection {
  ratedCurrentA: number;
}

export interface GroundingElectrical {
  earthResistanceOhm: number;
}

export interface LoadPanelElectrical {
  ratedCurrentA: number;
  circuitCount: number;
  circuitBreakerA: number;
  circuitCurve: TripCurve;
  ratedVoltageAcV: number;
  breakingCapacityKa: number;
}

export type LoadPanelProtection = Omit<LoadPanelElectrical, 'circuitCount' | 'ratedVoltageAcV'>;

export interface GridElectrical {
  nominalVoltageV: number;
  voltageToleranceUpPct: number;
  voltageToleranceDownPct: number;
  frequencyHz: number;
  availableDefault: boolean;
}

export interface LoadElectrical {
  kind: 'resistive';
  ratedVoltageV: number;
  maxPowerW: number;
  minPowerW: number;
  stepW: number;
  resistanceAtMaxOhm: number;
}
