import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Served from https://subir-uipl.github.io/lumen/, so every internal link goes through BASE_URL.
export default defineConfig({
  site: 'https://subir-uipl.github.io',
  base: '/lumen',
  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          // three.js is by far the largest dependency; keep it in its own long-cached chunk
          manualChunks: id => (id.includes('node_modules/three') ? 'three' : undefined)
        }
      }
    }
  }
});
