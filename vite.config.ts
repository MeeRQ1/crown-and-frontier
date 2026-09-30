import { defineConfig } from 'vite';

// Relative base so the same build works at a domain root, a GitHub Pages
// project subpath, inside an iframe, or unzipped on any static host.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173 },
});
