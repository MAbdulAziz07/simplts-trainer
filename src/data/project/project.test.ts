import { describe, expect, it } from 'vitest';
import { loadCatalog } from '../catalog';
import { PROJECT_FORMAT_VERSION, type ProjectFile } from './schema';
import { validateProject } from './validate';

const catalog = loadCatalog();

function project(change: (draft: ProjectFile) => void = () => {}): ProjectFile {
  const draft: ProjectFile = {
    app: 'simplts',
    formatVersion: PROJECT_FORMAT_VERSION,
    packageId: 'min',
    components: [
      { id: 'pv1', catalogId: 'pv-generic-100wp', xPx: 48, yPx: 48, rotationDeg: 0 },
      { id: 'mcb1', catalogId: 'mcb-dc-16a', xPx: 240, yPx: 48, rotationDeg: 90 },
    ],
    wires: [
      {
        id: 'w1',
        from: { componentId: 'pv1', terminalId: 'pos' },
        to: { componentId: 'mcb1', terminalId: 'pos-in' },
        cableId: 'cable-pv-h1z2z2k',
        areaMm2: 4,
        lengthM: 2,
      },
    ],
    closedSwitchIds: ['mcb1'],
  };
  change(draft);
  return draft;
}

describe('validateProject', () => {
  it('menerima proyek yang sah dan mengembalikannya', () => {
    const result = validateProject(project(), catalog);
    expect(result.issues).toEqual([]);
    expect(result.rejection).toBeUndefined();
    expect(result.project).toEqual(project());
  });

  it('menerima meja kosong', () => {
    const empty = project((draft) => {
      draft.components = [];
      draft.wires = [];
      draft.closedSwitchIds = [];
    });
    expect(validateProject(empty, catalog).project).toEqual(empty);
  });

  it.each([null, 'teks', 42, [], {}, { app: 'lain', formatVersion: 1 }])(
    'menolak %j sebagai bukan proyek',
    (raw) => {
      expect(validateProject(raw, catalog).rejection).toBe('not-project');
    },
  );

  it('menolak versi format lain dengan sebab tersendiri', () => {
    const result = validateProject({ ...project(), formatVersion: 2 }, catalog);
    expect(result.rejection).toBe('unsupported-version');
    expect(result.project).toBeUndefined();
  });

  const invalid: [string, (draft: ProjectFile) => void][] = [
    ['field tak dikenal', (draft) => Object.assign(draft, { extra: 1 })],
    [
      'rotasi bukan kelipatan 90',
      (draft) => Object.assign(draft.components[0]!, { rotationDeg: 45 }),
    ],
    ['panjang kabel nol', (draft) => (draft.wires[0]!.lengthM = 0)],
    ['penampang negatif', (draft) => (draft.wires[0]!.areaMm2 = -4)],
    ['id komponen ganda', (draft) => (draft.components[1]!.id = 'pv1')],
    ['id kabel ganda', (draft) => draft.wires.push({ ...draft.wires[0]!, lengthM: 3 })],
    ['item katalog tak dikenal', (draft) => (draft.components[0]!.catalogId = 'pv-tidak-ada')],
    [
      'kabel dipakai sebagai komponen',
      (draft) => (draft.components[0]!.catalogId = 'cable-nyy-2core'),
    ],
    ['kabel ke komponen yang tidak ada', (draft) => (draft.wires[0]!.to.componentId = 'hilang')],
    ['kabel ke terminal yang tidak ada', (draft) => (draft.wires[0]!.from.terminalId = 'l-in')],
    ['jenis kabel bukan kabel', (draft) => (draft.wires[0]!.cableId = 'mcb-dc-16a')],
    ['sakelar ON yang tidak ada', (draft) => draft.closedSwitchIds.push('mcb9')],
  ];
  it.each(invalid)('menolak %s', (_name, change) => {
    const result = validateProject(project(change), catalog);
    expect(result.rejection).toBe('invalid');
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.project).toBeUndefined();
  });
});

describe('validateProject — setelan daya beban', () => {
  const load = { id: 'l1', catalogId: 'load-dc-12v-200w', xPx: 0, yPx: 0, rotationDeg: 0 } as const;

  it('menerima powerSettingW pada beban; berkas tanpa field itu tetap sah', () => {
    const withSetting = project((draft) => draft.components.push({ ...load, powerSettingW: 60 }));
    expect(validateProject(withSetting, catalog).issues).toEqual([]);
    expect(validateProject(withSetting, catalog).project?.components[2]?.powerSettingW).toBe(60);
    const without = project((draft) => draft.components.push({ ...load }));
    expect(validateProject(without, catalog).issues).toEqual([]);
  });

  it('menolak powerSettingW pada komponen bukan beban dan nilai negatif', () => {
    const onPanel = project((draft) => {
      const [panel] = draft.components;
      if (panel) draft.components[0] = { ...panel, powerSettingW: 60 };
    });
    expect(validateProject(onPanel, catalog).issues).toEqual([
      'components.pv1: powerSettingW hanya untuk beban',
    ]);
    const negative = project((draft) => draft.components.push({ ...load, powerSettingW: -5 }));
    expect(validateProject(negative, catalog).rejection).toBe('invalid');
  });
});
