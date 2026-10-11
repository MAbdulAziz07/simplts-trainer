import { describe, expect, it } from 'vitest';
import { hasCatalogItem, roundPct, setTerminalPositions } from './terminal-positions';

// Meniru format tulisan tangan src/data/catalog/*.json: satu terminal per baris.
const TEXT = `{
  "schemaVersion": 1,
  "file": "contoh",
  "items": [
    {
      "id": "scc-a",
      "category": "scc-pwm",
      "electrical": {"batteryVoltagesV": [12, 24], "floatV": 13.7},
      "terminals": [
        {"id": "pv-pos", "label": "PV+", "kind": "pv+", "xPct": 0, "yPct": 0, "maxWires": 1},
        {"id": "pv-neg", "label": "PV−", "kind": "pv-", "xPct": 0, "yPct": 0, "maxWires": 1}
      ],
      "image": "src/assets/components/scc-pwm.webp"
    },
    {
      "id": "scc-b",
      "category": "scc-mppt",
      "terminals": [
        {"id": "pv-pos", "label": "PV+", "kind": "pv+", "xPct": 12.5, "yPct": 80, "maxWires": 1}
      ],
      "image": "src/assets/components/scc-mppt.webp"
    }
  ]
}
`;

interface ParsedFile {
  items: { id: string; terminals: { id: string; xPct: number; yPct: number }[] }[];
}
const terminalsOf = (text: string, itemId: string) =>
  (JSON.parse(text) as ParsedFile).items.find((item) => item.id === itemId)?.terminals;

describe('roundPct', () => {
  it('membulatkan ke satu desimal dan menjaga rentang 0–100', () => {
    expect(roundPct(33.333)).toBe(33.3);
    expect(roundPct(66.666)).toBe(66.7);
    expect(roundPct(-5)).toBe(0);
    expect(roundPct(140)).toBe(100);
  });
});

describe('hasCatalogItem', () => {
  it('mengenali id item, bukan id terminal', () => {
    expect(hasCatalogItem(TEXT, 'scc-a')).toBe(true);
    expect(hasCatalogItem(TEXT, 'scc-b')).toBe(true);
    expect(hasCatalogItem(TEXT, 'pv-pos')).toBe(false);
    expect(hasCatalogItem(TEXT, 'scc')).toBe(false);
  });
});

describe('setTerminalPositions', () => {
  it('mengganti hanya angka posisi terminal yang disebut', () => {
    const result = setTerminalPositions(TEXT, 'scc-a', [{ id: 'pv-neg', xPct: 41.26, yPct: 88 }]);
    expect(terminalsOf(result, 'scc-a')).toMatchObject([
      { id: 'pv-pos', xPct: 0, yPct: 0 },
      { id: 'pv-neg', xPct: 41.3, yPct: 88 },
    ]);
    expect(result).toBe(
      TEXT.replace(
        '"kind": "pv-", "xPct": 0, "yPct": 0',
        '"kind": "pv-", "xPct": 41.3, "yPct": 88',
      ),
    );
  });

  it('tidak menyentuh terminal ber-id sama milik item lain', () => {
    const result = setTerminalPositions(TEXT, 'scc-b', [{ id: 'pv-pos', xPct: 50, yPct: 60 }]);
    expect(terminalsOf(result, 'scc-b')).toMatchObject([{ id: 'pv-pos', xPct: 50, yPct: 60 }]);
    expect(terminalsOf(result, 'scc-a')).toEqual(terminalsOf(TEXT, 'scc-a'));
  });

  it('mengganti beberapa terminal sekaligus dan bisa diulang', () => {
    const once = setTerminalPositions(TEXT, 'scc-a', [
      { id: 'pv-pos', xPct: 10, yPct: 90 },
      { id: 'pv-neg', xPct: 20, yPct: 90 },
    ]);
    const twice = setTerminalPositions(once, 'scc-a', [{ id: 'pv-pos', xPct: 15, yPct: 85 }]);
    expect(terminalsOf(twice, 'scc-a')).toMatchObject([
      { id: 'pv-pos', xPct: 15, yPct: 85 },
      { id: 'pv-neg', xPct: 20, yPct: 90 },
    ]);
  });

  it('tanpa posisi mengembalikan teks yang sama', () => {
    expect(setTerminalPositions(TEXT, 'scc-a', [])).toBe(TEXT);
  });

  it('melempar galat untuk item, terminal, atau angka yang tidak sah', () => {
    expect(() => setTerminalPositions(TEXT, 'tidak-ada', [])).toThrow(/Item/);
    expect(() => setTerminalPositions(TEXT, 'scc-b', [{ id: 'pv-neg', xPct: 1, yPct: 1 }])).toThrow(
      /Terminal/,
    );
    expect(() =>
      setTerminalPositions(TEXT, 'scc-a', [{ id: 'pv-pos', xPct: Number.NaN, yPct: 1 }]),
    ).toThrow(/bukan angka/);
  });
});
