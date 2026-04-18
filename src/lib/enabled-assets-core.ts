// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import {
  SUPPORTED_ASSETS,
  MANDATORY_ASSET,
  DEFAULT_ENABLED_ASSETS,
  MAX_ENABLED_ASSETS,
  DISABLED_ASSET_PRUNE_AFTER_MS,
  STORAGE_KEYS,
  type AssetId
} from './config';

type DisabledAtMap = Record<string, number>;

export const loadEnabledFromStorage = (): AssetId[] => {
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

export const persistEnabledToStorage = (assets: AssetId[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.enabledAssets, JSON.stringify(assets));
  } catch {
    // ignore
  }
};

export const loadDisabledAtFromStorage = (): DisabledAtMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.disabledAt);
    if (!raw) return {};
    return JSON.parse(raw) as DisabledAtMap;
  } catch {
    return {};
  }
};

export const persistDisabledAtToStorage = (map: DisabledAtMap): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.disabledAt, JSON.stringify(map));
  } catch {
    // ignore
  }
};

// Returns assets whose disabledAt timestamp is older than the grace period
// and which are not currently in the enabled set.
export const computeExpiredDisabledAssets = (
  enabled: AssetId[],
  disabledAt: DisabledAtMap,
  now: number
): Set<AssetId> => {
  const enabledSet = new Set(enabled);
  const expired = new Set<AssetId>();
  for (const [asset, disabledTime] of Object.entries(disabledAt)) {
    if (!enabledSet.has(asset as AssetId) && now - disabledTime > DISABLED_ASSET_PRUNE_AFTER_MS) {
      expired.add(asset as AssetId);
    }
  }
  return expired;
};

// Pure toggle: returns { enabled, disabledAt } after applying the toggle.
// If the asset is mandatory, returns the inputs unchanged.
// If enabling would exceed MAX_ENABLED_ASSETS, returns inputs unchanged.
export const applyToggle = (
  asset: AssetId,
  enabled: AssetId[],
  disabledAt: DisabledAtMap,
  now: number
): { enabled: AssetId[]; disabledAt: DisabledAtMap } => {
  if (asset === MANDATORY_ASSET) return { enabled, disabledAt };
  if (enabled.includes(asset)) {
    const nextEnabled = enabled.filter((a) => a !== asset);
    const nextDisabledAt = { ...disabledAt, [asset]: now };
    return { enabled: nextEnabled, disabledAt: nextDisabledAt };
  } else {
    if (enabled.length >= MAX_ENABLED_ASSETS) return { enabled, disabledAt };
    const nextEnabled = [...enabled, asset];
    const { [asset]: _removed, ...nextDisabledAt } = disabledAt;
    return { enabled: nextEnabled, disabledAt: nextDisabledAt };
  }
};
