// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { describe, it, expect } from 'vitest';
import { sma, ema, rsi, macd, bollingerBands, computeIndicators } from './indicators';
import type { OHLCVCandle } from './candles';

const makeCandles = (closes: number[]): OHLCVCandle[] =>
  closes.map((close, i) => ({
    openTime: i * 60_000,
    closeTime: (i + 1) * 60_000,
    open: close,
    high: close,
    low: close,
    close,
    baseVolume: 1
  }));

describe('sma', () => {
  it('returns null when fewer candles than period', () => {
    expect(sma(makeCandles([1, 2, 3]), 5)).toBeNull();
  });

  it('returns exact average of last N closes', () => {
    const candles = makeCandles([1, 2, 3, 4, 5]);
    expect(sma(candles, 3)).toBeCloseTo((3 + 4 + 5) / 3);
    expect(sma(candles, 5)).toBeCloseTo((1 + 2 + 3 + 4 + 5) / 5);
  });

  it('returns the value itself for a flat series', () => {
    expect(sma(makeCandles([7, 7, 7, 7]), 4)).toBeCloseTo(7);
  });
});

describe('ema', () => {
  it('returns null when fewer candles than period', () => {
    expect(ema(makeCandles([1, 2]), 5)).toBeNull();
  });

  it('returns SMA when exactly period candles provided', () => {
    const candles = makeCandles([2, 4, 6, 8]);
    expect(ema(candles, 4)).toBeCloseTo((2 + 4 + 6 + 8) / 4);
  });

  it('responds to recent price changes (more weight on recent closes)', () => {
    // flat at 10, two closes at 20 — EMA should overshoot 15 toward 20
    const candles = makeCandles([10, 10, 10, 10, 20, 20]);
    const result = ema(candles, 3);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(10);
    expect(result!).toBeLessThan(20);
    expect(result!).toBeGreaterThan(15); // second 20-close pushes EMA above midpoint
  });
});

describe('rsi', () => {
  it('returns null when fewer than period+1 candles', () => {
    expect(rsi(makeCandles([1, 2, 3, 4, 5]), 14)).toBeNull();
  });

  it('returns 100 for a strictly rising series (no losses)', () => {
    const closes = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(rsi(makeCandles(closes), 14)).toBeCloseTo(100);
  });

  it('returns a low RSI for a strictly falling series', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 20 - i);
    const result = rsi(makeCandles(closes), 14);
    expect(result).not.toBeNull();
    expect(result!).toBeLessThan(10);
  });

  it('returns ~50 for alternating up/down series', () => {
    const closes = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 10 : 11));
    const result = rsi(makeCandles(closes), 14);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(40);
    expect(result!).toBeLessThan(60);
  });
});

describe('macd', () => {
  it('returns null when not enough candles', () => {
    expect(macd(makeCandles(Array(30).fill(1)), 12, 26, 9)).toBeNull();
  });

  it('returns zero macd/signal/histogram for a perfectly flat series', () => {
    const closes = Array(50).fill(100);
    const result = macd(makeCandles(closes));
    expect(result).not.toBeNull();
    expect(result!.macd).toBeCloseTo(0, 5);
    expect(result!.signal).toBeCloseTo(0, 5);
    expect(result!.histogram).toBeCloseTo(0, 5);
  });

  it('returns positive histogram when short EMA > long EMA (rising prices)', () => {
    // Start flat, then rapidly rising — fast EMA should exceed slow EMA
    const flat = Array(30).fill(100);
    const rising = Array.from({ length: 20 }, (_, i) => 100 + (i + 1) * 5);
    const result = macd(makeCandles([...flat, ...rising]));
    expect(result).not.toBeNull();
    expect(result!.macd).toBeGreaterThan(0);
  });
});

describe('bollingerBands', () => {
  it('returns null when fewer candles than period', () => {
    expect(bollingerBands(makeCandles([1, 2, 3]), 20)).toBeNull();
  });

  it('middle band equals SMA of last period closes', () => {
    const closes = Array.from({ length: 25 }, (_, i) => i + 1);
    const result = bollingerBands(makeCandles(closes), 20);
    const expectedMiddle = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    expect(result).not.toBeNull();
    expect(result!.middle).toBeCloseTo(expectedMiddle);
  });

  it('upper > middle > lower', () => {
    const closes = Array.from({ length: 25 }, (_, i) => 10 + Math.sin(i) * 2);
    const result = bollingerBands(makeCandles(closes), 20);
    expect(result).not.toBeNull();
    expect(result!.upper).toBeGreaterThan(result!.middle);
    expect(result!.middle).toBeGreaterThan(result!.lower);
  });

  it('bands collapse to middle for a flat series (zero std dev)', () => {
    const result = bollingerBands(makeCandles(Array(25).fill(50)), 20);
    expect(result).not.toBeNull();
    expect(result!.upper).toBeCloseTo(50);
    expect(result!.middle).toBeCloseTo(50);
    expect(result!.lower).toBeCloseTo(50);
  });
});

describe('computeIndicators', () => {
  it('returns all nulls for an empty array', () => {
    const ind = computeIndicators([]);
    expect(ind.sma20).toBeNull();
    expect(ind.sma50).toBeNull();
    expect(ind.ema12).toBeNull();
    expect(ind.ema26).toBeNull();
    expect(ind.rsi14).toBeNull();
    expect(ind.macd).toBeNull();
    expect(ind.bb20).toBeNull();
  });

  it('returns non-null indicators with sufficient candles', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i);
    const ind = computeIndicators(makeCandles(closes));
    expect(ind.sma20).not.toBeNull();
    expect(ind.sma50).not.toBeNull();
    expect(ind.ema12).not.toBeNull();
    expect(ind.ema26).not.toBeNull();
    expect(ind.rsi14).not.toBeNull();
    expect(ind.macd).not.toBeNull();
    expect(ind.bb20).not.toBeNull();
  });
});
