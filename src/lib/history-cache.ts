// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import type { OHLCVCandle } from './candles';

export type HistoryPreset = '1D' | '3D' | '1W' | '1M' | '6M' | '1Y' | '3Y' | '5Y' | 'ALL';

export const HISTORY_PRESETS: HistoryPreset[] = ['1D', '3D', '1W', '1M', '6M', '1Y', '3Y', '5Y', 'ALL'];

const DB_NAME = 'tayrax-history';
const DB_VERSION = 2;
const STORE_NAME = 'candles';

export const CACHE_TTL_MS: Record<HistoryPreset, number> = {
  '1D':  5  * 60 * 1000,
  '3D':  5  * 60 * 1000,
  '1W':  60 * 60 * 1000,
  '1M':  4  * 60 * 60 * 1000,
  '6M':  24 * 60 * 60 * 1000,
  '1Y':  24 * 60 * 60 * 1000,
  '3Y':  24 * 60 * 60 * 1000,
  '5Y':  48 * 60 * 60 * 1000,
  'ALL': 48 * 60 * 60 * 1000,
};

type CacheEntry = { candles: OHLCVCandle[]; fetchedAt: number };

let _db: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (e.oldVersion < DB_VERSION && db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
};

const cacheKey = (asset: string, preset: HistoryPreset): string => `${asset}:${preset}`;

export const getCached = async (asset: string, preset: HistoryPreset): Promise<OHLCVCandle[] | null> => {
  try {
    const db = await openDB();
    const entry = await new Promise<CacheEntry | undefined>((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(cacheKey(asset, preset));
      req.onsuccess = () => resolve(req.result as CacheEntry | undefined);
      req.onerror = () => reject(req.error);
    });
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS[preset]) return null;
    return entry.candles;
  } catch {
    return null;
  }
};

export const putCached = async (asset: string, preset: HistoryPreset, candles: OHLCVCandle[]): Promise<void> => {
  try {
    const db = await openDB();
    const entry: CacheEntry = { candles, fetchedAt: Date.now() };
    db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(entry, cacheKey(asset, preset));
  } catch {
    // Non-fatal
  }
};

export const clearCached = async (asset: string, preset: HistoryPreset): Promise<void> => {
  try {
    const db = await openDB();
    db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(cacheKey(asset, preset));
  } catch {
    // Non-fatal
  }
};
