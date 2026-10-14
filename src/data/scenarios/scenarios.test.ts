import { describe, expect, it } from 'vitest';
import { loadCatalog } from '../catalog';
import { loadScenarios, rawScenarioFiles } from './index';
import { sentenceCount } from './schema';
import { parseScenarioText, validateScenario } from './validate';

const catalog = loadCatalog();
const scenarios = loadScenarios(catalog);
const raw = (id: string) => structuredClone(rawScenarioFiles[id]) as Record<string, unknown>;
const issuesOf = (value: unknown) => validateScenario(value, catalog).issues;

describe('skenario bawaan', () => {
  it('semua sah, satu per mode, urut mode', () => {
    expect(scenarios.map((scenario) => scenario.mode)).toEqual([
      'guided',
      'troubleshoot',
      'assessment',
    ]);
  });

  it('nilai bawaan rubrik dan petunjuk terisi', () => {
    for (const scenario of scenarios) {
      expect(scenario.rubric.passPct).toBeGreaterThan(0);
      for (const step of scenario.steps) expect(Array.isArray(step.hints)).toBe(true);
    }
  });

  it('mode Cari Gangguan memuat delapan pilihan gangguan dengan tujuh jenis', () => {
    const trouble = scenarios.find((scenario) => scenario.mode === 'troubleshoot');
    expect(trouble?.initialCircuit?.wires.length).toBeGreaterThan(0);
    expect(new Set(trouble?.faults.map((fault) => fault.kind)).size).toBe(7);
  });

  it('mode Asesmen tanpa petunjuk', () => {
    const assessment = scenarios.find((scenario) => scenario.mode === 'assessment');
    expect(assessment?.steps.every((step) => step.hints.length === 0)).toBe(true);
  });
});

describe('sentenceCount', () => {
  it('menghitung kalimat', () => {
    expect(sentenceCount('Satu.')).toBe(1);
    expect(sentenceCount('Satu. Dua! Tiga?')).toBe(3);
    expect(sentenceCount('Tegangan 12,5 V naik.')).toBe(1);
    expect(sentenceCount('')).toBe(0);
  });
});

describe('validateScenario menolak', () => {
  it('tujuan lebih dari dua kalimat', () => {
    const file = { ...raw('offgrid-dc-terpandu'), goal: 'Satu. Dua. Tiga.' };
    expect(issuesOf(file).join()).toContain('goal');
  });

  it('penunjuk terminal tanpa titik dan jenis aturan tak dikenal', () => {
    const file = raw('asesmen-offgrid-dc');
    const steps = file.steps as Record<string, unknown>[];
    steps[0]!.done = { kind: 'connected', a: 'scc', b: 'battery.pos' };
    expect(issuesOf(file).join()).toContain('steps.0.done');
    steps[0]!.done = { kind: 'magic' };
    expect(issuesOf(file).length).toBeGreaterThan(0);
  });

  it('id langkah ganda dan fault-found di luar mode troubleshoot', () => {
    const file = raw('offgrid-dc-terpandu');
    const steps = file.steps as Record<string, unknown>[];
    steps[1]!.id = steps[0]!.id;
    steps[2]!.done = { kind: 'fault-found' };
    const issues = issuesOf(file).join('\n');
    expect(issues).toContain('dipakai lebih dari sekali');
    expect(issues).toContain('fault-found');
  });

  it('gangguan yang sasarannya salah jenis atau tidak ada', () => {
    const file = raw('offgrid-cari-gangguan');
    file.faults = [
      { kind: 'fuse-blown', target: 'bat' },
      { kind: 'wire-open', target: 'w99' },
    ];
    const issues = issuesOf(file).join('\n');
    expect(issues).toContain('faults.0');
    expect(issues).toContain('faults.1');
  });

  it('troubleshoot tanpa rangkaian awal dan paket berbeda', () => {
    const withoutCircuit = raw('offgrid-cari-gangguan');
    delete withoutCircuit.initialCircuit;
    expect(issuesOf(withoutCircuit).join()).toContain('initialCircuit');
    const otherPackage = { ...raw('offgrid-cari-gangguan'), package: 'rek' };
    expect(issuesOf(otherPackage).join()).toContain('packageId');
  });

  it('teks yang bukan JSON', () => {
    expect(parseScenarioText('{', catalog).issues).toEqual(['berkas: bukan JSON yang sah']);
    const text = JSON.stringify(raw('asesmen-offgrid-dc'));
    expect(parseScenarioText(text, catalog).scenario?.id).toBe('asesmen-offgrid-dc');
  });
});
