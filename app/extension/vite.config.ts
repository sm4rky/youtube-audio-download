import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import manifest from './public/manifest.json' with { type: 'json' };

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'VITE_');
  const apiUrl = new URL(
    environment.VITE_API_BASE_URL?.trim() || 'http://localhost:3001/api/v1',
  );
  if (
    !['http:', 'https:'].includes(apiUrl.protocol) ||
    apiUrl.username || apiUrl.password || apiUrl.search || apiUrl.hash
  ) {
    throw new Error(
      'VITE_API_BASE_URL must be an HTTP(S) URL without credentials, query or fragment.',
    );
  }
  return {
    base: './',
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'react-vendor',
                test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              },
            ],
          },
        },
      },
    },
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiUrl.href.replace(/\/+$/, '')),
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'audiomint-api-host-permission',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'manifest.json',
            source: JSON.stringify(
              {
                ...manifest,
                host_permissions: [apiUrl.origin + '/*'],
              },
              null,
              2,
            ),
          });
        },
      },
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
  };
});
