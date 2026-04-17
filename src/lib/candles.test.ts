// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { CANDLE_HISTORY_MAX } from './config';
import { candleStores, applyClosedCandle, prependCandles } from './candles';
import type { OHLCVCandle } from './candles';
import type { ClosedCandle } from './binance';

const makeOHLCV = (openTime: number, close = 100): OHLCVCandle => ({
  openTime,
  closeTime: openTime + 59_999,
  open: close,
  high: close + 1,
  low: close - 1,
  close,
  baseVolume: 10
});

// Each test uses a unique asset name to avoid store state bleed between tests
// (the candles store is a module-level singleton in the test environment).
let assetCounter = 0;
const uniqueAsset = (): string => `test-asset-${++assetCounter}`;

const makeClosedCandle = (asset: string, openTime: number, close = 100): ClosedCandle => ({
  asset,
  interval: '1m',
  openTime,
  closeTime: openTime + 59_999,
  open: close,
  high: close + 1,
  low: close - 1,
  close,
  baseVolume: 10
});

beforeEach(() => {
  localStorage.clear();
});

describe('applyClosedCandle', () => {
  it('adds a candle to the store for the asset', () => {
    const asset = uniqueAsset();
    applyClosedCandle('1m', makeClosedCandle(asset, 1000));
    const map = get(candleStores['1m']);
    expect(map[asset]).toHaveLength(1);
    expect(map[asset][0].close).toBe(100);
  });

  it('appends subsequent candles in order', () => {
    const asset = uniqueAsset();
    applyClosedCandle('1m', makeClosedCandle(asset, 1000, 100));
    applyClosedCandle('1m', makeClosedCandle(asset, 2000, 200));
    const list = get(candleStores['1m'])[asset];
    expect(list).toHaveLength(2);
    expect(list[0].openTime).toBe(1000);
    expect(list[1].openTime).toBe(2000);
  });

  it('deduplicates candles with the same openTime (new wins)', () => {
    const asset = uniqueAsset();
    applyClosedCandle('1m', makeClosedCandle(asset, 1000, 100));
    applyClosedCandle('1m', makeClosedCandle(asset, 1000, 200));
    const list = get(candleStores['1m'])[asset];
    expect(list).toHaveLength(1);
    expect(list[0].close).toBe(200);
  });

  it('trims to CANDLE_HISTORY_MAX entries', () => {
    const asset = uniqueAsset();
    for (let i = 0; i < CANDLE_HISTORY_MAX + 5; i++) {
      applyClosedCandle('1m', makeClosedCandle(asset, i * 1000));
    }
    expect(get(candleStores['1m'])[asset]).toHaveLength(CANDLE_HISTORY_MAX);
  });
});

describe('prependCandles', () => {
  it('inserts historical candles before live candles', () => {
    const asset = uniqueAsset();
    applyClosedCandle('1m', makeClosedCandle(asset, 5000));
    prependCandles('1m', asset, [makeOHLCV(1000), makeOHLCV(2000), makeOHLCV(3000)]);
    const list = get(candleStores['1m'])[asset];
    expect(list[0].openTime).toBe(1000);
    expect(list[list.length - 1].openTime).toBe(5000);
  });

  it('does not overwrite live candles with historical ones (live wins)', () => {
    const asset = uniqueAsset();
    applyClosedCandle('1m', makeClosedCandle(asset, 3000, 999));
    prependCandles('1m', asset, [makeOHLCV(3000, 111)]);
    const list = get(candleStores['1m'])[asset];
    expect(list).toHaveLength(1);
    expect(list[0].close).toBe(999); // live value preserved
  });

  it('does nothing for an empty array', () => {
    const asset = uniqueAsset();
    applyClosedCandle('1m', makeClosedCandle(asset, 1000));
    prependCandles('1m', asset, []);
    expect(get(candleStores['1m'])[asset]).toHaveLength(1);
  });

  it('trims combined result to CANDLE_HISTORY_MAX', () => {
    const asset = uniqueAsset();
    const historical = Array.from({ length: CANDLE_HISTORY_MAX }, (_, i) =>
      makeOHLCV(i * 1000)
    );
    applyClosedCandle('1m', makeClosedCandle(asset, CANDLE_HISTORY_MAX * 1000));
    prependCandles('1m', asset, historical);
    expect(get(candleStores['1m'])[asset]).toHaveLength(CANDLE_HISTORY_MAX);
  });
});
