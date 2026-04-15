// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

export const SUPPORTED_ASSETS = ['bitcoin', 'ethereum', 'solana', 'cardano'] as const;

export type AssetId = (typeof SUPPORTED_ASSETS)[number];

export const MANDATORY_ASSET: AssetId = 'bitcoin';

export const DEFAULT_ENABLED_ASSETS: AssetId[] = ['bitcoin'];

export const PRICE_PROVIDER: 'coincap' | 'binance' = 'binance';

export const PRICE_HISTORY_WINDOW_MS = 60 * 60 * 1000;

export const PRICE_TICK_MIN_INTERVAL_MS = 5_000;

export const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

export const LOG_MAX_ENTRIES = 500;

export const CANDLE_HISTORY_MAX = 200;

// Grace period before disabled-asset data is pruned from storage (3 days)
export const DISABLED_ASSET_PRUNE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

export const STORAGE_KEYS = {
  alerts: 'tayrax.alerts.v1',
  lastSnapshot: 'tayrax.lastSnapshot.v1',
  logs: 'tayrax.logs.v1',
  candles: 'tayrax.candles.v1',
  enabledAssets: 'tayrax.enabledAssets.v1',
  disabledAt: 'tayrax.disabledAt.v1'
} as const;
