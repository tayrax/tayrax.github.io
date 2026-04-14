// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { prices, applyTick, pctChangeOverWindow, type PriceState } from './prices';

// ---------------------------------------------------------------------------
// pctChangeOverWindow
// ---------------------------------------------------------------------------
describe('pctChangeOverWindow', () => {
  const makeState = (price: number, history: { price: number; at: number }[]): PriceState => ({
    price,
    prevPrice: null,
    updatedAt: Date.now(),
    history,
  });

  it('returns null when history has fewer than 2 points', () => {
    expect(pctChangeOverWindow(makeState(100, []))).toBeNull();
    expect(pctChangeOverWindow(makeState(100, [{ price: 100, at: 0 }]))).toBeNull();
  });

  it('returns null when the oldest price is 0', () => {
    const state = makeState(100, [{ price: 0, at: 0 }, { price: 50, at: 1 }]);
    expect(pctChangeOverWindow(state)).toBeNull();
  });

  it('returns a positive percentage when price rose', () => {
    const state = makeState(110, [{ price: 100, at: 0 }, { price: 105, at: 1 }]);
    expect(pctChangeOverWindow(state)).toBeCloseTo(10);
  });

  it('returns a negative percentage when price fell', () => {
    const state = makeState(90, [{ price: 100, at: 0 }, { price: 95, at: 1 }]);
    expect(pctChangeOverWindow(state)).toBeCloseTo(-10);
  });

  it('returns 0 when price is unchanged', () => {
    const state = makeState(100, [{ price: 100, at: 0 }, { price: 100, at: 1 }]);
    expect(pctChangeOverWindow(state)).toBeCloseTo(0);
  });

  it('uses the oldest history point (not the second) as the base', () => {
    // oldest is 100, middle is 200, current is 150 → pct = (150-100)/100 = 50%
    const state = makeState(150, [
      { price: 100, at: 0 },
      { price: 200, at: 1 },
      { price: 150, at: 2 },
    ]);
    expect(pctChangeOverWindow(state)).toBeCloseTo(50);
  });
});

// ---------------------------------------------------------------------------
// applyTick (store integration)
// ---------------------------------------------------------------------------
describe('applyTick', () => {
  it('creates state for a new asset', () => {
    applyTick('test_price_new', 50_000, 1000);
    const state = get(prices)['test_price_new'];
    expect(state).toBeDefined();
    expect(state.price).toBe(50_000);
    expect(state.prevPrice).toBeNull();
    expect(state.updatedAt).toBe(1000);
    expect(state.history).toEqual([{ price: 50_000, at: 1000 }]);
  });

  it('updates price and tracks prevPrice on subsequent ticks', () => {
    const asset = 'test_price_update';
    applyTick(asset, 100, 1000);
    applyTick(asset, 110, 2000);
    const state = get(prices)[asset];
    expect(state.price).toBe(110);
    expect(state.prevPrice).toBe(100);
  });

  it('prunes history points older than the window', () => {
    const asset = 'test_price_prune';
    const windowMs = 60 * 60 * 1000; // PRICE_HISTORY_WINDOW_MS
    const now = Date.now();
    // Add a point well outside the window
    applyTick(asset, 1, now - windowMs - 1000);
    // Add a point inside the window
    applyTick(asset, 2, now);
    const state = get(prices)[asset];
    // The old point should have been pruned; only the recent one remains
    expect(state.history.every((p) => p.at >= now - windowMs)).toBe(true);
    expect(state.history.some((p) => p.price === 2)).toBe(true);
  });
});
