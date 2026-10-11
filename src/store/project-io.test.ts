import { describe, expect, it } from 'vitest';
import { catalogItems } from './catalog';
import { EMPTY_DOC, addPart, addWire, type CircuitDoc } from './circuit-doc';
import {
  AUTOSAVE_KEY,
  docToProject,
  parseProjectText,
  projectToDoc,
  readAutosave,
  serializeProject,
  writeAutosave,
} from './project-io';

function sample(): CircuitDoc {
  const pv = { id: 'pv-generic-100wp', category: 'pv-module' } as const;
  const fuse = { id: 'fuse-pv-15a', category: 'fuse' } as const;
  let doc = addPart(EMPTY_DOC, pv, { xPx: 48, yPx: 48 }).doc;
  doc = addPart(doc, fuse, { xPx: 240, yPx: 48 }).doc;
  return addWire(doc, {
    from: { componentId: 'c1', terminalId: 'pos' },
    to: { componentId: 'c2', terminalId: 'pos-in' },
    cableId: 'cable-pv-h1z2z2k',
    areaMm2: 4,
    lengthM: 2,
  }).doc;
}

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

describe('berkas proyek', () => {
  it('simpan lalu buka menghasilkan dokumen dan paket yang sama', () => {
    const text = serializeProject(sample(), 'rek');
    const { project, issues } = parseProjectText(text, catalogItems);
    expect(issues).toEqual([]);
    expect(project?.packageId).toBe('rek');
    expect(projectToDoc(project!)).toEqual(sample());
  });

  it('memuat nomor versi format', () => {
    expect(docToProject(EMPTY_DOC, 'min')).toMatchObject({ app: 'simplts', formatVersion: 1 });
  });

  it('menolak teks yang bukan JSON atau bukan proyek', () => {
    expect(parseProjectText('{ rusak', catalogItems).rejection).toBe('not-project');
    expect(parseProjectText('[1, 2]', catalogItems).rejection).toBe('not-project');
  });

  it('menolak versi format lain', () => {
    const text = serializeProject(sample(), 'min').replace(
      '"formatVersion": 1',
      '"formatVersion": 9',
    );
    expect(parseProjectText(text, catalogItems).rejection).toBe('unsupported-version');
  });
});

describe('simpan otomatis', () => {
  it('membaca kembali yang ditulis', () => {
    const storage = memoryStorage();
    const autosave = { project: docToProject(sample(), 'min'), level: 'expert' as const };
    writeAutosave(storage, autosave);
    expect(readAutosave(storage, catalogItems)).toEqual(autosave);
  });

  it('mengabaikan simpanan kosong, rusak, atau tidak sah', () => {
    expect(readAutosave(memoryStorage(), catalogItems)).toBeUndefined();
    expect(readAutosave(undefined, catalogItems)).toBeUndefined();
    const broken = memoryStorage({ [AUTOSAVE_KEY]: '{ rusak' });
    expect(readAutosave(broken, catalogItems)).toBeUndefined();
    const stale = JSON.stringify({ project: docToProject(sample(), 'min'), level: 'beginner' });
    expect(readAutosave(memoryStorage({ [AUTOSAVE_KEY]: stale }), [])).toBeUndefined();
  });

  it('tingkat yang tidak dikenal kembali ke pemula', () => {
    const raw = JSON.stringify({ project: docToProject(EMPTY_DOC, 'min'), level: 'dewa' });
    const storage = memoryStorage({ [AUTOSAVE_KEY]: raw });
    expect(readAutosave(storage, catalogItems)?.level).toBe('beginner');
  });

  it('tidak melempar galat bila penyimpanan penuh atau tidak ada', () => {
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('penuh');
      },
    };
    const autosave = { project: docToProject(EMPTY_DOC, 'min'), level: 'beginner' as const };
    expect(() => writeAutosave(full, autosave)).not.toThrow();
    expect(() => writeAutosave(undefined, autosave)).not.toThrow();
  });
});
