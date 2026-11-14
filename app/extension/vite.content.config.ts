import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('./src/content/youtube.ts', import.meta.url)),
      formats: ['iife'],
      name: 'AudioMintContent',
      fileName: () => 'content.js',
    },
  },
});
