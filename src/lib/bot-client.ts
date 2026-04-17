// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { PRICE_PROVIDER } from './config';
import type { PriceProvider } from './provider';
import { BinancePriceFeed } from './binance-price';
import { BinanceKlineFeed } from './binance';
import { PriceFeed } from './websocket';
import type { TabToWorker, WorkerToTab } from './bot-types';
import type { OHLCVCandle } from './candles';
import type { CandleInterval } from './config';

export type MessageHandler = (msg: WorkerToTab) => void;

export interface BotClient {
  post(msg: TabToWorker): void;
  subscribe(handler: MessageHandler): () => void;
  destroy(): void;
}

// ---------------------------------------------------------------------------
// SharedWorker path
// ---------------------------------------------------------------------------
class SharedWorkerBotClient implements BotClient {
  private worker: SharedWorker;
  private handlers = new Set<MessageHandler>();

  constructor() {
    this.worker = new SharedWorker(
      new URL('./bot.worker.ts', import.meta.url),
      { type: 'module', name: 'tayrax-bot' }
    );
    this.worker.port.addEventListener('message', (ev: MessageEvent<WorkerToTab>) => {
      for (const h of this.handlers) h(ev.data);
    });
    this.worker.port.start();
  }

  post(msg: TabToWorker): void {
    this.worker.port.postMessage(msg);
  }

  subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  destroy(): void {
    this.handlers.clear();
    // Do NOT call port.close() here. onDestroy fires during page teardown, before
    // the next page connects. Explicitly closing the port gives Chrome a clear
    // zero-connection window and causes it to kill the worker. Letting the browser
    // close the port naturally on page unload keeps the worker alive long enough
    // for the next page to connect without a cold restart.
  }
}

// ---------------------------------------------------------------------------
// Fallback path (browsers without SharedWorker — Safari < 16.4)
// ---------------------------------------------------------------------------
class FallbackBotClient implements BotClient {
  private handlers = new Set<MessageHandler>();
  private priceFeed: PriceProvider | null = null;
  private klineFeed: BinanceKlineFeed | null = null;
  private unsubStatus: (() => void) | null = null;
  private unsubTick: (() => void) | null = null;
  private unsubCandle: (() => void) | null = null;

  post(msg: TabToWorker): void {
    if (msg.type === 'setEnabledAssets') {
      this.startFeeds(msg.assets);
    } else if (msg.type === 'reconnect') {
      if (msg.feed === 'price') { this.priceFeed?.stop(); this.priceFeed?.start(); }
      if (msg.feed === 'kline') { this.klineFeed?.stop(); this.klineFeed?.start(); }
    }
    // subscribeBotState is a no-op — FallbackBotClient has no bot page support
  }

  subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  destroy(): void {
    this.unsubStatus?.();
    this.unsubTick?.();
    this.unsubCandle?.();
    this.priceFeed?.stop();
    this.klineFeed?.stop();
    this.handlers.clear();
  }

  private emit(msg: WorkerToTab): void {
    for (const h of this.handlers) h(msg);
  }

  private startFeeds(assets: string[]): void {
    this.unsubStatus?.();
    this.unsubTick?.();
    this.unsubCandle?.();
    this.priceFeed?.stop();
    this.klineFeed?.stop();

    if (assets.length === 0) return;

    const feed: PriceProvider = PRICE_PROVIDER === 'binance'
      ? new BinancePriceFeed(assets)
      : new PriceFeed({ assets });

    this.priceFeed = feed;
    this.klineFeed = new BinanceKlineFeed(assets);

    this.unsubStatus = feed.onStatus((status) => {
      this.emit({ type: 'priceStatus', status });
    });

    this.unsubTick = feed.onTick(({ asset, price, receivedAt }) => {
      this.emit({ type: 'priceTick', asset, price, receivedAt });
    });

    this.unsubCandle = this.klineFeed.onCandleClosed((raw) => {
      const { asset, interval, ...rest } = raw;
      const candle: OHLCVCandle = rest;
      this.emit({ type: 'closedCandle', asset, interval: interval as CandleInterval, candle });
    });

    feed.start();
    this.klineFeed.start();
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createBotClient(): BotClient {
  if (typeof SharedWorker !== 'undefined') return new SharedWorkerBotClient();
  return new FallbackBotClient();
}
