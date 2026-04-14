// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { volumes, applyCandle, median, volumeSpikeRatio } from './volumes';

// ---------------------------------------------------------------------------
// median
// ---------------------------------------------------------------------------
describe('median', () => {
  it('returns null for an empty array', () => {
    expect(median([])).toBeNull();
  });

  it('returns the single element for a one-element array', () => {
    expect(median([5])).toBe(5);
  });

  it('returns the middle value for an odd-length array', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('returns the average of the two middle values for an even-length array', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('does not mutate the input array', () => {
    const arr = [4, 2, 3, 1];
    median(arr);
    expect(arr).toEqual([4, 2, 3, 1]);
  });
});

// ---------------------------------------------------------------------------
// volumeSpikeRatio
// ---------------------------------------------------------------------------
describe('volumeSpikeRatio', () => {
  it('returns null when there are fewer than 10 samples', () => {
    expect(volumeSpikeRatio({ recent: [1, 2, 3], latest: 10, updatedAt: 0 })).toBeNull();
    expect(volumeSpikeRatio({ recent: Array(9).fill(1), latest: 5, updatedAt: 0 })).toBeNull();
  });

  it('returns null when the baseline median is 0', () => {
    // 10 samples, all prior ones are 0
    const recent = [...Array(9).fill(0), 100];
    expect(volumeSpikeRatio({ recent, latest: 100, updatedAt: 0 })).toBeNull();
  });

  it('computes ratio of latest candle to median of prior candles', () => {
    // 10 samples: prior 9 are all 10, latest is 50 → ratio = 50/10 = 5
    const recent = [...Array(9).fill(10), 50];
    expect(volumeSpikeRatio({ recent, latest: 50, updatedAt: 0 })).toBeCloseTo(5);
  });

  it('returns ~1 when latest matches the baseline median', () => {
    const recent = [...Array(9).fill(10), 10];
    expect(volumeSpikeRatio({ recent, latest: 10, updatedAt: 0 })).toBeCloseTo(1);
  });
});

// ---------------------------------------------------------------------------
// applyCandle (store integration)
// ---------------------------------------------------------------------------
describe('applyCandle', () => {
  const ASSET = 'bitcoin';

  beforeEach(() => {
    // Reset the store to a known empty state before each test by reading
    // current value — we can't easily reset module-level state, so we build
    // on an isolated asset name per test block instead.
  });

  it('creates a new entry for an asset on first candle', () => {
    applyCandle('test_asset_new', 42, 1000);
    const state = get(volumes)['test_asset_new'];
    expect(state).toBeDefined();
    expect(state.latest).toBe(42);
    expect(state.recent).toEqual([42]);
    expect(state.updatedAt).toBe(1000);
  });

  it('appends subsequent candles to recent history', () => {
    applyCandle(ASSET, 10, 1000);
    applyCandle(ASSET, 20, 2000);
    applyCandle(ASSET, 30, 3000);
    const state = get(volumes)[ASSET];
    expect(state.recent).toContain(10);
    expect(state.recent).toContain(20);
    expect(state.recent).toContain(30);
    expect(state.latest).toBe(30);
  });

  it('caps recent history at 20 samples', () => {
    const asset = 'test_asset_cap';
    for (let i = 0; i < 25; i++) applyCandle(asset, i, i * 1000);
    expect(get(volumes)[asset].recent.length).toBe(20);
    // should keep the 20 most recent values (5..24)
    expect(get(volumes)[asset].recent[0]).toBe(5);
    expect(get(volumes)[asset].recent[19]).toBe(24);
  });
});
