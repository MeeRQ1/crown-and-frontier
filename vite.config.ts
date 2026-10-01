import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// Relative base so the same build works at a domain root, a GitHub Pages
// project subpath, inside an iframe, or unzipped on any static host.
export default defineConfig({
  base: './',
  // the game version, shown in settings and recorded in bug reports
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173 },
});
