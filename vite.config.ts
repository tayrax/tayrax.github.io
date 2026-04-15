import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as { version: string };

const now = new Date();
const pad = (n: number, len = 2): string => String(n).padStart(len, '0');
const buildStamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

export default defineConfig(({ mode }) => ({
  plugins: [svelte({ configFile: resolve(__dirname, 'svelte.config.js') })],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(mode === 'development' ? 'devel' : buildStamp),
  },
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
}));
