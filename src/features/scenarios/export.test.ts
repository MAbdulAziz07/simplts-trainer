import { describe, expect, it } from 'vitest';
import { createRun, diagnose, finishRun, scenarioList, scoreOf } from '@/store';
import { formatDateTime, resultCsv, resultFileName, resultRows } from './export';

const trouble = scenarioList.find((scenario) => scenario.mode === 'troubleshoot');
if (!trouble) throw new Error('skenario Cari Gangguan tidak ada');
const START = new Date(2026, 9, 15, 9, 5, 3).getTime();

function finishedRun() {
  const fault = { kind: 'wire-open' as const, target: 'w4' };
  let run = createRun(trouble!, [fault], 'Ani; Guru', START);
  run = diagnose(run, 'wire-open', 'w4', 30, START + 12_500).run;
  return finishRun(run, 60, START + 90_000);
}

describe('hasil skenario', () => {
  it('formatDateTime waktu lokal', () => {
    expect(formatDateTime(START)).toBe('2026-10-15 09:05:03');
  });

  it('ringkasan memuat peserta, versi, nilai, dan gangguan', () => {
    const run = finishedRun();
    const rows = resultRows(run, scoreOf(run), START + 90_000);
    const field = (name: string) => rows.find((row) => row[0] === name)?.[1];
    expect(field('Peserta')).toBe('Ani; Guru');
    expect(field('Versi skenario')).toBe('1');
    expect(field('Lama')).toBe('01:30');
    expect(field('Gangguan disuntikkan')).toBe('Kabel putus — w4');
    expect(field('Gangguan ditemukan')).toBe('1/1');
    expect(rows.some((row) => row[2] === 'Diagnosa benar' && row[0] === '12,5')).toBe(true);
  });

  it('CSV diawali BOM, berpemisah titik koma, sel bertitik koma dikutip', () => {
    const run = finishedRun();
    const csv = resultCsv(run, scoreOf(run), START + 90_000);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).startsWith('RINGKASAN\r\n')).toBe(true);
    expect(csv).toContain('Peserta;"Ani; Guru"');
  });

  it('nama berkas memakai id dan waktu selesai', () => {
    expect(resultFileName(finishedRun())).toBe('hasil-offgrid-cari-gangguan-20261015090633.csv');
  });
});
