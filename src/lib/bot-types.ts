// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import type { PriceFeedStatus } from './provider';
import type { OHLCVCandle } from './candles';
import type { CandleInterval, AssetId } from './config';
import type { StoredAlert, NewAlert } from './alert-core';

export type FeedError = {
  feed: 'price' | 'kline';
  message: string;
  at: number;
};

export type BotState = {
  priceStatus: PriceFeedStatus;
  klineStatus: 'idle' | 'open' | 'closed';
  enabledAssets: string[];
  lastTickAt: Record<string, number>;
  reconnectCount: Record<'price' | 'kline', number>;
  recentErrors: FeedError[];
  connectedTabCount: number;
};

export type WorkerToTab =
  | { type: 'priceTick'; asset: string; price: number; receivedAt: number }
  | { type: 'closedCandle'; asset: string; interval: CandleInterval; candle: OHLCVCandle }
  | { type: 'priceStatus'; status: PriceFeedStatus }
  | { type: 'klineStatus'; status: 'idle' | 'open' | 'closed' }
  | { type: 'botState'; state: BotState }
  | { type: 'notify'; title: string; body: string }
  | { type: 'alertList'; alerts: StoredAlert[] }
  | { type: 'enabledAssetsList'; assets: AssetId[] }
  | { type: 'pruneAssets'; assets: AssetId[] };

export type TabToWorker =
  | { type: 'reconnect'; feed: 'price' | 'kline' }
  | { type: 'subscribeBotState' }
  | { type: 'addAlert'; rule: NewAlert }
  | { type: 'removeAlert'; id: string }
  | { type: 'toggleAsset'; asset: AssetId };
