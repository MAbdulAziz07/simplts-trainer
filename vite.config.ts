import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // PORT diisi oleh peluncur pratinjau saat 5173 sudah dipakai; --port di CLI tetap menang.
  server: { port: Number(process.env.PORT) || 5173 },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
