import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [svelte({ configFile: resolve(__dirname, 'svelte.config.js') })],
  root: resolve(__dirname, 'html'),
  publicDir: resolve(__dirname, 'static'),
  base: '/',
  build: {
    outDir: resolve(__dirname, 'dist'),
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'html/index.html'),
        system: resolve(__dirname, 'html/system.html'),
      },
    },
  },
});
