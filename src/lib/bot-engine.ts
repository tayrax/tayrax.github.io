// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import {
  PRICE_PROVIDER,
  CANDLE_INTERVALS,
  MANDATORY_ASSET,
  type AssetId,
  type CandleInterval
} from './config';
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
  evaluate,
  getAlertInterval,
  loadAlertsFromStorage,
  makeAlertId,
  persistAlertsToStorage,
  type NewAlert,
  type StoredAlert
} from './alert-core';
import {
  applyToggle,
  computeExpiredDisabledAssets,
  loadDisabledAtFromStorage,
  loadEnabledFromStorage,
  persistDisabledAtToStorage,
  persistEnabledToStorage
} from './enabled-assets-core';
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
  skipInitialPrune?: boolean;
}

const defaultCreatePriceFeed: PriceFeedFactory = (assets) =>
  PRICE_PROVIDER === 'binance' ? new BinancePriceFeed(assets) : new PriceFeed({ assets });

const defaultCreateKlineFeed: KlineFeedFactory = (assets) => new BinanceKlineFeed(assets);

export class BotEngine {
  private priceStatus: PriceFeedStatus = 'idle';
  private klineStatus: 'idle' | 'open' | 'closed' = 'idle';
  private enabledAssetsArr: AssetId[] = [];
  private disabledAt: Record<string, number> = {};
  private alertsList: StoredAlert[] = [];
  private pendingPrune: Set<AssetId> = new Set();
  private readonly lastTickAt: Record<string, number> = {};
  private readonly reconnectCount: Record<'price' | 'kline', number> = { price: 0, kline: 0 };
  private readonly errorRing: FeedError[] = [];

  private priceFeed: PriceProvider | null = null;
  private klineFeed: BinanceKlineFeed | null = null;
  private unsubPriceStatus: (() => void) | null = null;
  private unsubPriceTick: (() => void) | null = null;
  private unsubCandle: (() => void) | null = null;
  private unsubKlineStatus: (() => void) | null = null;

  private pricesCache: PriceMap = {};
  private volumesCache: VolumeMap = {};
  private readonly candlesCache: Record<CandleInterval, CandleMap>;

  private readonly unsubPrices: () => void;
  private readonly unsubVolumes: () => void;
  private readonly unsubCandleStores: Array<() => void> = [];

  constructor(private readonly deps: BotEngineDeps) {
    this.candlesCache = Object.fromEntries(
      CANDLE_INTERVALS.map((iv) => [iv, {}])
    ) as Record<CandleInterval, CandleMap>;

    this.unsubPrices = prices.subscribe((map) => { this.pricesCache = map; });
    this.unsubVolumes = volumes.subscribe((map) => { this.volumesCache = map; });
    for (const iv of CANDLE_INTERVALS) {
      this.unsubCandleStores.push(
        candleStores[iv].subscribe((map) => { this.candlesCache[iv] = map; })
      );
    }

    // Load authoritative state from localStorage.
    this.alertsList = loadAlertsFromStorage();
    this.enabledAssetsArr = loadEnabledFromStorage();
    this.disabledAt = loadDisabledAtFromStorage();

    // Compute expired assets, clean up the disabledAt map, and queue a
    // one-time pruneAssets broadcast for the first tab that connects.
    if (!deps.skipInitialPrune) {
      const expired = computeExpiredDisabledAssets(
        this.enabledAssetsArr,
        this.disabledAt,
        this.nowFn()
      );
      if (expired.size > 0) {
        for (const a of expired) delete this.disabledAt[a];
        persistDisabledAtToStorage(this.disabledAt);
        this.pendingPrune = expired;
      }
    }

    // Kick off feeds if we already have enabled assets, backfilling the
    // full set once on first start.
    if (this.enabledAssetsArr.length > 0) {
      this.startFeeds();
      void this.backfillFn(this.enabledAssetsArr);
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

  getAlertsSnapshot(): StoredAlert[] {
    return [...this.alertsList];
  }

  getEnabledAssetsSnapshot(): AssetId[] {
    return [...this.enabledAssetsArr];
  }

  // Called by the worker's connect handler to hand off a pending prune to the
  // first tab that joins. Returns the set to broadcast, then clears it so
  // subsequent tabs don't re-prune.
  takePendingPrune(): AssetId[] {
    if (this.pendingPrune.size === 0) return [];
    const out = [...this.pendingPrune];
    this.pendingPrune.clear();
    return out;
  }

  // Bulk replacement of the enabled-assets list. Used by tests; the tab-side
  // API posts single toggleAsset messages. Ensures MANDATORY_ASSET is always
  // included, persists + broadcasts, rewires feeds, and backfills newly added
  // assets.
  setEnabledAssets(assets: AssetId[]): void {
    const prev = this.enabledAssetsArr;
    const next: AssetId[] = assets.includes(MANDATORY_ASSET)
      ? [...assets]
      : [MANDATORY_ASSET, ...assets];
    if (prev.length === next.length && prev.every((a, i) => a === next[i])) return;

    const now = this.nowFn();
    const nextDisabledAt: Record<string, number> = { ...this.disabledAt };
    for (const a of prev) {
      if (!next.includes(a) && a !== MANDATORY_ASSET) nextDisabledAt[a] = now;
    }
    for (const a of next) delete nextDisabledAt[a];

    const newlyAdded = next.filter((a) => !prev.includes(a));
    this.enabledAssetsArr = next;
    this.disabledAt = nextDisabledAt;
    persistEnabledToStorage(next);
    persistDisabledAtToStorage(nextDisabledAt);
    this.deps.broadcast({ type: 'enabledAssetsList', assets: next });
    this.rewireFeeds(prev);
    if (newlyAdded.length > 0) void this.backfillFn(newlyAdded);
  }

  toggleAsset(asset: AssetId): void {
    const { enabled, disabledAt } = applyToggle(
      asset,
      this.enabledAssetsArr,
      this.disabledAt,
      this.nowFn()
    );
    // applyToggle returns the inputs unchanged when the toggle is a no-op;
    // if nothing changed, skip the persistence + rewire.
    if (enabled === this.enabledAssetsArr) return;
    const newlyAdded = enabled.filter((a) => !this.enabledAssetsArr.includes(a));
    const prev = this.enabledAssetsArr;
    this.enabledAssetsArr = enabled;
    this.disabledAt = disabledAt;
    persistEnabledToStorage(enabled);
    persistDisabledAtToStorage(disabledAt);
    this.deps.broadcast({ type: 'enabledAssetsList', assets: enabled });
    this.rewireFeeds(prev);
    if (newlyAdded.length > 0) void this.backfillFn(newlyAdded);
  }

  addAlert(rule: NewAlert): void {
    const next: StoredAlert = { ...rule, id: makeAlertId(), lastFiredAt: null } as StoredAlert;
    this.alertsList = [...this.alertsList, next];
    persistAlertsToStorage(this.alertsList);
    this.deps.broadcast({ type: 'alertList', alerts: this.alertsList });
  }

  removeAlert(id: string): void {
    const before = this.alertsList;
    this.alertsList = this.alertsList.filter((a) => a.id !== id);
    if (before === this.alertsList) return;
    persistAlertsToStorage(this.alertsList);
    this.deps.broadcast({ type: 'alertList', alerts: this.alertsList });
  }

  private markFired(id: string, at: number): void {
    this.alertsList = this.alertsList.map((a) =>
      a.id === id ? { ...a, lastFiredAt: at } : a
    );
    persistAlertsToStorage(this.alertsList);
    this.deps.broadcast({ type: 'alertList', alerts: this.alertsList });
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

  destroy(): void {
    this.teardownFeeds();
    this.unsubPrices();
    this.unsubVolumes();
    for (const u of this.unsubCandleStores) u();
  }

  private rewireFeeds(_prev: AssetId[]): void {
    this.teardownFeeds();
    if (this.enabledAssetsArr.length === 0) {
      this.deps.broadcastBotState();
      return;
    }
    this.startFeeds();
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

    for (const alert of this.alertsList) {
      if (!enabled.has(alert.asset as AssetId)) continue;
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
      this.markFired(alert.id, now);
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
