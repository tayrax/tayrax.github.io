// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { writable, type Readable } from 'svelte/store';
import {
  SUPPORTED_ASSETS,
  MANDATORY_ASSET,
  DEFAULT_ENABLED_ASSETS,
  DISABLED_ASSET_PRUNE_AFTER_MS,
  STORAGE_KEYS,
  type AssetId
} from './config';

type DisabledAtMap = Record<string, number>;

const loadDisabledAt = (): DisabledAtMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.disabledAt);
    if (!raw) return {};
    return JSON.parse(raw) as DisabledAtMap;
  } catch {
    return {};
  }
};

const persistDisabledAt = (map: DisabledAtMap): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.disabledAt, JSON.stringify(map));
  } catch {
    // quota or unavailable — ignore
  }
};

const loadEnabled = (): AssetId[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.enabledAssets);
    if (!raw) return [...DEFAULT_ENABLED_ASSETS];
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter((a): a is AssetId =>
      (SUPPORTED_ASSETS as readonly string[]).includes(a)
    );
    if (!valid.includes(MANDATORY_ASSET)) valid.unshift(MANDATORY_ASSET);
    return valid.length > 0 ? valid : [...DEFAULT_ENABLED_ASSETS];
  } catch {
    return [...DEFAULT_ENABLED_ASSETS];
  }
};

const persistEnabled = (assets: AssetId[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.enabledAssets, JSON.stringify(assets));
  } catch {
    // quota or unavailable — ignore
  }
};

// Returns assets that have been disabled for longer than the grace period.
// Called once at app startup to decide what to prune from stores.
export const getExpiredDisabledAssets = (): Set<AssetId> => {
  const disabledAt = loadDisabledAt();
  const enabled = new Set(loadEnabled());
  const now = Date.now();
  const expired = new Set<AssetId>();
  for (const [asset, disabledTime] of Object.entries(disabledAt)) {
    if (!enabled.has(asset as AssetId) && now - disabledTime > DISABLED_ASSET_PRUNE_AFTER_MS) {
      expired.add(asset as AssetId);
    }
  }
  return expired;
};

// Removes expired entries from the disabled-at map after pruning is done.
export const clearExpiredDisabledAt = (expired: Set<AssetId>): void => {
  if (expired.size === 0) return;
  const map = loadDisabledAt();
  for (const asset of expired) {
    delete map[asset];
  }
  persistDisabledAt(map);
};

const _store = writable<AssetId[]>(loadEnabled());

export const enabledAssets: Readable<AssetId[]> = { subscribe: _store.subscribe };

export const toggleAsset = (asset: AssetId): void => {
  if (asset === MANDATORY_ASSET) return;
  _store.update((current) => {
    const map = loadDisabledAt();
    if (current.includes(asset)) {
      // Disabling: record timestamp
      map[asset] = Date.now();
      persistDisabledAt(map);
      const next = current.filter((a) => a !== asset);
      persistEnabled(next);
      return next;
    } else {
      // Re-enabling: remove from disabled-at map
      delete map[asset];
      persistDisabledAt(map);
      const next = [...current, asset];
      persistEnabled(next);
      return next;
    }
  });
};
