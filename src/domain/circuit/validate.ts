// Pemeriksaan rangkaian: menjalankan semua aturan dan mengembalikan temuan dalam urutan tetap.
// Teks tiap temuan (pesan singkat dan penjelasan) ada di src/i18n/id.ts, dicari lewat `code`.
import { FINDING_CODES, FINDING_SEVERITIES } from './types';
import type { Finding, ValidationInput } from './types';
import { buildContext } from './validate-context';
import type { Rule } from './validate-context';
import { cableUnknown, overcurrent } from './validate-current';
import { reversePolarity, shortCircuit } from './validate-polarity';
import { pvVocOverLimit, systemVoltageMismatch } from './validate-ratings';
import { liveRewiring, pvBeforeBattery } from './validate-sequence';
import {
  acLoadOnDc,
  gridtieWithoutGrid,
  openCircuit,
  peNotConnected,
  pvDirect,
} from './validate-topology';

const RULES: readonly Rule[] = [
  reversePolarity,
  shortCircuit,
  pvDirect,
  pvVocOverLimit,
  overcurrent,
  cableUnknown,
  systemVoltageMismatch,
  pvBeforeBattery,
  openCircuit,
  acLoadOnDc,
  gridtieWithoutGrid,
  peNotConnected,
  liveRewiring,
];

function sortKey(finding: Finding): string {
  return [...finding.componentIds, ...(finding.wireIds ?? [])].join(',');
}

/**
 * Memeriksa rangkaian di meja kerja. Hasil urut: bahaya, peringatan, info; lalu urutan
 * `FINDING_CODES`; lalu id komponen. Tidak bergantung pada urutan masukan.
 */
export function validateCircuit(input: ValidationInput): Finding[] {
  const ctx = buildContext(input);
  return RULES.flatMap((rule) => rule(ctx)).sort((a, b) => {
    const bySeverity =
      FINDING_SEVERITIES.indexOf(b.severity) - FINDING_SEVERITIES.indexOf(a.severity);
    if (bySeverity !== 0) return bySeverity;
    const byCode = FINDING_CODES.indexOf(a.code) - FINDING_CODES.indexOf(b.code);
    if (byCode !== 0) return byCode;
    const [keyA, keyB] = [sortKey(a), sortKey(b)];
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });
}
