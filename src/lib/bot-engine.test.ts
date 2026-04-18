// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { BotEngine, type BotEngineDeps } from './bot-engine';
import type { WorkerToTab } from './bot-types';
import type { PriceProvider, PriceFeedStatus, PriceFeedListener, StatusListener } from './provider';
import type { BinanceKlineFeed } from './binance';
import type { OHLCVCandle } from './candles';
import type { CandleInterval } from './config';
import { CANDLE_INTERVALS } from './config';
import { prices, pruneAssets } from './prices';
import { volumes, pruneVolumes } from './volumes';
import { candleStores, pruneCandles, prependCandles } from './candles';
import type { NewAlert } from './alert-core';
import { resetCooldowns } from './proposals';
import { logs, clearLogs } from './logs';

// ---------------------------------------------------------------------------
// Fake feed implementations
// ---------------------------------------------------------------------------
class FakePriceFeed implements PriceProvider {
  tickListeners: PriceFeedListener[] = [];
  statusListeners: StatusListener[] = [];
  started = false;
  stopped = false;
  constructor(public assets: readonly string[]) {}
  start(): void { this.started = true; }
  stop(): void { this.stopped = true; }
  onTick(fn: PriceFeedListener): () => void {
    this.tickListeners.push(fn);
    return () => { this.tickListeners = this.tickListeners.filter((f) => f !== fn); };
  }
  onStatus(fn: StatusListener): () => void {
    this.statusListeners.push(fn);
    fn('idle');
    return () => { this.statusListeners = this.statusListeners.filter((f) => f !== fn); };
  }
  emitTick(asset: string, price: number, receivedAt: number): void {
    for (const fn of this.tickListeners) fn({ asset, price, receivedAt });
  }
  emitStatus(s: PriceFeedStatus): void {
    for (const fn of this.statusListeners) fn(s);
  }
}

type CandleEmit = {
  asset: string;
  interval: CandleInterval;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  baseVolume: number;
};

class FakeKlineFeed {
  candleListeners: Array<(c: CandleEmit) => void> = [];
  statusListeners: Array<(s: 'idle' | 'open' | 'closed') => void> = [];
  started = false;
  stopped = false;
  constructor(public assets: readonly string[]) {}
  start(): void { this.started = true; }
  stop(): void { this.stopped = true; }
  onCandleClosed(fn: (c: CandleEmit) => void): () => void {
    this.candleListeners.push(fn);
    return () => { this.candleListeners = this.candleListeners.filter((f) => f !== fn); };
  }
  onStatus(fn: (s: 'idle' | 'open' | 'closed') => void): () => void {
    this.statusListeners.push(fn);
    fn('idle');
    return () => { this.statusListeners = this.statusListeners.filter((f) => f !== fn); };
  }
  emitCandle(c: CandleEmit): void {
    for (const fn of this.candleListeners) fn(c);
  }
  emitStatus(s: 'idle' | 'open' | 'closed'): void {
    for (const fn of this.statusListeners) fn(s);
  }
}

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
type Harness = {
  engine: BotEngine;
  priceFeeds: FakePriceFeed[];
  klineFeeds: FakeKlineFeed[];
  broadcasts: WorkerToTab[];
  botStateBroadcasts: number;
  backfillCalls: string[][];
  tabCount: number;
  destroy: () => void;
};

function makeHarness(overrides: Partial<BotEngineDeps> = {}): Harness {
  const priceFeeds: FakePriceFeed[] = [];
  const klineFeeds: FakeKlineFeed[] = [];
  const broadcasts: WorkerToTab[] = [];
  const backfillCalls: string[][] = [];
  const state = { botStateBroadcasts: 0, tabCount: 0 };

  const deps: BotEngineDeps = {
    broadcast: (msg) => broadcasts.push(msg),
    broadcastBotState: () => { state.botStateBroadcasts += 1; },
    getConnectedTabCount: () => state.tabCount,
    createPriceFeed: (assets) => {
      const f = new FakePriceFeed(assets);
      priceFeeds.push(f);
      return f;
    },
    createKlineFeed: (assets) => {
      const f = new FakeKlineFeed(assets);
      klineFeeds.push(f);
      return f as unknown as BinanceKlineFeed;
    },
    backfill: async (assets) => {
      backfillCalls.push([...assets]);
    },
    ...overrides
  };

  const engine = new BotEngine(deps);
  return {
    engine,
    priceFeeds,
    klineFeeds,
    broadcasts,
    get botStateBroadcasts() { return state.botStateBroadcasts; },
    set botStateBroadcasts(n: number) { state.botStateBroadcasts = n; },
    backfillCalls,
    get tabCount() { return state.tabCount; },
    set tabCount(n: number) { state.tabCount = n; },
    destroy: () => engine.destroy()
  };
}

function resetStores(): void {
  // Clear persisted state
  localStorage.clear();
  // Reset in-memory svelte stores (module singletons shared across tests)
  const priceKeys = new Set(Object.keys(get(prices)));
  pruneAssets(priceKeys);
  const volumeKeys = new Set(Object.keys(get(volumes)));
  pruneVolumes(volumeKeys);
  const candleKeys = new Set<string>();
  for (const iv of CANDLE_INTERVALS) {
    for (const k of Object.keys(get(candleStores[iv]))) candleKeys.add(k);
  }
  pruneCandles(candleKeys);
  resetCooldowns();
  clearLogs();
}

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  resetStores();
});

// ---------------------------------------------------------------------------
// Feed wiring
// ---------------------------------------------------------------------------
describe('BotEngine — feed lifecycle', () => {
  it('creates and starts feeds on setEnabledAssets', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    expect(h.priceFeeds).toHaveLength(1);
    expect(h.klineFeeds).toHaveLength(1);
    expect(h.priceFeeds[0].started).toBe(true);
    expect(h.klineFeeds[0].started).toBe(true);
    expect(h.priceFeeds[0].assets).toEqual(['bitcoin']);
    h.destroy();
  });

  it('does not restart feeds when the enabled set is unchanged', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    h.engine.setEnabledAssets(['bitcoin']);
    expect(h.priceFeeds).toHaveLength(1);
    h.destroy();
  });

  it('restarts feeds when the enabled set changes', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    h.engine.setEnabledAssets(['bitcoin', 'ethereum']);
    expect(h.priceFeeds).toHaveLength(2);
    expect(h.priceFeeds[0].stopped).toBe(true);
    expect(h.priceFeeds[1].assets).toEqual(['bitcoin', 'ethereum']);
    h.destroy();
  });

  it('calls backfill on initial setEnabledAssets', async () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    await Promise.resolve();
    expect(h.backfillCalls).toEqual([['bitcoin']]);
    h.destroy();
  });

  it('calls backfill only for newly added assets', async () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    await Promise.resolve();
    h.engine.setEnabledAssets(['bitcoin', 'ethereum']);
    await Promise.resolve();
    expect(h.backfillCalls).toEqual([['bitcoin'], ['ethereum']]);
    h.destroy();
  });

  it('reconnect restarts the chosen feed', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    const priceFeed = h.priceFeeds[0];
    h.engine.reconnect('price');
    expect(priceFeed.stopped).toBe(true);
    expect(priceFeed.started).toBe(true); // started again
    h.destroy();
  });
});

// ---------------------------------------------------------------------------
// Broadcasts on feed events
// ---------------------------------------------------------------------------
describe('BotEngine — broadcasts', () => {
  it('broadcasts priceStatus on status change', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    h.broadcasts.length = 0;
    h.priceFeeds[0].emitStatus('open');
    expect(h.broadcasts).toContainEqual({ type: 'priceStatus', status: 'open' });
    h.destroy();
  });

  it('broadcasts priceTick on tick', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    h.broadcasts.length = 0;
    h.priceFeeds[0].emitTick('bitcoin', 50000, 1_000_000);
    expect(h.broadcasts).toContainEqual({
      type: 'priceTick',
      asset: 'bitcoin',
      price: 50000,
      receivedAt: 1_000_000
    });
    h.destroy();
  });

  it('broadcasts closedCandle on candle close', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    h.broadcasts.length = 0;
    const emit: CandleEmit = {
      asset: 'bitcoin',
      interval: '1m',
      openTime: 100,
      closeTime: 160,
      open: 49000,
      high: 51000,
      low: 48500,
      close: 50500,
      baseVolume: 12.5
    };
    h.klineFeeds[0].emitCandle(emit);
    expect(h.broadcasts).toContainEqual({
      type: 'closedCandle',
      asset: 'bitcoin',
      interval: '1m',
      candle: {
        openTime: 100,
        closeTime: 160,
        open: 49000,
        high: 51000,
        low: 48500,
        close: 50500,
        baseVolume: 12.5
      }
    });
    h.destroy();
  });

  it('records a feed error when an open connection drops', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    h.priceFeeds[0].emitStatus('open');
    h.priceFeeds[0].emitStatus('closed');
    const state = h.engine.getState();
    expect(state.reconnectCount.price).toBe(1);
    expect(state.recentErrors).toHaveLength(1);
    expect(state.recentErrors[0].feed).toBe('price');
    h.destroy();
  });

  it('getState returns the current enabled asset list and tab count', () => {
    const h = makeHarness();
    h.tabCount = 3;
    h.engine.setEnabledAssets(['bitcoin', 'ethereum']);
    const state = h.engine.getState();
    expect(state.enabledAssets).toEqual(['bitcoin', 'ethereum']);
    expect(state.connectedTabCount).toBe(3);
    h.destroy();
  });
});

// ---------------------------------------------------------------------------
// Alert evaluation
// ---------------------------------------------------------------------------
describe('BotEngine — alert evaluation', () => {
  it('fires a price-above alert and broadcasts notify', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    h.engine.addAlert({ asset: 'bitcoin', interval: '1m', kind: 'above', value: 40000 } as NewAlert);
    h.broadcasts.length = 0;
    h.priceFeeds[0].emitTick('bitcoin', 45000, 1_000_000);
    const notifyMsg = h.broadcasts.find((m) => m.type === 'notify');
    expect(notifyMsg).toBeDefined();
    if (notifyMsg && notifyMsg.type === 'notify') {
      expect(notifyMsg.title).toBe('tayrax · bitcoin');
      expect(notifyMsg.body).toMatch(/above \$40000/);
    }
    h.destroy();
  });

  it('marks the alert as fired and updates lastFiredAt in the snapshot', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    h.engine.addAlert({ asset: 'bitcoin', interval: '1m', kind: 'above', value: 40000 } as NewAlert);
    h.priceFeeds[0].emitTick('bitcoin', 45000, 1_000_000);
    const snapshot = h.engine.getAlertsSnapshot();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].lastFiredAt).not.toBeNull();
    h.destroy();
  });

  it('logs an alertDispatched entry when an alert fires', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    h.engine.addAlert({ asset: 'bitcoin', interval: '1m', kind: 'above', value: 40000 } as NewAlert);
    h.priceFeeds[0].emitTick('bitcoin', 45000, 1_000_000);
    const entries = get(logs);
    const dispatched = entries.filter((e) => e.kind === 'alertDispatched');
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].asset).toBe('bitcoin');
    h.destroy();
  });

  it('respects the alert cooldown — does not fire twice in quick succession', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    h.engine.addAlert({ asset: 'bitcoin', interval: '1m', kind: 'above', value: 40000 } as NewAlert);
    h.priceFeeds[0].emitTick('bitcoin', 45000, 1_000_000);
    h.priceFeeds[0].emitTick('bitcoin', 46000, 1_000_000 + 60_000);
    const entries = get(logs);
    const dispatched = entries.filter((e) => e.kind === 'alertDispatched');
    expect(dispatched).toHaveLength(1);
    h.destroy();
  });

  it('does not fire alerts for disabled assets', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']); // ethereum NOT enabled
    h.engine.addAlert({ asset: 'ethereum', interval: '1m', kind: 'above', value: 2000 } as NewAlert);
    h.priceFeeds[0].emitTick('ethereum', 3000, 1_000_000);
    const entries = get(logs);
    expect(entries.filter((e) => e.kind === 'alertDispatched')).toHaveLength(0);
    h.destroy();
  });

  it('picks up alerts added after feeds are started', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    h.engine.addAlert({ asset: 'bitcoin', interval: '1m', kind: 'above', value: 40000 } as NewAlert);
    h.priceFeeds[0].emitTick('bitcoin', 45000, 1_000_000);
    const entries = get(logs);
    expect(entries.filter((e) => e.kind === 'alertDispatched')).toHaveLength(1);
    h.destroy();
  });

  it('broadcasts alertList on addAlert', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    h.broadcasts.length = 0;
    h.engine.addAlert({ asset: 'bitcoin', interval: '1m', kind: 'above', value: 40000 } as NewAlert);
    const msg = h.broadcasts.find((m) => m.type === 'alertList');
    expect(msg).toBeDefined();
    if (msg && msg.type === 'alertList') {
      expect(msg.alerts).toHaveLength(1);
      expect(msg.alerts[0].asset).toBe('bitcoin');
    }
    h.destroy();
  });

  it('removeAlert removes the alert from the snapshot and broadcasts', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    h.engine.addAlert({ asset: 'bitcoin', interval: '1m', kind: 'above', value: 40000 } as NewAlert);
    const id = h.engine.getAlertsSnapshot()[0].id;
    h.broadcasts.length = 0;
    h.engine.removeAlert(id);
    expect(h.engine.getAlertsSnapshot()).toHaveLength(0);
    const msg = h.broadcasts.find((m) => m.type === 'alertList');
    expect(msg).toBeDefined();
    h.destroy();
  });
});

// ---------------------------------------------------------------------------
// Proposal evaluation (indicator-driven)
// ---------------------------------------------------------------------------
// Helper to build a monotonically decreasing price series that produces RSI < 30
function makeOversoldCandles(): OHLCVCandle[] {
  // Sustained downtrend — 30 candles, each lower than the last.
  const out: OHLCVCandle[] = [];
  const start = 100;
  for (let i = 0; i < 30; i++) {
    const openTime = 1_000 + i * 60_000;
    const price = start - i * 0.5;
    out.push({
      openTime,
      closeTime: openTime + 60_000,
      open: price + 0.1,
      high: price + 0.2,
      low: price - 0.1,
      close: price,
      baseVolume: 10
    });
  }
  return out;
}

describe('BotEngine — proposal evaluation', () => {
  it('emits a tradeProposed log entry for an RSI-oversold signal', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);

    // Seed candle history (downtrend → RSI oversold)
    prependCandles('1m', 'bitcoin', makeOversoldCandles());

    // A tick to trigger evaluation
    h.priceFeeds[0].emitTick('bitcoin', 85, 2_000_000);

    const entries = get(logs);
    const proposed = entries.filter((e) => e.kind === 'tradeProposed');
    expect(proposed.length).toBeGreaterThanOrEqual(1);
    expect(proposed.some((p) => p.data?.signal === 'rsiOversold')).toBe(true);
    h.destroy();
  });

  it('respects the proposal cooldown — same signal does not re-fire within window', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    prependCandles('1m', 'bitcoin', makeOversoldCandles());

    h.priceFeeds[0].emitTick('bitcoin', 85, 2_000_000);
    const countAfterFirst = get(logs).filter(
      (e) => e.kind === 'tradeProposed' && e.data?.signal === 'rsiOversold'
    ).length;

    h.priceFeeds[0].emitTick('bitcoin', 84, 2_000_000 + 60_000);
    const countAfterSecond = get(logs).filter(
      (e) => e.kind === 'tradeProposed' && e.data?.signal === 'rsiOversold'
    ).length;

    expect(countAfterFirst).toBeGreaterThanOrEqual(1);
    expect(countAfterSecond).toBe(countAfterFirst); // no new rsiOversold entry
    h.destroy();
  });

  it('does not emit proposals for assets without candle history', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    // No prependCandles — bitcoin has no history
    h.priceFeeds[0].emitTick('bitcoin', 50000, 2_000_000);
    const entries = get(logs);
    expect(entries.filter((e) => e.kind === 'tradeProposed')).toHaveLength(0);
    h.destroy();
  });
});

// ---------------------------------------------------------------------------
// Candle and volume pipeline
// ---------------------------------------------------------------------------
describe('BotEngine — candle + volume updates', () => {
  it('updates the 1m volume store on 1m candle close', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    h.klineFeeds[0].emitCandle({
      asset: 'bitcoin',
      interval: '1m',
      openTime: 100,
      closeTime: 160,
      open: 49000,
      high: 51000,
      low: 48500,
      close: 50500,
      baseVolume: 12.5
    });
    const v = get(volumes);
    expect(v['bitcoin']).toBeDefined();
    expect(v['bitcoin'].latest).toBe(12.5);
    h.destroy();
  });

  it('does NOT update the volume store on non-1m candles', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    h.klineFeeds[0].emitCandle({
      asset: 'bitcoin',
      interval: '1h',
      openTime: 100,
      closeTime: 3_600_100,
      open: 49000,
      high: 51000,
      low: 48500,
      close: 50500,
      baseVolume: 500
    });
    const v = get(volumes);
    expect(v['bitcoin']).toBeUndefined();
    h.destroy();
  });

  it('appends the candle to the matching interval store', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    h.klineFeeds[0].emitCandle({
      asset: 'bitcoin',
      interval: '15m',
      openTime: 100,
      closeTime: 900_100,
      open: 49000,
      high: 51000,
      low: 48500,
      close: 50500,
      baseVolume: 100
    });
    const m = get(candleStores['15m']);
    expect(m['bitcoin']).toBeDefined();
    expect(m['bitcoin'].at(-1)?.close).toBe(50500);
    h.destroy();
  });
});

// ---------------------------------------------------------------------------
// Alert state after fire
// ---------------------------------------------------------------------------
describe('BotEngine — markFired behavior', () => {
  it('persists lastFiredAt across subsequent snapshots', () => {
    const h = makeHarness();
    h.engine.setEnabledAssets(['bitcoin']);
    h.engine.addAlert({ asset: 'bitcoin', interval: '1m', kind: 'above', value: 40000 } as NewAlert);
    h.priceFeeds[0].emitTick('bitcoin', 45000, 1_000_000);

    const before = h.engine.getAlertsSnapshot();
    expect(before[0].lastFiredAt).not.toBeNull();

    const after = h.engine.getAlertsSnapshot();
    expect(after[0].lastFiredAt).toBe(before[0].lastFiredAt);
    h.destroy();
  });
});
