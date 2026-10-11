// Menjaga teks temuan di src/i18n/id.ts selaras dengan kode temuan di src/domain. Ditaruh di
// features karena domain dan i18n tidak boleh saling meng-import (docs/ARSITEKTUR.md §3).
import { describe, expect, it } from 'vitest';
import { FINDING_CODES, FINDING_SEVERITIES } from '@/domain';
import { t } from '@/i18n';

const MAX_MESSAGE_WORDS = 8;

describe('teks temuan', () => {
  it('setiap kode temuan punya teks, tanpa kode berlebih', () => {
    expect(Object.keys(t.findings).sort()).toEqual([...FINDING_CODES].sort());
    expect(Object.keys(t.severities).sort()).toEqual([...FINDING_SEVERITIES].sort());
  });

  it.each(FINDING_CODES)('%s: pesan maksimal 8 kata dan ada penjelasan', (code) => {
    const { message, explanation } = t.findings[code];
    expect(message.trim().split(/\s+/).length).toBeLessThanOrEqual(MAX_MESSAGE_WORDS);
    expect(explanation.length).toBeGreaterThan(message.length);
  });
});
