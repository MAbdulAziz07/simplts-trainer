// Domain dan i18n tidak boleh saling meng-import, jadi kesesuaian alasan penolakan dengan teksnya
// diuji dari lapisan fitur.
import { describe, expect, it } from 'vitest';
import { CONNECTION_LEVELS, CONNECTION_REJECTIONS } from '@/domain';
import { t } from '@/i18n';

const MAX_WORDS = 8;

describe('teks penolakan sambungan', () => {
  it('ada tepat satu teks untuk setiap alasan `checkConnection`', () => {
    expect(Object.keys(t.connectionRejections).sort()).toEqual([...CONNECTION_REJECTIONS].sort());
  });

  it.each(CONNECTION_REJECTIONS)('%s: satu kalimat singkat tanpa titik', (reason) => {
    const text = t.connectionRejections[reason];
    expect(text.split(/\s+/).length).toBeLessThanOrEqual(MAX_WORDS);
    expect(text).not.toMatch(/[.!?]/);
  });

  it('setiap tingkat validasi punya nama dan keterangan', () => {
    expect(Object.keys(t.levels).sort()).toEqual([...CONNECTION_LEVELS].sort());
    expect(Object.keys(t.levelHints).sort()).toEqual([...CONNECTION_LEVELS].sort());
  });
});
