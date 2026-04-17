// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { PRICE_PROVIDER, CANDLE_INTERVALS, type CandleInterval } from './config';
import type { PriceFeedStatus, PriceProvider } from './provider';
import { BinancePriceFeed } from './binance-price';
import { BinanceKlineFeed } from './binance';
import { PriceFeed } from './websocket';
import type { OHLCVCandle } from './candles';
import {
  applyClosedCandle as applyClosedCandleToStore,
  candleStores,
  type CandleMap
} from './candles';
import { applyTick as applyTickToStore, prices, type PriceMap } from './prices';
import { applyCandle as applyVolumeCandle, volumes, type VolumeMap } from './volumes';
import {
  alerts,
  evaluate,
  getAlertInterval,
  markFired,
  reloadAlerts,
  type StoredAlert
} from './alerts';
import { evaluateProposals } from './proposals';
import { computeIndicators } from './indicators';
import { backfillAll as defaultBackfillAll } from './backfill';
import { logAction } from './logs';
import type { BotState, FeedError, WorkerToTab } from './bot-types';

const ERRORS_MAX = 50;

export type PriceFeedFactory = (assets: readonly string[]) => PriceProvider;
export type KlineFeedFactory = (assets: readonly string[]) => BinanceKlineFeed;

export interface BotEngineDeps {
  broadcast: (msg: WorkerToTab) => void;
  broadcastBotState: () => void;
  getConnectedTabCount: () => number;
  createPriceFeed?: PriceFeedFactory;
  createKlineFeed?: KlineFeedFactory;
  backfill?: (assets: readonly string[]) => Promise<void>;
  now?: () => number;
}

const defaultCreatePriceFeed: PriceFeedFactory = (assets) =>
  PRICE_PROVIDER === 'binance' ? new BinancePriceFeed(assets) : new PriceFeed({ assets });

const defaultCreateKlineFeed: KlineFeedFactory = (assets) => new BinanceKlineFeed(assets);

export class BotEngine {
  private priceStatus: PriceFeedStatus = 'idle';
  private klineStatus: 'idle' | 'open' | 'closed' = 'idle';
  private enabledAssetsArr: string[] = [];
  private readonly lastTickAt: Record<string, number> = {};
  private readonly reconnectCount: Record<'price' | 'kline', number> = { price: 0, kline: 0 };
  private readonly errorRing: FeedError[] = [];

  private priceFeed: PriceProvider | null = null;
  private klineFeed: BinanceKlineFeed | null = null;
  private unsubPriceStatus: (() => void) | null = null;
  private unsubPriceTick: (() => void) | null = null;
  private unsubCandle: (() => void) | null = null;
  private unsubKlineStatus: (() => void) | null = null;

  private alertsCache: StoredAlert[] = [];
  private pricesCache: PriceMap = {};
  private volumesCache: VolumeMap = {};
  private readonly candlesCache: Record<CandleInterval, CandleMap>;

  private readonly unsubAlerts: () => void;
  private readonly unsubPrices: () => void;
  private readonly unsubVolumes: () => void;
  private readonly unsubCandleStores: Array<() => void> = [];

  constructor(private readonly deps: BotEngineDeps) {
    this.candlesCache = Object.fromEntries(
      CANDLE_INTERVALS.map((iv) => [iv, {}])
    ) as Record<CandleInterval, CandleMap>;

    this.unsubAlerts = alerts.subscribe((list) => { this.alertsCache = list; });
    this.unsubPrices = prices.subscribe((map) => { this.pricesCache = map; });
    this.unsubVolumes = volumes.subscribe((map) => { this.volumesCache = map; });
    for (const iv of CANDLE_INTERVALS) {
      this.unsubCandleStores.push(
        candleStores[iv].subscribe((map) => { this.candlesCache[iv] = map; })
      );
    }
  }

  private get nowFn(): () => number {
    return this.deps.now ?? Date.now;
  }

  private get backfillFn(): (assets: readonly string[]) => Promise<void> {
    return this.deps.backfill ?? defaultBackfillAll;
  }

  getState(): BotState {
    return {
      priceStatus: this.priceStatus,
      klineStatus: this.klineStatus,
      enabledAssets: [...this.enabledAssetsArr],
      lastTickAt: { ...this.lastTickAt },
      reconnectCount: { ...this.reconnectCount },
      recentErrors: [...this.errorRing],
      connectedTabCount: this.deps.getConnectedTabCount()
    };
  }

  setEnabledAssets(assets: string[]): void {
    if (!this.assetsChanged(assets)) return;
    const newAssets = assets.filter((a) => !this.enabledAssetsArr.includes(a));
    this.teardownFeeds();
    this.enabledAssetsArr = [...assets];
    if (assets.length === 0) {
      this.deps.broadcastBotState();
      return;
    }
    this.startFeeds();
    if (newAssets.length > 0) {
      void this.backfillFn(newAssets);
    }
  }

  reconnect(feed: 'price' | 'kline'): void {
    if (feed === 'price' && this.priceFeed) {
      this.priceFeed.stop();
      this.priceFeed.start();
    }
    if (feed === 'kline' && this.klineFeed) {
      this.klineFeed.stop();
      this.klineFeed.start();
    }
  }

  refreshAlerts(): void {
    reloadAlerts();
  }

  destroy(): void {
    this.teardownFeeds();
    this.unsubAlerts();
    this.unsubPrices();
    this.unsubVolumes();
    for (const u of this.unsubCandleStores) u();
  }

  private assetsChanged(next: string[]): boolean {
    if (next.length !== this.enabledAssetsArr.length) return true;
    const a = [...next].sort();
    const b = [...this.enabledAssetsArr].sort();
    return a.some((v, i) => v !== b[i]);
  }

  private teardownFeeds(): void {
    this.unsubPriceStatus?.();
    this.unsubPriceTick?.();
    this.unsubCandle?.();
    this.unsubKlineStatus?.();
    this.priceFeed?.stop();
    this.klineFeed?.stop();
    this.priceFeed = null;
    this.klineFeed = null;
    this.unsubPriceStatus = null;
    this.unsubPriceTick = null;
    this.unsubCandle = null;
    this.unsubKlineStatus = null;
  }

  private startFeeds(): void {
    const createPrice = this.deps.createPriceFeed ?? defaultCreatePriceFeed;
    const createKline = this.deps.createKlineFeed ?? defaultCreateKlineFeed;
    this.priceFeed = createPrice(this.enabledAssetsArr);
    this.klineFeed = createKline(this.enabledAssetsArr);

    this.unsubPriceStatus = this.priceFeed.onStatus((next) => {
      if (this.priceStatus === 'open' && next === 'closed') {
        this.pushError({ feed: 'price', message: 'connection lost', at: this.nowFn() });
        this.reconnectCount.price += 1;
      }
      this.priceStatus = next;
      this.deps.broadcast({ type: 'priceStatus', status: next });
      this.deps.broadcastBotState();
    });

    this.unsubPriceTick = this.priceFeed.onTick(({ asset, price, receivedAt }) => {
      this.lastTickAt[asset] = receivedAt;
      applyTickToStore(asset, price, receivedAt);
      this.deps.broadcast({ type: 'priceTick', asset, price, receivedAt });
      this.runEvaluation(this.nowFn());
    });

    this.unsubCandle = this.klineFeed.onCandleClosed((raw) => {
      const { asset, interval, ...rest } = raw;
      const candle: OHLCVCandle = rest;
      const iv = interval as CandleInterval;
      if (iv === '1m') applyVolumeCandle(asset, candle.baseVolume, candle.closeTime);
      applyClosedCandleToStore(iv, { asset, interval: iv, ...candle });
      this.deps.broadcast({ type: 'closedCandle', asset, interval: iv, candle });
      this.runEvaluation(this.nowFn());
    });

    this.unsubKlineStatus = this.klineFeed.onStatus((next) => {
      if (this.klineStatus === 'open' && next === 'closed') {
        this.pushError({ feed: 'kline', message: 'connection lost', at: this.nowFn() });
        this.reconnectCount.kline += 1;
      }
      this.klineStatus = next;
      this.deps.broadcast({ type: 'klineStatus', status: next });
      this.deps.broadcastBotState();
    });

    this.priceFeed.start();
    this.klineFeed.start();
  }

  private pushError(err: FeedError): void {
    this.errorRing.push(err);
    if (this.errorRing.length > ERRORS_MAX) this.errorRing.shift();
  }

  // Visible to tests. Called internally on every tick and closed candle.
  runEvaluation(now: number): void {
    const enabled = new Set(this.enabledAssetsArr);

    for (const alert of this.alertsCache) {
      if (!enabled.has(alert.asset)) continue;
      const alertInterval = getAlertInterval(alert);
      const assetCandles = this.candlesCache[alertInterval][alert.asset] ?? [];
      const indicators = assetCandles.length > 0 ? computeIndicators(assetCandles) : undefined;
      const hit = evaluate(
        alert,
        {
          price: this.pricesCache[alert.asset],
          volume: this.volumesCache[alert.asset],
          indicators
        },
        now
      );
      if (!hit) continue;
      markFired(alert.id, now);
      this.deps.broadcast({
        type: 'notify',
        title: `tayrax · ${alert.asset}`,
        body: hit.message
      });
      logAction({
        kind: 'alertDispatched',
        asset: alert.asset,
        message: hit.message,
        data: { alertId: alert.id, alertKind: alert.kind }
      });
    }

    for (const interval of CANDLE_INTERVALS) {
      for (const asset of enabled) {
        const assetCandles = this.candlesCache[interval][asset] ?? [];
        if (assetCandles.length === 0) continue;
        const indicators = computeIndicators(assetCandles);
        const proposals = evaluateProposals(
          asset,
          interval,
          indicators,
          this.pricesCache[asset],
          now
        );
        for (const p of proposals) {
          logAction({
            kind: 'tradeProposed',
            asset: p.asset,
            message: p.message,
            data: {
              interval: p.interval,
              signal: p.signal,
              direction: p.direction,
              indicatorValue: p.indicatorValue,
              price: p.price
            }
          });
        }
      }
    }
  }
}
