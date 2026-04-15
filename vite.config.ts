import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [svelte({ configFile: resolve(__dirname, 'svelte.config.js') })],
  publicDir: resolve(__dirname, 'static'),
  base: '/',
  build: {
    outDir: resolve(__dirname, 'dist'),
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        system: resolve(__dirname, 'system/index.html'),
        logs: resolve(__dirname, 'logs/index.html'),
      },
    },
  },
});
