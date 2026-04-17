// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { writable, type Readable } from 'svelte/store';
import { CANDLE_HISTORY_MAX, CANDLE_INTERVALS, CANDLE_STORAGE_KEYS, type CandleInterval } from './config';
import type { ClosedCandle } from './binance';

export type OHLCVCandle = {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  baseVolume: number;
};

export type CandleMap = Record<string, OHLCVCandle[]>;

type PersistedEntry = { candles: OHLCVCandle[] };
type PersistedPayload = { version: 1; assets: Record<string, PersistedEntry> };

type CandleStore = {
  readable: Readable<CandleMap>;
  applyClosedCandle: (candle: ClosedCandle) => void;
  prependCandles: (asset: string, historical: OHLCVCandle[]) => void;
  pruneCandles: (toRemove: Set<string>) => void;
};

function makeStore(storageKey: string): CandleStore {
  const load = (): CandleMap => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as PersistedPayload;
      if (parsed?.version !== 1 || !parsed.assets) return {};
      const out: CandleMap = {};
      for (const [asset, entry] of Object.entries(parsed.assets)) {
        if (Array.isArray(entry.candles)) out[asset] = entry.candles;
      }
      return out;
    } catch {
      return {};
    }
  };

  const persist = (map: CandleMap): void => {
    const assets: Record<string, PersistedEntry> = {};
    for (const [asset, candles] of Object.entries(map)) {
      assets[asset] = { candles };
    }
    try {
      const payload: PersistedPayload = { version: 1, assets };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // quota or unavailable — ignore
    }
  };

  const store = writable<CandleMap>(load());
  let persistTimer: ReturnType<typeof setTimeout> | null = null;

  const schedulePersist = (map: CandleMap): void => {
    if (persistTimer) return;
    persistTimer = setTimeout(() => {
      persistTimer = null;
      persist(map);
    }, 1000);
  };

  const readable: Readable<CandleMap> = { subscribe: store.subscribe };

  const applyClosedCandle = (candle: ClosedCandle): void => {
    store.update((map) => {
      const existing = map[candle.asset] ?? [];
      const entry: OHLCVCandle = {
        openTime: candle.openTime,
        closeTime: candle.closeTime,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        baseVolume: candle.baseVolume
      };
      const filtered = existing.filter((c) => c.openTime !== candle.openTime);
      const appended = [...filtered, entry];
      const trimmed =
        appended.length > CANDLE_HISTORY_MAX
          ? appended.slice(appended.length - CANDLE_HISTORY_MAX)
          : appended;
      const next = { ...map, [candle.asset]: trimmed };
      schedulePersist(next);
      return next;
    });
  };

  const prependCandles = (asset: string, historical: OHLCVCandle[]): void => {
    if (historical.length === 0) return;
    store.update((map) => {
      const existing = map[asset] ?? [];
      const existingTimes = new Set(existing.map((c) => c.openTime));
      const fresh = historical.filter((c) => !existingTimes.has(c.openTime));
      const merged = [...fresh, ...existing].sort((a, b) => a.openTime - b.openTime);
      const trimmed =
        merged.length > CANDLE_HISTORY_MAX
          ? merged.slice(merged.length - CANDLE_HISTORY_MAX)
          : merged;
      const next = { ...map, [asset]: trimmed };
      schedulePersist(next);
      return next;
    });
  };

  const pruneCandles = (toRemove: Set<string>): void => {
    if (toRemove.size === 0) return;
    store.update((map) => {
      const next = { ...map };
      for (const asset of toRemove) delete next[asset];
      persist(next);
      return next;
    });
  };

  return { readable, applyClosedCandle, prependCandles, pruneCandles };
}

const _stores = Object.fromEntries(
  CANDLE_INTERVALS.map((interval) => [interval, makeStore(CANDLE_STORAGE_KEYS[interval])])
) as Record<CandleInterval, CandleStore>;

export const candleStores: Record<CandleInterval, Readable<CandleMap>> = Object.fromEntries(
  CANDLE_INTERVALS.map((interval) => [interval, _stores[interval].readable])
) as Record<CandleInterval, Readable<CandleMap>>;

export const applyClosedCandle = (interval: CandleInterval, candle: ClosedCandle): void =>
  _stores[interval].applyClosedCandle(candle);

export const prependCandles = (interval: CandleInterval, asset: string, historical: OHLCVCandle[]): void =>
  _stores[interval].prependCandles(asset, historical);

// Prunes the given assets from all interval stores.
export const pruneCandles = (toRemove: Set<string>): void => {
  for (const interval of CANDLE_INTERVALS) {
    _stores[interval].pruneCandles(toRemove);
  }
};
