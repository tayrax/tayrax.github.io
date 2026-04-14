import { writable, type Readable } from 'svelte/store';
import { ALERT_COOLDOWN_MS, STORAGE_KEYS } from './config';
import { pctChangeOverWindow, type PriceState } from './prices';

export type AlertRule =
  | { id: string; asset: string; kind: 'above'; value: number }
  | { id: string; asset: string; kind: 'below'; value: number }
  | { id: string; asset: string; kind: 'range'; low: number; high: number }
  | { id: string; asset: string; kind: 'pctChange'; value: number };

export type StoredAlert = AlertRule & { lastFiredAt: number | null };

export type AlertKind = AlertRule['kind'];

export type NewAlert = AlertRule extends infer R ? (R extends AlertRule ? Omit<R, 'id'> : never) : never;

type StoredPayload = { version: 1; alerts: StoredAlert[] };

const loadAlerts = (): StoredAlert[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.alerts);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredPayload;
    if (parsed?.version !== 1 || !Array.isArray(parsed.alerts)) return [];
    return parsed.alerts;
  } catch {
    return [];
  }
};

const persist = (alerts: StoredAlert[]): void => {
  const payload: StoredPayload = { version: 1, alerts };
  try {
    localStorage.setItem(STORAGE_KEYS.alerts, JSON.stringify(payload));
  } catch {
    // ignore
  }
};

const store = writable<StoredAlert[]>(loadAlerts());

export const alerts: Readable<StoredAlert[]> = { subscribe: store.subscribe };

const makeId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const addAlert = (rule: NewAlert): void => {
  store.update((list) => {
    const next = { ...rule, id: makeId(), lastFiredAt: null } as StoredAlert;
    const out = [...list, next];
    persist(out);
    return out;
  });
};

export const removeAlert = (id: string): void => {
  store.update((list) => {
    const out = list.filter((a) => a.id !== id);
    persist(out);
    return out;
  });
};

export const markFired = (id: string, at: number): void => {
  store.update((list) => {
    const out = list.map((a) => (a.id === id ? { ...a, lastFiredAt: at } : a));
    persist(out);
    return out;
  });
};

export type Evaluation = { alert: StoredAlert; message: string };

export const evaluate = (alert: StoredAlert, state: PriceState, now: number): Evaluation | null => {
  if (alert.lastFiredAt !== null && now - alert.lastFiredAt < ALERT_COOLDOWN_MS) return null;

  const fmt = (n: number): string =>
    n >= 100 ? n.toFixed(2) : n >= 1 ? n.toFixed(4) : n.toPrecision(4);

  switch (alert.kind) {
    case 'above':
      return state.price > alert.value
        ? { alert, message: `${alert.asset} is above $${fmt(alert.value)} (now $${fmt(state.price)})` }
        : null;
    case 'below':
      return state.price < alert.value
        ? { alert, message: `${alert.asset} is below $${fmt(alert.value)} (now $${fmt(state.price)})` }
        : null;
    case 'range': {
      const inRange = state.price >= alert.low && state.price <= alert.high;
      return inRange
        ? {
            alert,
            message: `${alert.asset} is in range $${fmt(alert.low)}–$${fmt(alert.high)} (now $${fmt(state.price)})`
          }
        : null;
    }
    case 'pctChange': {
      const pct = pctChangeOverWindow(state);
      if (pct === null) return null;
      return Math.abs(pct) >= Math.abs(alert.value)
        ? {
            alert,
            message: `${alert.asset} moved ${pct.toFixed(2)}% in the last hour (threshold ${alert.value}%)`
          }
        : null;
    }
  }
};
