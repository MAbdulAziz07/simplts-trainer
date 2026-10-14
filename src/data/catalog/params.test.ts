import { describe, expect, it } from 'vitest';
import { PARAM_SPECS, paramSpecsOf, paramValue } from '@/domain';
import { loadCatalog } from './index';

// Field opsional di katalog (docs/KATALOG.md §6.4): tidak semua item memilikinya.
const OPTIONAL_KEYS = new Set(['battery.dischargeA']);

describe('parameter yang bisa diatur cocok dengan katalog', () => {
  it.each(loadCatalog().map((item) => [item.id, item] as const))('%s', (_id, item) => {
    const present = paramSpecsOf(item).map((spec) => spec.key);
    const required = PARAM_SPECS[item.category]
      .map((spec) => spec.key)
      .filter((key) => !OPTIONAL_KEYS.has(`${item.category}.${key}`));
    for (const key of required) expect(present).toContain(key);
    for (const spec of paramSpecsOf(item)) {
      const value = paramValue(item, spec);
      if (spec.kind === 'number') expect(typeof value).toBe('number');
      if (spec.kind === 'choice') expect(spec.options).toContain(value);
    }
  });
});
