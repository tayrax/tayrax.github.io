// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { writable, type Readable } from 'svelte/store';
import { PRICE_HISTORY_WINDOW_MS, PRICE_TICK_MIN_INTERVAL_MS, STORAGE_KEYS } from './config';

export type PricePoint = { price: number; at: number };

export type PriceState = {
  price: number;
  prevPrice: number | null;
  updatedAt: number;
  history: PricePoint[];
};

export type PriceMap = Record<string, PriceState>;

type SnapshotEntry = { price: number; updatedAt: number };

const loadSnapshot = (): PriceMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.lastSnapshot);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, SnapshotEntry>;
    const out: PriceMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      out[k] = { price: v.price, prevPrice: null, updatedAt: v.updatedAt, history: [] };
    }
    return out;
  } catch {
    return {};
  }
};

const persistSnapshot = (map: PriceMap): void => {
  const out: Record<string, SnapshotEntry> = {};
  for (const [k, v] of Object.entries(map)) {
    out[k] = { price: v.price, updatedAt: v.updatedAt };
  }
  try {
    localStorage.setItem(STORAGE_KEYS.lastSnapshot, JSON.stringify(out));
  } catch {
    // quota or unavailable — ignore
  }
};

const pruneHistory = (history: PricePoint[], now: number): PricePoint[] => {
  const cutoff = now - PRICE_HISTORY_WINDOW_MS;
  let i = 0;
  while (i < history.length && history[i].at < cutoff) i += 1;
  return i === 0 ? history : history.slice(i);
};

const store = writable<PriceMap>(loadSnapshot());

let persistTimer: ReturnType<typeof setTimeout> | null = null;
const schedulePersist = (map: PriceMap): void => {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistSnapshot(map);
  }, 1000);
};

export const prices: Readable<PriceMap> = { subscribe: store.subscribe };

const lastTickAt = new Map<string, number>();

export const applyTick = (asset: string, price: number, at: number): void => {
  const last = lastTickAt.get(asset);
  if (last !== undefined && at - last < PRICE_TICK_MIN_INTERVAL_MS) return;
  lastTickAt.set(asset, at);
  store.update((map) => {
    const existing = map[asset];
    const history = pruneHistory(existing?.history ?? [], at);
    history.push({ price, at });
    const next: PriceMap = {
      ...map,
      [asset]: {
        price,
        prevPrice: existing?.price ?? null,
        updatedAt: at,
        history
      }
    };
    schedulePersist(next);
    return next;
  });
};

export const pruneAssets = (toRemove: Set<string>): void => {
  if (toRemove.size === 0) return;
  for (const asset of toRemove) lastTickAt.delete(asset);
  store.update((map) => {
    const next = { ...map };
    for (const asset of toRemove) delete next[asset];
    persistSnapshot(next);
    return next;
  });
};

export const pctChangeOverWindow = (state: PriceState): number | null => {
  if (state.history.length < 2) return null;
  const oldest = state.history[0];
  if (oldest.price === 0) return null;
  return ((state.price - oldest.price) / oldest.price) * 100;
};
