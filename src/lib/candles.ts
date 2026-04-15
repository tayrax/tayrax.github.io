// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { writable, type Readable } from 'svelte/store';
import { CANDLE_HISTORY_MAX, STORAGE_KEYS } from './config';
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

const loadCandles = (): CandleMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.candles);
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

const persistCandles = (map: CandleMap): void => {
  const assets: Record<string, PersistedEntry> = {};
  for (const [asset, candles] of Object.entries(map)) {
    assets[asset] = { candles };
  }
  try {
    const payload: PersistedPayload = { version: 1, assets };
    localStorage.setItem(STORAGE_KEYS.candles, JSON.stringify(payload));
  } catch {
    // quota or unavailable — ignore
  }
};

const store = writable<CandleMap>(loadCandles());

let persistTimer: ReturnType<typeof setTimeout> | null = null;
const schedulePersist = (map: CandleMap): void => {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistCandles(map);
  }, 1000);
};

export const candles: Readable<CandleMap> = { subscribe: store.subscribe };

export const applyClosedCandle = (candle: ClosedCandle): void => {
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
    // Avoid duplicates: drop any existing candle with the same openTime
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

export const pruneCandles = (toRemove: Set<string>): void => {
  if (toRemove.size === 0) return;
  store.update((map) => {
    const next = { ...map };
    for (const asset of toRemove) delete next[asset];
    persistCandles(next);
    return next;
  });
};

// Bulk-insert historical candles (older first). Used by backfill on startup.
// Existing candles with the same openTime are deduplicated; live candles win.
export const prependCandles = (asset: string, historical: OHLCVCandle[]): void => {
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
