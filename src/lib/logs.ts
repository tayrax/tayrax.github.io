// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { writable, type Readable } from 'svelte/store';
import { LOG_MAX_ENTRIES, STORAGE_KEYS } from './config';

export type LogKind = 'alertDispatched';

export type LogData = Record<string, string | number | boolean>;

export type LogEntry = {
  id: string;
  ts: number;
  kind: LogKind;
  asset?: string;
  message: string;
  data?: LogData;
};

type StoredPayload = { version: 1; entries: LogEntry[] };

const loadLogs = (): LogEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.logs);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredPayload;
    if (parsed?.version !== 1 || !Array.isArray(parsed.entries)) return [];
    return parsed.entries;
  } catch {
    return [];
  }
};

const persist = (entries: LogEntry[]): void => {
  const payload: StoredPayload = { version: 1, entries };
  try {
    localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(payload));
  } catch {
    // ignore
  }
};

const store = writable<LogEntry[]>(loadLogs());

export const logs: Readable<LogEntry[]> = { subscribe: store.subscribe };

const makeId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const logAction = (entry: Omit<LogEntry, 'id' | 'ts'>): void => {
  store.update((list) => {
    const next: LogEntry = { ...entry, id: makeId(), ts: Date.now() };
    const out = [next, ...list].slice(0, LOG_MAX_ENTRIES);
    persist(out);
    return out;
  });
};

export const clearLogs = (): void => {
  store.set([]);
  persist([]);
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key !== STORAGE_KEYS.logs) return;
    store.set(loadLogs());
  });
}
