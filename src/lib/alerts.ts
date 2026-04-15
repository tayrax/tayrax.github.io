// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { writable, type Readable } from 'svelte/store';
import { ALERT_COOLDOWN_MS, STORAGE_KEYS } from './config';
import { pctChangeOverWindow, type PriceState } from './prices';
import { volumeSpikeRatio, type VolumeState } from './volumes';
import type { IndicatorValues } from './indicators';

export type AlertRule =
  | { id: string; asset: string; kind: 'above'; value: number }
  | { id: string; asset: string; kind: 'below'; value: number }
  | { id: string; asset: string; kind: 'range'; low: number; high: number }
  | { id: string; asset: string; kind: 'pctChange'; value: number }
  | { id: string; asset: string; kind: 'volumeSpike'; multiplier: number }
  | { id: string; asset: string; kind: 'rsiBelow'; value: number }
  | { id: string; asset: string; kind: 'rsiAbove'; value: number }
  | { id: string; asset: string; kind: 'macdCross'; direction: 'bullish' | 'bearish' }
  | { id: string; asset: string; kind: 'bbBreakout'; direction: 'above' | 'below' };

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

export type EvalContext = { price?: PriceState; volume?: VolumeState; indicators?: IndicatorValues };

export const evaluate = (alert: StoredAlert, ctx: EvalContext, now: number): Evaluation | null => {
  if (alert.lastFiredAt !== null && now - alert.lastFiredAt < ALERT_COOLDOWN_MS) return null;

  const fmt = (n: number): string =>
    n >= 100 ? n.toFixed(2) : n >= 1 ? n.toFixed(4) : n.toPrecision(4);

  switch (alert.kind) {
    case 'above': {
      if (!ctx.price) return null;
      return ctx.price.price > alert.value
        ? { alert, message: `${alert.asset} is above $${fmt(alert.value)} (now $${fmt(ctx.price.price)})` }
        : null;
    }
    case 'below': {
      if (!ctx.price) return null;
      return ctx.price.price < alert.value
        ? { alert, message: `${alert.asset} is below $${fmt(alert.value)} (now $${fmt(ctx.price.price)})` }
        : null;
    }
    case 'range': {
      if (!ctx.price) return null;
      const inRange = ctx.price.price >= alert.low && ctx.price.price <= alert.high;
      return inRange
        ? {
            alert,
            message: `${alert.asset} is in range $${fmt(alert.low)}–$${fmt(alert.high)} (now $${fmt(ctx.price.price)})`
          }
        : null;
    }
    case 'pctChange': {
      if (!ctx.price) return null;
      const pct = pctChangeOverWindow(ctx.price);
      if (pct === null) return null;
      return Math.abs(pct) >= Math.abs(alert.value)
        ? {
            alert,
            message: `${alert.asset} moved ${pct.toFixed(2)}% in the last hour (threshold ${alert.value}%)`
          }
        : null;
    }
    case 'volumeSpike': {
      if (!ctx.volume) return null;
      const ratio = volumeSpikeRatio(ctx.volume);
      if (ratio === null) return null;
      return ratio >= alert.multiplier
        ? {
            alert,
            message: `${alert.asset} 1m volume spike: ${ratio.toFixed(2)}× median (threshold ${alert.multiplier}×)`
          }
        : null;
    }
    case 'rsiBelow': {
      if (!ctx.indicators) return null;
      const { rsi14 } = ctx.indicators;
      if (rsi14 === null) return null;
      return rsi14 < alert.value
        ? { alert, message: `${alert.asset} RSI(14) is ${rsi14.toFixed(1)} (below ${alert.value} — oversold)` }
        : null;
    }
    case 'rsiAbove': {
      if (!ctx.indicators) return null;
      const { rsi14 } = ctx.indicators;
      if (rsi14 === null) return null;
      return rsi14 > alert.value
        ? { alert, message: `${alert.asset} RSI(14) is ${rsi14.toFixed(1)} (above ${alert.value} — overbought)` }
        : null;
    }
    case 'macdCross': {
      if (!ctx.indicators) return null;
      const { macd } = ctx.indicators;
      if (macd === null) return null;
      if (alert.direction === 'bullish') {
        return macd.histogram > 0
          ? { alert, message: `${alert.asset} MACD bullish crossover (histogram ${macd.histogram.toFixed(4)})` }
          : null;
      } else {
        return macd.histogram < 0
          ? { alert, message: `${alert.asset} MACD bearish crossover (histogram ${macd.histogram.toFixed(4)})` }
          : null;
      }
    }
    case 'bbBreakout': {
      if (!ctx.indicators || !ctx.price) return null;
      const { bb20 } = ctx.indicators;
      if (bb20 === null) return null;
      if (alert.direction === 'above') {
        return ctx.price.price > bb20.upper
          ? { alert, message: `${alert.asset} broke above upper Bollinger Band ($${fmt(bb20.upper)})` }
          : null;
      } else {
        return ctx.price.price < bb20.lower
          ? { alert, message: `${alert.asset} broke below lower Bollinger Band ($${fmt(bb20.lower)})` }
          : null;
      }
    }
  }
};
