import { describe, expect, it } from 'vitest';
import { HISTORY_LIMIT, emptyHistory, record, redo, undo } from './history';

describe('history', () => {
  it('undo mengembalikan keadaan sebelumnya dan redo mengulanginya', () => {
    const afterA = record(emptyHistory<string>(), 'kosong');
    const afterB = record(afterA, 'a');

    const back = undo(afterB, 'b');
    expect(back?.current).toBe('a');
    const backAgain = undo(back!.history, back!.current);
    expect(backAgain?.current).toBe('kosong');
    expect(undo(backAgain!.history, backAgain!.current)).toBeUndefined();

    const forward = redo(backAgain!.history, backAgain!.current);
    expect(forward?.current).toBe('a');
    expect(redo(forward!.history, forward!.current)?.current).toBe('b');
  });

  it('redo tanpa undo tidak melakukan apa-apa', () => {
    expect(redo(record(emptyHistory<string>(), 'a'), 'b')).toBeUndefined();
  });

  it('perubahan baru menghapus cabang redo', () => {
    const back = undo(record(emptyHistory<string>(), 'a'), 'b')!;
    expect(back.history.future).toEqual(['b']);
    expect(record(back.history, back.current).future).toEqual([]);
  });

  it('membatasi panjang riwayat dan tidak mengubah masukan', () => {
    const start = emptyHistory<number>();
    let history = start;
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) history = record(history, i);
    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.past.at(-1)).toBe(HISTORY_LIMIT + 19);
    expect(start).toEqual({ past: [], future: [] });
  });
});
