// Hanya untuk server pengembangan: menerima posisi terminal dari halaman /dev/terminal-editor
// dan menuliskannya ke src/data/catalog/*.json. Tidak ikut ke build produksi.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import path from 'node:path';
import type { Plugin } from 'vite';
import {
  hasCatalogItem,
  setTerminalPositions,
  type TerminalPosition,
} from '../src/data/catalog/terminal-positions.ts';

export const TERMINAL_POSITIONS_ENDPOINT = '/__dev/terminal-positions';

interface ItemPositions {
  itemId: string;
  terminals: TerminalPosition[];
}

const CATALOG_DIR = 'src/data/catalog';
const MAX_BODY_BYTES = 200_000;

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error('Isi permintaan terlalu besar');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseRequest(body: string): ItemPositions[] {
  const raw = JSON.parse(body) as { items?: unknown };
  if (!Array.isArray(raw.items)) throw new Error('Butuh { items: [...] }');
  return raw.items.map((entry: { itemId?: unknown; terminals?: unknown }) => {
    if (typeof entry.itemId !== 'string' || !Array.isArray(entry.terminals))
      throw new Error('Tiap entri butuh itemId dan terminals');
    const terminals = entry.terminals.map((terminal: Partial<TerminalPosition>) => {
      const { id, xPct, yPct } = terminal;
      if (typeof id !== 'string' || typeof xPct !== 'number' || typeof yPct !== 'number')
        throw new Error(`Posisi terminal ${entry.itemId as string} tidak sah`);
      return { id, xPct, yPct };
    });
    return { itemId: entry.itemId, terminals };
  });
}

/** Menulis posisi ke berkas katalog yang memuat tiap item; mengembalikan id item yang tersimpan. */
async function savePositions(root: string, items: readonly ItemPositions[]): Promise<string[]> {
  const dir = path.join(root, CATALOG_DIR);
  const saved: string[] = [];
  for (const name of (await readdir(dir)).filter((file) => file.endsWith('.json'))) {
    const file = path.join(dir, name);
    const original = await readFile(file, 'utf8');
    let text = original;
    for (const item of items) {
      if (!hasCatalogItem(text, item.itemId)) continue;
      text = setTerminalPositions(text, item.itemId, item.terminals);
      saved.push(item.itemId);
    }
    if (text !== original) {
      JSON.parse(text);
      await writeFile(file, text, 'utf8');
    }
  }
  const missing = items.filter((item) => !saved.includes(item.itemId));
  if (missing.length > 0)
    throw new Error(`Item tidak ada di katalog: ${missing.map((item) => item.itemId).join(', ')}`);
  return saved;
}

export function terminalEditorPlugin(): Plugin {
  return {
    name: 'simplts-terminal-editor',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(TERMINAL_POSITIONS_ENDPOINT, (request, response) => {
        const reply = (status: number, body: object) => {
          response.statusCode = status;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(body));
        };
        if (request.method !== 'POST') return reply(405, { error: 'Hanya POST' });
        // Halaman dari asal lain tidak bisa mengirim JSON tanpa izin CORS.
        if (!request.headers['content-type']?.startsWith('application/json'))
          return reply(415, { error: 'Butuh Content-Type application/json' });
        readBody(request)
          .then((body) => savePositions(server.config.root, parseRequest(body)))
          .then((saved) => reply(200, { saved }))
          .catch((error: unknown) =>
            reply(400, { error: error instanceof Error ? error.message : String(error) }),
          );
      });
    },
  };
}
