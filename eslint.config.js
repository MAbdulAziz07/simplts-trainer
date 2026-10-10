import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

// Aturan batas import antarlapisan (docs/ARSITEKTUR.md §3).
// Arah yang diizinkan: features -> ui, store, data, domain, i18n; store -> data, domain;
// data -> domain; domain -> (tidak ada).
const layerPattern = (layers) => `(^@/|/)(${layers.join('|')})(/|$)`;

const forbidLayers = (from, layers, packages = []) => ({
  files: [`src/${from}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            regex: layerPattern(layers),
            message: `src/${from} tidak boleh meng-import ${layers.join(', ')} (docs/ARSITEKTUR.md §3).`,
          },
          ...(packages.length > 0
            ? [
                {
                  group: packages.flatMap((name) => [name, `${name}/*`]),
                  message: `src/${from} harus murni TypeScript, tanpa pustaka tampilan atau state.`,
                },
              ]
            : []),
        ],
      },
    ],
  },
});

const UI_PACKAGES = ['react', 'react-dom', '@xyflow/react', 'zustand', 'motion', 'lucide-react'];

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  },
  forbidLayers('domain', ['features', 'store', 'ui', 'data', 'i18n'], UI_PACKAGES),
  forbidLayers('data', ['features', 'store', 'ui', 'i18n'], UI_PACKAGES),
  forbidLayers('i18n', ['features', 'store', 'ui', 'data', 'domain'], UI_PACKAGES),
  forbidLayers('store', ['features', 'ui']),
  forbidLayers('ui', ['features', 'store']),
]);
