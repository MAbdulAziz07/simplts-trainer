import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { terminalEditorPlugin } from './vite-plugins/terminal-editor.ts';

export default defineConfig({
  // Alamat relatif: hasil build bisa disajikan dari subfolder, mis. GitHub Pages /SimPLTS/.
  base: './',
  plugins: [react(), tailwindcss(), terminalEditorPlugin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // PORT diisi oleh peluncur pratinjau saat 5173 sudah dipakai; --port di CLI tetap menang.
  server: { port: Number(process.env.PORT) || 5173 },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
