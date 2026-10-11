import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// base './' makes the build work from any sub-path (GitHub Pages project sites, any static server).
export default defineConfig({
  base: './',
  plugins: [preact()],
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 8192,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Separate long-lived chunks so code updates don't invalidate the narrative/art caches.
        manualChunks(id: string) {
          if (id.includes('node_modules')) return 'vendor';
          if (id.includes('/src/i18n/ru/')) return 'lang-ru';
          // The i18n core must not share a chunk with modules that call t() at load time (art, content):
          // the entry imports it before the language is set (see src/main.tsx).
          if (id.includes('/src/i18n/')) return 'i18n';
          if (id.includes('/src/content/')) return 'content';
          if (id.includes('/src/art/')) return 'art';
          return undefined;
        },
      },
    },
  },
  server: { host: true, port: 5173 },
  test: { include: ['tests/**/*.test.ts'] },
} as any);
