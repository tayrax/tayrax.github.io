// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { writable, type Readable } from 'svelte/store';
import { getBotClient } from './bot-client';
import {
  loadAlertsFromStorage,
  type NewAlert,
  type StoredAlert
} from './alert-core';

export type {
  AlertRule,
  AlertKind,
  NewAlert,
  StoredAlert,
  Evaluation,
  EvalContext
} from './alert-core';

export { evaluate, getAlertInterval } from './alert-core';

// The alerts store is a tab-side mirror of the worker's authoritative list.
// It is hydrated from localStorage at module load so the first render has
// data without waiting for the worker's initial `alertList` broadcast, then
// overwritten by worker broadcasts.
const _store = writable<StoredAlert[]>(loadAlertsFromStorage());

export const alerts: Readable<StoredAlert[]> = { subscribe: _store.subscribe };

export const _applyAlertList = (list: StoredAlert[]): void => {
  _store.set(list);
};

// Wire the bot-client subscription once at module load. Calling getBotClient()
// here creates the SharedWorker on first tab module evaluation.
if (typeof window !== 'undefined') {
  getBotClient().subscribe((msg) => {
    if (msg.type === 'alertList') _applyAlertList(msg.alerts);
  });
}

export const addAlert = (rule: NewAlert): void => {
  getBotClient().post({ type: 'addAlert', rule });
};

export const removeAlert = (id: string): void => {
  getBotClient().post({ type: 'removeAlert', id });
};
