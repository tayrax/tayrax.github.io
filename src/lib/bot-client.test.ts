// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { WorkerToTab } from './bot-types';

// ---------------------------------------------------------------------------
// Hoisted capture refs — available inside vi.mock factories (hoisted too)
// ---------------------------------------------------------------------------
type PriceFeedInstance = {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  _emitStatus(s: string): void;
  _emitTick(t: { asset: string; price: number; receivedAt: number }): void;
};

type KlineFeedInstance = {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  _emitCandle(c: {
    asset: string; interval: string;
    openTime: number; closeTime: number;
    open: number; high: number; low: number; close: number; baseVolume: number;
  }): void;
};

const captured = vi.hoisted(() => ({
  priceFeed: null as PriceFeedInstance | null,
  klineFeed: null as KlineFeedInstance | null,
}));

// ---------------------------------------------------------------------------
// Mock feed modules — class definitions live inside factories (not hoisted)
// ---------------------------------------------------------------------------
vi.mock('./binance-price', () => {
  class BinancePriceFeed {
    _statusListeners: Array<(s: string) => void> = [];
    _tickListeners: Array<(t: { asset: string; price: number; receivedAt: number }) => void> = [];
    start = vi.fn();
    stop = vi.fn();
    constructor() { captured.priceFeed = this as unknown as PriceFeedInstance; }
    onStatus(fn: (s: string) => void) {
      this._statusListeners.push(fn);
      fn('idle');
      return () => { this._statusListeners = this._statusListeners.filter((f) => f !== fn); };
    }
    onTick(fn: (t: { asset: string; price: number; receivedAt: number }) => void) {
      this._tickListeners.push(fn);
      return () => { this._tickListeners = this._tickListeners.filter((f) => f !== fn); };
    }
    _emitStatus(s: string) { this._statusListeners.forEach((fn) => fn(s)); }
    _emitTick(t: { asset: string; price: number; receivedAt: number }) {
      this._tickListeners.forEach((fn) => fn(t));
    }
  }
  return { BinancePriceFeed };
});

vi.mock('./binance', () => {
  type CandlePayload = {
    asset: string; interval: string;
    openTime: number; closeTime: number;
    open: number; high: number; low: number; close: number; baseVolume: number;
  };
  class BinanceKlineFeed {
    _candleListeners: Array<(c: CandlePayload) => void> = [];
    start = vi.fn();
    stop = vi.fn();
    constructor() { captured.klineFeed = this as unknown as KlineFeedInstance; }
    onCandleClosed(fn: (c: CandlePayload) => void) {
      this._candleListeners.push(fn);
      return () => { this._candleListeners = this._candleListeners.filter((f) => f !== fn); };
    }
    onStatus(fn: (s: string) => void) { fn('idle'); return () => {}; }
    _emitCandle(c: CandlePayload) { this._candleListeners.forEach((fn) => fn(c)); }
  }
  return { BinanceKlineFeed };
});

vi.mock('./websocket', () => {
  class PriceFeed {
    _statusListeners: Array<(s: string) => void> = [];
    _tickListeners: Array<(t: { asset: string; price: number; receivedAt: number }) => void> = [];
    start = vi.fn();
    stop = vi.fn();
    constructor() { captured.priceFeed = this as unknown as PriceFeedInstance; }
    onStatus(fn: (s: string) => void) {
      this._statusListeners.push(fn);
      fn('idle');
      return () => { this._statusListeners = this._statusListeners.filter((f) => f !== fn); };
    }
    onTick(fn: (t: { asset: string; price: number; receivedAt: number }) => void) {
      this._tickListeners.push(fn);
      return () => { this._tickListeners = this._tickListeners.filter((f) => f !== fn); };
    }
    _emitStatus(s: string) { this._statusListeners.forEach((fn) => fn(s)); }
    _emitTick(t: { asset: string; price: number; receivedAt: number }) {
      this._tickListeners.forEach((fn) => fn(t));
    }
  }
  return { PriceFeed };
});

// Import after mocks are registered
import { createBotClient } from './bot-client';

// ---------------------------------------------------------------------------
// createBotClient — factory selection
// ---------------------------------------------------------------------------
describe('createBotClient — factory', () => {
  it('returns FallbackBotClient when SharedWorker is unavailable', () => {
    vi.stubGlobal('SharedWorker', undefined);
    const client = createBotClient();
    expect(client).toBeDefined();
    client.destroy();
    vi.unstubAllGlobals();
  });

  it('returns SharedWorkerBotClient when SharedWorker is available', () => {
    const mockPort = {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      start: vi.fn(),
      close: vi.fn(),
    };
    vi.stubGlobal('SharedWorker', class { port = mockPort; });
    const client = createBotClient();
    expect(client).toBeDefined();
    client.destroy();
    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// FallbackBotClient — message routing
// ---------------------------------------------------------------------------
describe('FallbackBotClient', () => {
  beforeEach(() => {
    captured.priceFeed = null;
    captured.klineFeed = null;
    vi.stubGlobal('SharedWorker', undefined);
  });

  it('starts feeds when setEnabledAssets is sent', () => {
    const client = createBotClient();
    client.post({ type: 'setEnabledAssets', assets: ['bitcoin'] });
    expect(captured.priceFeed).not.toBeNull();
    expect(captured.klineFeed).not.toBeNull();
    expect(captured.priceFeed!.start).toHaveBeenCalledOnce();
    expect(captured.klineFeed!.start).toHaveBeenCalledOnce();
    client.destroy();
    vi.unstubAllGlobals();
  });

  it('routes priceStatus messages to subscribers', () => {
    const client = createBotClient();
    client.post({ type: 'setEnabledAssets', assets: ['bitcoin'] });
    const received: WorkerToTab[] = [];
    client.subscribe((msg) => received.push(msg));
    captured.priceFeed!._emitStatus('open');
    expect(received).toEqual([{ type: 'priceStatus', status: 'open' }]);
    client.destroy();
    vi.unstubAllGlobals();
  });

  it('routes priceTick messages to subscribers', () => {
    const client = createBotClient();
    client.post({ type: 'setEnabledAssets', assets: ['bitcoin'] });
    const received: WorkerToTab[] = [];
    client.subscribe((msg) => received.push(msg));
    captured.priceFeed!._emitTick({ asset: 'bitcoin', price: 50000, receivedAt: 1000 });
    expect(received).toEqual([{ type: 'priceTick', asset: 'bitcoin', price: 50000, receivedAt: 1000 }]);
    client.destroy();
    vi.unstubAllGlobals();
  });

  it('routes closedCandle messages to subscribers', () => {
    const client = createBotClient();
    client.post({ type: 'setEnabledAssets', assets: ['bitcoin'] });
    const received: WorkerToTab[] = [];
    client.subscribe((msg) => received.push(msg));
    const raw = {
      asset: 'bitcoin', interval: '1m',
      openTime: 100, closeTime: 160,
      open: 49000, high: 51000, low: 48000, close: 50000, baseVolume: 10,
    };
    captured.klineFeed!._emitCandle(raw);
    expect(received).toHaveLength(1);
    const msg = received[0] as Extract<WorkerToTab, { type: 'closedCandle' }>;
    expect(msg.type).toBe('closedCandle');
    expect(msg.asset).toBe('bitcoin');
    expect(msg.interval).toBe('1m');
    expect(msg.candle).toEqual({
      openTime: 100, closeTime: 160,
      open: 49000, high: 51000, low: 48000, close: 50000, baseVolume: 10,
    });
    client.destroy();
    vi.unstubAllGlobals();
  });

  it('unsubscribe removes handler from future messages', () => {
    const client = createBotClient();
    client.post({ type: 'setEnabledAssets', assets: ['bitcoin'] });
    const received: WorkerToTab[] = [];
    const unsub = client.subscribe((msg) => received.push(msg));
    captured.priceFeed!._emitStatus('open');
    expect(received).toHaveLength(1);
    unsub();
    captured.priceFeed!._emitStatus('closed');
    expect(received).toHaveLength(1); // no new message after unsub
    client.destroy();
    vi.unstubAllGlobals();
  });

  it('destroy stops feeds', () => {
    const client = createBotClient();
    client.post({ type: 'setEnabledAssets', assets: ['bitcoin'] });
    const feed = captured.priceFeed!;
    const kline = captured.klineFeed!;
    client.destroy();
    expect(feed.stop).toHaveBeenCalledOnce();
    expect(kline.stop).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it('destroy prevents further messages from reaching cleared subscribers', () => {
    const client = createBotClient();
    client.post({ type: 'setEnabledAssets', assets: ['bitcoin'] });
    const received: WorkerToTab[] = [];
    client.subscribe((msg) => received.push(msg));
    client.destroy();
    captured.priceFeed?._emitStatus('open');
    expect(received).toHaveLength(0);
    vi.unstubAllGlobals();
  });

  it('subscribeBotState is a no-op (FallbackBotClient has no worker state)', () => {
    const client = createBotClient();
    const received: WorkerToTab[] = [];
    client.subscribe((msg) => received.push(msg));
    expect(() => client.post({ type: 'subscribeBotState' })).not.toThrow();
    expect(received).toHaveLength(0);
    client.destroy();
    vi.unstubAllGlobals();
  });

  it('reconnect restarts price feed', () => {
    const client = createBotClient();
    client.post({ type: 'setEnabledAssets', assets: ['bitcoin'] });
    const feed = captured.priceFeed!;
    client.post({ type: 'reconnect', feed: 'price' });
    expect(feed.stop).toHaveBeenCalledOnce();
    expect(feed.start).toHaveBeenCalledTimes(2); // initial start + reconnect
    client.destroy();
    vi.unstubAllGlobals();
  });

  it('reconnect restarts kline feed', () => {
    const client = createBotClient();
    client.post({ type: 'setEnabledAssets', assets: ['bitcoin'] });
    const kline = captured.klineFeed!;
    client.post({ type: 'reconnect', feed: 'kline' });
    expect(kline.stop).toHaveBeenCalledOnce();
    expect(kline.start).toHaveBeenCalledTimes(2);
    client.destroy();
    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// SharedWorkerBotClient — port not closed on destroy
// ---------------------------------------------------------------------------
describe('SharedWorkerBotClient', () => {
  it('does not close the port on destroy (prevents premature worker termination)', () => {
    const mockPort = {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      start: vi.fn(),
      close: vi.fn(),
    };
    vi.stubGlobal('SharedWorker', class { port = mockPort; });
    const client = createBotClient();
    client.destroy();
    expect(mockPort.close).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('routes incoming port messages to subscribers', () => {
    let capturedListener: ((ev: MessageEvent) => void) | null = null;
    const mockPort = {
      postMessage: vi.fn(),
      addEventListener: vi.fn((type: string, fn: (ev: MessageEvent) => void) => {
        if (type === 'message') capturedListener = fn;
      }),
      start: vi.fn(),
      close: vi.fn(),
    };
    vi.stubGlobal('SharedWorker', class { port = mockPort; });
    const client = createBotClient();
    const received: WorkerToTab[] = [];
    client.subscribe((msg) => received.push(msg));
    const msg: WorkerToTab = { type: 'priceStatus', status: 'open' };
    capturedListener!({ data: msg } as MessageEvent);
    expect(received).toEqual([msg]);
    client.destroy();
    vi.unstubAllGlobals();
  });

  it('posts messages to the worker port', () => {
    const mockPort = {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      start: vi.fn(),
      close: vi.fn(),
    };
    vi.stubGlobal('SharedWorker', class { port = mockPort; });
    const client = createBotClient();
    client.post({ type: 'subscribeBotState' });
    expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'subscribeBotState' });
    client.destroy();
    vi.unstubAllGlobals();
  });
});
