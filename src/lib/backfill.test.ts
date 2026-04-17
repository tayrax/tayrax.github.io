// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchKlines, backfillAll } from './backfill';

// Minimal Binance kline row: [openTime, open, high, low, close, volume, closeTime, ...]
const makeRow = (openTime: number, close: string): unknown[] => [
  openTime,   // 0 openTime
  '99.0',     // 1 open
  '101.0',    // 2 high
  '98.0',     // 3 low
  close,      // 4 close
  '500.0',    // 5 volume
  openTime + 59_999, // 6 closeTime
];

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchKlines', () => {
  it('parses kline rows into OHLCVCandle objects', async () => {
    const rows = [
      makeRow(1_000_000, '100.5'),
      makeRow(1_060_000, '101.0'),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => rows
    }));

    const result = await fetchKlines('bitcoin');
    expect(result).toHaveLength(2);
    expect(result[0].close).toBeCloseTo(100.5);
    expect(result[0].open).toBeCloseTo(99.0);
    expect(result[0].high).toBeCloseTo(101.0);
    expect(result[0].low).toBeCloseTo(98.0);
    expect(result[0].baseVolume).toBeCloseTo(500.0);
    expect(result[0].openTime).toBe(1_000_000);
    expect(result[0].closeTime).toBe(1_059_999);
  });

  it('returns empty array for unknown asset (no Binance symbol)', async () => {
    const result = await fetchKlines('unknowncoin');
    expect(result).toHaveLength(0);
  });

  it('throws when HTTP response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(fetchKlines('bitcoin')).rejects.toThrow('HTTP 429');
  });

  it('filters out rows with non-numeric values', async () => {
    const rows = [
      makeRow(1_000_000, '100.5'),
      [1_060_000, 'bad', '101', '98', 'NaN', '500', 1_119_999],
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => rows
    }));
    const result = await fetchKlines('bitcoin');
    expect(result).toHaveLength(1);
  });
});

describe('backfillAll', () => {
  it('calls fetch for each asset with a known Binance symbol', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => []
    });
    vi.stubGlobal('fetch', mockFetch);

    await backfillAll(['bitcoin', 'ethereum']);
    // 2 assets × 5 intervals (1m, 15m, 1h, 4h, 1d)
    expect(mockFetch).toHaveBeenCalledTimes(10);
  });

  it('does not throw when one asset fetch fails', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error('network error'));
      return Promise.resolve({ ok: true, json: async () => [] });
    }));

    await expect(backfillAll(['bitcoin', 'ethereum'])).resolves.toBeUndefined();
  });
});
