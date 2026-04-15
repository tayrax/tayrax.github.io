// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

export const MONITORED_ASSETS = ['bitcoin', 'ethereum', 'solana', 'cardano'] as const;

export type AssetId = (typeof MONITORED_ASSETS)[number];

export const PRICE_PROVIDER: 'coincap' | 'binance' = 'binance';

export const PRICE_HISTORY_WINDOW_MS = 60 * 60 * 1000;

export const PRICE_TICK_MIN_INTERVAL_MS = 5_000;

export const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

export const LOG_MAX_ENTRIES = 500;

export const STORAGE_KEYS = {
  alerts: 'tayrax.alerts.v1',
  lastSnapshot: 'tayrax.lastSnapshot.v1',
  logs: 'tayrax.logs.v1'
} as const;
