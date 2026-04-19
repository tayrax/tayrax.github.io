// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import './app.css';
import App from './App.svelte';
import { watchForUpdates } from './lib/sw-update';

const target = document.getElementById('app');
if (!target) throw new Error('#app root not found');

const app = new App({ target });

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => { watchForUpdates(registration); })
      .catch(() => {
        // registration failures are non-fatal
      });
  });
}

export default app;
