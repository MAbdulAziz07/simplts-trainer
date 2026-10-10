// Skema modul PV dan SCC (docs/KATALOG.md §6.1–6.3).
import { z } from 'zod';
import {
  bool,
  count,
  efficiency,
  itemSchema,
  mpptWindow,
  nonNegative,
  num,
  positive,
  protectionFeatures,
  tripTimeCurve,
} from './common';

/** Selisih terbesar `pmaxW` terhadap `vmpV × impA` akibat pembulatan datasheet [PERLU VERIFIKASI]. */
const PMAX_TOLERANCE = 0.05;
const INSTALL_ORDER = ['battery', 'pv', 'load'] as const;

export const pvModuleSchema = itemSchema(
  'pv-module',
  z
    .strictObject({
      cellCount: count,
      pmaxW: positive,
      vmpV: positive,
      impA: positive,
      vocV: positive,
      iscA: positive,
      tempCoeffIscPerC: num,
      tempCoeffVocPerC: z.number().negative(),
      tempCoeffPmaxPerC: z.number().negative(),
      noctC: num,
      systemVoltageMaxV: positive,
      bypassDiodeCount: count,
      tempOpMinC: num,
      tempOpMaxC: num,
    })
    // Prasyarat kurva I-V (MODEL_FISIKA §1.4): ln(1 − Imp/Isc) harus terdefinisi.
    .refine((pv) => pv.vmpV < pv.vocV, { error: 'vmpV harus di bawah vocV', path: ['vmpV'] })
    .refine((pv) => pv.impA < pv.iscA, { error: 'impA harus di bawah iscA', path: ['impA'] })
    .refine((pv) => Math.abs(pv.vmpV * pv.impA - pv.pmaxW) <= PMAX_TOLERANCE * pv.pmaxW, {
      error: `pmaxW harus dalam ${PMAX_TOLERANCE * 100}% dari vmpV × impA`,
      path: ['pmaxW'],
    }),
  z.strictObject({ seriesFuseMaxA: positive, reverseCurrentMaxA: positive }),
);

export const sccPwmSchema = itemSchema(
  'scc-pwm',
  z.strictObject({
    batteryVoltagesV: z.array(positive).min(1),
    chargeStages: count,
    chargeCurrentMaxA: positive,
    loadCurrentMaxA: positive,
    pvPowerMax12VW: positive,
    pvPowerMax24VW: positive,
    pvVocMax12VV: positive,
    pvVocMax24VV: positive,
    absorptionV: z.strictObject({ sealed: positive, gel: positive, flooded: positive }),
    floatV: positive,
    rechargeV: positive,
    loadDisconnectV: positive,
    loadReconnectV: positive,
    voltageScale24V: positive,
    selfConsumptionMa: nonNegative,
    switchDropV: nonNegative,
    absorptionDurationMin: positive,
    tempOpMinC: num,
    tempOpMaxC: num,
    // Model RBL: tiap langkah tepat sekali, baterai dulu (MODEL_FISIKA §2.3, US17).
    installOrder: z
      .array(z.enum(INSTALL_ORDER))
      .refine((order) => order.join() === INSTALL_ORDER.join(), {
        error: `Urutan pasang harus ${INSTALL_ORDER.join(', ')}`,
      }),
  }),
  z.strictObject({
    vocFaultFactor: positive,
    loadOverloadCurve: tripTimeCurve,
    features: protectionFeatures,
    reversePolarityDamages: bool,
  }),
);

export const sccMpptSchema = itemSchema(
  'scc-mppt',
  z
    .strictObject({
      batteryNominalV: positive,
      mpptMinV: positive,
      mpptMaxV: positive,
      pvVocMaxV: positive,
      pvPowerMaxW: positive,
      inputCurrentMaxA: positive,
      chargeCurrentMaxA: positive,
      efficiencyMax: efficiency,
      trackingEfficiency: efficiency,
      standbyPowerW: nonNegative,
      startDeltaV: nonNegative,
      bulkV: positive,
      floatV: z.strictObject({ vented: positive, sealed: positive, gel: positive, nicd: positive }),
      lowBatteryAlarmV: positive,
      autoDetectBattery: bool,
      batteryTempSensor: bool,
      absorptionDurationMin: positive,
      tempOpMinC: num,
      tempOpMaxC: num,
    })
    .refine(...mpptWindow),
  z.strictObject({
    vocMaxV: positive,
    vocFaultFactor: positive,
    overloadAlarmPct: positive,
    features: protectionFeatures,
  }),
);
