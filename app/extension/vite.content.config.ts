import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('./public/content.js', import.meta.url)),
      formats: ['iife'],
      name: 'AudioMintContent',
      fileName: () => 'content.js',
    },
  },
});
