import { defineConfig } from 'vite';

export default defineConfig({
  // relative base so the build works on any host / sub-path (GitHub Pages, Netlify, Vercel…)
  base: './',
  server: { host: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
});
