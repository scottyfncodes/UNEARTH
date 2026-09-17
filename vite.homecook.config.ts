import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/**
 * HomeCook builds separately from the game and lands in `dist/homecook`, so a
 * single Pages deploy serves both: UNEARTH at the site root, HomeCook one
 * level down. `base: './'` keeps every asset path relative, which is what lets
 * the same build run from a sub-path.
 */
export default defineConfig({
  root: fileURLToPath(new URL('./homecook', import.meta.url)),
  base: './',
  plugins: [react()],
  resolve: {
    alias: { '@homecook': fileURLToPath(new URL('./homecook/src', import.meta.url)) },
  },
  build: {
    outDir: fileURLToPath(new URL('./dist/homecook', import.meta.url)),
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
  },
  server: { host: true, port: 5174 },
});
