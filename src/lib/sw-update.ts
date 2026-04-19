// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { writable, type Readable } from 'svelte/store';
import { SW_UPDATE_INTERVAL_MS } from './config';

const _updateWaiting = writable(false);
export const updateWaiting: Readable<boolean> = _updateWaiting;

let reg: ServiceWorkerRegistration | null = null;

function onInstallingStateChange(installing: ServiceWorker): void {
  installing.addEventListener('statechange', () => {
    if (installing.state === 'installed' && navigator.serviceWorker.controller) {
      _updateWaiting.set(true);
    }
  });
}

function onUpdateFound(): void {
  const installing = reg?.installing;
  if (!installing) return;
  onInstallingStateChange(installing);
}

export function watchForUpdates(registration: ServiceWorkerRegistration): void {
  reg = registration;

  if (registration.waiting && navigator.serviceWorker.controller) {
    _updateWaiting.set(true);
  }

  registration.addEventListener('updatefound', onUpdateFound);
  setInterval(() => { reg?.update().catch(() => null); }, SW_UPDATE_INTERVAL_MS);
}

export function applyUpdate(): void {
  const waiting = reg?.waiting;
  if (!waiting) return;
  _updateWaiting.set(false);
  waiting.postMessage('SKIP_WAITING');
  navigator.serviceWorker.addEventListener('controllerchange', () => { location.reload(); }, { once: true });
}
