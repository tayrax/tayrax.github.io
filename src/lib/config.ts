// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

export const SUPPORTED_ASSETS = [
  'bitcoin',
  'ethereum',
  'binance-coin',
  'solana',
  'xrp',
  'dogecoin',
  'tron',
  'toncoin',
  'cardano',
  'avalanche',
  'shiba-inu',
  'chainlink',
  'polkadot',
  'bitcoin-cash',
  'litecoin',
  'near-protocol',
  'uniswap',
  'stellar',
  'cosmos',
  'internet-computer',
  'ethereum-classic',
  'filecoin',
  'hedera-hashgraph',
  'aptos',
  'sui',
  'arbitrum',
  'vechain',
  'optimism',
  'injective',
  'maker',
  'polygon',
  'algorand',
  'theta',
  'aave',
  'the-graph',
  'flow',
  'immutable-x',
  'decentraland',
  'lido-dao',
  'sei-network',
  'celestia',
  'stacks',
  'render-token',
  'fetch-ai',
  'fantom',
  'eos',
  'sandbox',
  'gala',
  'mantle',
  'worldcoin',
] as const;

export type AssetId = (typeof SUPPORTED_ASSETS)[number];

export const MANDATORY_ASSET: AssetId = 'bitcoin';

export const DEFAULT_ENABLED_ASSETS: AssetId[] = ['bitcoin'];

export const MAX_ENABLED_ASSETS = 4;

export const PRICE_PROVIDER: 'coincap' | 'binance' = 'binance';

export const PRICE_HISTORY_WINDOW_MS = 60 * 60 * 1000;

export const PRICE_TICK_MIN_INTERVAL_MS = 5_000;

export const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

export const PROPOSAL_COOLDOWN_MS = 30 * 60 * 1000;

export const LOG_MAX_ENTRIES = 500;

export const CANDLE_HISTORY_MAX = 200;

export type CandleInterval = '1m' | '15m' | '1h' | '4h' | '1d';
export const CANDLE_INTERVALS: CandleInterval[] = ['1m', '15m', '1h', '4h', '1d'];
export const DEFAULT_CHART_INTERVAL: CandleInterval = '1m';

export const CANDLE_STORAGE_KEYS: Record<CandleInterval, string> = {
  '1m':  'tayrax.candles.1m.v1',
  '15m': 'tayrax.candles.15m.v1',
  '1h':  'tayrax.candles.1h.v1',
  '4h':  'tayrax.candles.4h.v1',
  '1d':  'tayrax.candles.1d.v1',
};

// Grace period before disabled-asset data is pruned from storage (3 days)
export const DISABLED_ASSET_PRUNE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

export const STORAGE_KEYS = {
  alerts: 'tayrax.alerts.v1',
  lastSnapshot: 'tayrax.lastSnapshot.v1',
  logs: 'tayrax.logs.v1',
  enabledAssets: 'tayrax.enabledAssets.v1',
  disabledAt: 'tayrax.disabledAt.v1',
  proposalCooldown: 'tayrax.proposalCooldown.v1'
} as const;
