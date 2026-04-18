// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { describe, it, expect } from 'vitest';
import {
  evaluate,
  type StoredAlert,
  type EvalContext,
} from './alert-core';
import { ALERT_COOLDOWN_MS } from './config';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const makeAlert = (overrides: Partial<StoredAlert> = {}): StoredAlert =>
  ({
    id: 'test-id',
    asset: 'bitcoin',
    kind: 'above',
    value: 50_000,
    lastFiredAt: null,
    ...overrides,
  } as StoredAlert);

const priceCtx = (price: number, history: { price: number; at: number }[] = []): EvalContext => ({
  price: {
    price,
    prevPrice: null,
    updatedAt: Date.now(),
    history: history.length ? history : [{ price: price * 0.99, at: Date.now() - 1000 }, { price, at: Date.now() }],
  },
});

// ---------------------------------------------------------------------------
// evaluate — cooldown
// ---------------------------------------------------------------------------
describe('evaluate — cooldown', () => {
  it('returns null when the alert fired recently', () => {
    const now = Date.now();
    const alert = makeAlert({ lastFiredAt: now - ALERT_COOLDOWN_MS + 1 });
    expect(evaluate(alert, priceCtx(100_000), now)).toBeNull();
  });

  it('fires again once the cooldown expires', () => {
    const now = Date.now();
    const alert = makeAlert({ lastFiredAt: now - ALERT_COOLDOWN_MS - 1 });
    expect(evaluate(alert, priceCtx(100_000), now)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluate — above
// ---------------------------------------------------------------------------
describe('evaluate — above', () => {
  const alert = makeAlert({ kind: 'above', value: 50_000 });
  const now = Date.now();

  it('fires when price is above the threshold', () => {
    const result = evaluate(alert, priceCtx(51_000), now);
    expect(result).not.toBeNull();
    expect(result?.message).toContain('above');
    expect(result?.message).toContain('$50000');
  });

  it('does not fire when price equals the threshold', () => {
    expect(evaluate(alert, priceCtx(50_000), now)).toBeNull();
  });

  it('does not fire when price is below the threshold', () => {
    expect(evaluate(alert, priceCtx(49_000), now)).toBeNull();
  });

  it('returns null when no price data is available', () => {
    expect(evaluate(alert, {}, now)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluate — below
// ---------------------------------------------------------------------------
describe('evaluate — below', () => {
  const alert = makeAlert({ kind: 'below', value: 50_000 });
  const now = Date.now();

  it('fires when price is below the threshold', () => {
    expect(evaluate(alert, priceCtx(49_000), now)).not.toBeNull();
  });

  it('does not fire when price equals the threshold', () => {
    expect(evaluate(alert, priceCtx(50_000), now)).toBeNull();
  });

  it('does not fire when price is above the threshold', () => {
    expect(evaluate(alert, priceCtx(51_000), now)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluate — range
// ---------------------------------------------------------------------------
describe('evaluate — range', () => {
  const alert = makeAlert({ kind: 'range', low: 40_000, high: 60_000 } as StoredAlert);
  const now = Date.now();

  it('fires when price is within the range (inclusive)', () => {
    expect(evaluate(alert, priceCtx(40_000), now)).not.toBeNull();
    expect(evaluate(alert, priceCtx(50_000), now)).not.toBeNull();
    expect(evaluate(alert, priceCtx(60_000), now)).not.toBeNull();
  });

  it('does not fire when price is outside the range', () => {
    expect(evaluate(alert, priceCtx(39_999), now)).toBeNull();
    expect(evaluate(alert, priceCtx(60_001), now)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluate — pctChange
// ---------------------------------------------------------------------------
describe('evaluate — pctChange', () => {
  const alert = makeAlert({ kind: 'pctChange', value: 5 });
  const now = Date.now();

  it('fires when the absolute pct change meets or exceeds the threshold', () => {
    const ctx = priceCtx(105, [{ price: 100, at: now - 1000 }, { price: 105, at: now }]);
    expect(evaluate(alert, ctx, now)).not.toBeNull();
  });

  it('fires for negative moves beyond the threshold', () => {
    const ctx = priceCtx(94, [{ price: 100, at: now - 1000 }, { price: 94, at: now }]);
    expect(evaluate(alert, ctx, now)).not.toBeNull();
  });

  it('does not fire when the move is smaller than the threshold', () => {
    const ctx = priceCtx(103, [{ price: 100, at: now - 1000 }, { price: 103, at: now }]);
    expect(evaluate(alert, ctx, now)).toBeNull();
  });

  it('returns null when history is insufficient for pct calculation', () => {
    const ctx: EvalContext = {
      price: { price: 105, prevPrice: null, updatedAt: now, history: [] },
    };
    expect(evaluate(alert, ctx, now)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluate — volumeSpike
// ---------------------------------------------------------------------------
describe('evaluate — volumeSpike', () => {
  const alert = makeAlert({ kind: 'volumeSpike', multiplier: 3 } as StoredAlert);
  const now = Date.now();

  const makeVolumeCtx = (priorVolumes: number[], latest: number): EvalContext => ({
    volume: { recent: [...priorVolumes, latest], latest, updatedAt: now },
  });

  it('fires when the spike ratio meets the multiplier', () => {
    // 9 prior candles of volume 10, latest 30 → ratio 3 → meets threshold 3
    const ctx = makeVolumeCtx(Array(9).fill(10), 30);
    expect(evaluate(alert, ctx, now)).not.toBeNull();
  });

  it('fires when the spike ratio exceeds the multiplier', () => {
    const ctx = makeVolumeCtx(Array(9).fill(10), 50);
    expect(evaluate(alert, ctx, now)).not.toBeNull();
  });

  it('does not fire when the ratio is below the multiplier', () => {
    const ctx = makeVolumeCtx(Array(9).fill(10), 25);
    expect(evaluate(alert, ctx, now)).toBeNull();
  });

  it('does not fire when there are insufficient volume samples', () => {
    const ctx = makeVolumeCtx([10, 20], 100);
    expect(evaluate(alert, ctx, now)).toBeNull();
  });

  it('returns null when no volume data is available', () => {
    expect(evaluate(alert, {}, now)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluate — rsiBelow / rsiAbove
// ---------------------------------------------------------------------------
describe('evaluate — rsiBelow', () => {
  const alert = makeAlert({ kind: 'rsiBelow', value: 30, interval: '1m' } as StoredAlert);
  const now = Date.now();

  it('fires when RSI is below the threshold', () => {
    const ctx: EvalContext = { indicators: { sma20: null, sma50: null, ema12: null, ema26: null, rsi14: 25, macd: null, bb20: null } };
    expect(evaluate(alert, ctx, now)).not.toBeNull();
  });

  it('does not fire when RSI equals the threshold', () => {
    const ctx: EvalContext = { indicators: { sma20: null, sma50: null, ema12: null, ema26: null, rsi14: 30, macd: null, bb20: null } };
    expect(evaluate(alert, ctx, now)).toBeNull();
  });

  it('does not fire when RSI is above the threshold', () => {
    const ctx: EvalContext = { indicators: { sma20: null, sma50: null, ema12: null, ema26: null, rsi14: 45, macd: null, bb20: null } };
    expect(evaluate(alert, ctx, now)).toBeNull();
  });

  it('does not fire when rsi14 is null (not enough data)', () => {
    const ctx: EvalContext = { indicators: { sma20: null, sma50: null, ema12: null, ema26: null, rsi14: null, macd: null, bb20: null } };
    expect(evaluate(alert, ctx, now)).toBeNull();
  });

  it('returns null when no indicators are provided', () => {
    expect(evaluate(alert, {}, now)).toBeNull();
  });
});

describe('evaluate — rsiAbove', () => {
  const alert = makeAlert({ kind: 'rsiAbove', value: 70, interval: '1m' } as StoredAlert);
  const now = Date.now();

  it('fires when RSI is above the threshold', () => {
    const ctx: EvalContext = { indicators: { sma20: null, sma50: null, ema12: null, ema26: null, rsi14: 75, macd: null, bb20: null } };
    expect(evaluate(alert, ctx, now)).not.toBeNull();
  });

  it('does not fire at or below the threshold', () => {
    const ctx: EvalContext = { indicators: { sma20: null, sma50: null, ema12: null, ema26: null, rsi14: 70, macd: null, bb20: null } };
    expect(evaluate(alert, ctx, now)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluate — macdCross
// ---------------------------------------------------------------------------
describe('evaluate — macdCross', () => {
  const bullishAlert = makeAlert({ kind: 'macdCross', direction: 'bullish', interval: '1m' } as StoredAlert);
  const bearishAlert = makeAlert({ kind: 'macdCross', direction: 'bearish', interval: '1m' } as StoredAlert);
  const now = Date.now();

  const macdCtx = (histogram: number): EvalContext => ({
    indicators: {
      sma20: null, sma50: null, ema12: null, ema26: null, rsi14: null,
      macd: { macd: 0.01, signal: histogram > 0 ? -0.01 : 0.01, histogram },
      bb20: null
    }
  });

  it('bullish fires when histogram > 0', () => {
    expect(evaluate(bullishAlert, macdCtx(0.05), now)).not.toBeNull();
  });

  it('bullish does not fire when histogram <= 0', () => {
    expect(evaluate(bullishAlert, macdCtx(0), now)).toBeNull();
    expect(evaluate(bullishAlert, macdCtx(-0.05), now)).toBeNull();
  });

  it('bearish fires when histogram < 0', () => {
    expect(evaluate(bearishAlert, macdCtx(-0.05), now)).not.toBeNull();
  });

  it('bearish does not fire when histogram >= 0', () => {
    expect(evaluate(bearishAlert, macdCtx(0), now)).toBeNull();
    expect(evaluate(bearishAlert, macdCtx(0.05), now)).toBeNull();
  });

  it('returns null when macd is null', () => {
    const ctx: EvalContext = { indicators: { sma20: null, sma50: null, ema12: null, ema26: null, rsi14: null, macd: null, bb20: null } };
    expect(evaluate(bullishAlert, ctx, now)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluate — bbBreakout
// ---------------------------------------------------------------------------
describe('evaluate — bbBreakout', () => {
  const aboveAlert = makeAlert({ kind: 'bbBreakout', direction: 'above', interval: '1m' } as StoredAlert);
  const belowAlert = makeAlert({ kind: 'bbBreakout', direction: 'below', interval: '1m' } as StoredAlert);
  const now = Date.now();

  const bbCtx = (price: number): EvalContext => ({
    price: { price, prevPrice: null, updatedAt: now, history: [] },
    indicators: {
      sma20: null, sma50: null, ema12: null, ema26: null, rsi14: null, macd: null,
      bb20: { upper: 110, middle: 100, lower: 90 }
    }
  });

  it('above fires when price > upper band', () => {
    expect(evaluate(aboveAlert, bbCtx(115), now)).not.toBeNull();
  });

  it('above does not fire when price is at or below upper band', () => {
    expect(evaluate(aboveAlert, bbCtx(110), now)).toBeNull();
    expect(evaluate(aboveAlert, bbCtx(100), now)).toBeNull();
  });

  it('below fires when price < lower band', () => {
    expect(evaluate(belowAlert, bbCtx(85), now)).not.toBeNull();
  });

  it('below does not fire when price is at or above lower band', () => {
    expect(evaluate(belowAlert, bbCtx(90), now)).toBeNull();
    expect(evaluate(belowAlert, bbCtx(100), now)).toBeNull();
  });

  it('returns null when bb20 is null', () => {
    const ctx: EvalContext = {
      price: { price: 120, prevPrice: null, updatedAt: now, history: [] },
      indicators: { sma20: null, sma50: null, ema12: null, ema26: null, rsi14: null, macd: null, bb20: null }
    };
    expect(evaluate(aboveAlert, ctx, now)).toBeNull();
  });

  it('returns null when no price context', () => {
    const ctx: EvalContext = {
      indicators: { sma20: null, sma50: null, ema12: null, ema26: null, rsi14: null, macd: null, bb20: { upper: 110, middle: 100, lower: 90 } }
    };
    expect(evaluate(aboveAlert, ctx, now)).toBeNull();
  });
});

// Note: addAlert / removeAlert / markFired store-operation tests moved to
// bot-engine.test.ts — alerts.ts is now a tab-side mirror of the worker's
// authoritative list and does not own write operations.
