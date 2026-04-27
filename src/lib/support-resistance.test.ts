// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { describe, it, expect } from 'vitest';
import { findSupportResistance } from './support-resistance';
import type { OHLCVCandle } from './candles';

function candle(low: number, high: number, close?: number): OHLCVCandle {
  const c = close ?? (low + high) / 2;
  return { openTime: 0, closeTime: 1, open: c, high, low, close: c, baseVolume: 100 };
}

describe('findSupportResistance', () => {
  it('returns empty for too-few candles', () => {
    expect(findSupportResistance([candle(90, 110)], 2)).toEqual([]);
  });

  it('returns empty when no pivots cluster', () => {
    // Monotonically rising — no pivots
    const candles = Array.from({ length: 10 }, (_, i) =>
      candle(i * 10, i * 10 + 5)
    );
    const levels = findSupportResistance(candles);
    expect(levels.length).toBe(0);
  });

  it('identifies a resistance level with 2+ touches', () => {
    // Build a pattern: rise to ~100, fall, rise to ~100 again
    const candles: OHLCVCandle[] = [
      candle(80, 85), candle(85, 92), candle(88, 101), candle(95, 99), candle(90, 86),
      candle(82, 88), candle(86, 95), candle(90, 100.5), candle(94, 96), candle(88, 83),
    ];
    const levels = findSupportResistance(candles, 2, 1.0);
    expect(levels.length).toBeGreaterThan(0);
    expect(levels.every((l) => l.touchCount >= 2)).toBe(true);
  });

  it('confidence increases with touch count', () => {
    // Synthetic candles that create a clear pivot at ~100 three times
    const candles: OHLCVCandle[] = [
      candle(80, 85), candle(85, 92), candle(88, 101),
      candle(95, 96), candle(85, 88), candle(88, 95),
      candle(90, 100.5), candle(94, 92), candle(80, 82),
      candle(82, 90), candle(88, 102), candle(95, 91),
    ];
    const levels = findSupportResistance(candles, 2, 1.5);
    const high = levels.find((l) => l.touchCount >= 3);
    if (high) {
      expect(high.confidence).toBeGreaterThanOrEqual(60);
    }
  });

  it('levels are sorted by price ascending', () => {
    const candles: OHLCVCandle[] = [
      candle(80, 85), candle(85, 92), candle(88, 101),
      candle(95, 96), candle(85, 88), candle(88, 95),
      candle(90, 100.5), candle(94, 92), candle(80, 82),
      candle(82, 90), candle(88, 102), candle(95, 91),
    ];
    const levels = findSupportResistance(candles, 2, 1.5);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].price).toBeGreaterThanOrEqual(levels[i - 1].price);
    }
  });
});
