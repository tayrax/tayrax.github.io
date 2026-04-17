// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { CANDLE_HISTORY_MAX, CANDLE_INTERVALS, type CandleInterval } from './config';
import { toBinanceSymbol } from './symbols';
import type { OHLCVCandle } from './candles';
import { prependCandles } from './candles';

// Raw Binance kline array element indices (REST /api/v3/klines response)
const IDX_OPEN_TIME = 0;
const IDX_OPEN = 1;
const IDX_HIGH = 2;
const IDX_LOW = 3;
const IDX_CLOSE = 4;
const IDX_VOLUME = 5;
const IDX_CLOSE_TIME = 6;

type BinanceKlineRow = [
  number, // openTime
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  number, // closeTime
  ...unknown[]
];

const parseRow = (row: BinanceKlineRow): OHLCVCandle | null => {
  const open = Number(row[IDX_OPEN]);
  const high = Number(row[IDX_HIGH]);
  const low = Number(row[IDX_LOW]);
  const close = Number(row[IDX_CLOSE]);
  const baseVolume = Number(row[IDX_VOLUME]);
  if (
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close) ||
    !Number.isFinite(baseVolume)
  ) return null;
  return {
    openTime: row[IDX_OPEN_TIME],
    closeTime: row[IDX_CLOSE_TIME],
    open,
    high,
    low,
    close,
    baseVolume
  };
};

export const fetchKlines = async (
  asset: string,
  interval: CandleInterval = '1m',
  limit = CANDLE_HISTORY_MAX
): Promise<OHLCVCandle[]> => {
  const symbol = toBinanceSymbol(asset);
  if (!symbol) return [];
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance klines ${symbol}: HTTP ${res.status}`);
  const rows = (await res.json()) as BinanceKlineRow[];
  const out: OHLCVCandle[] = [];
  for (const row of rows) {
    const candle = parseRow(row);
    if (candle) out.push(candle);
  }
  return out;
};

// Backfills all intervals for the given assets. Intervals are fetched sequentially
// with a 300 ms gap between each to avoid hitting Binance rate limits.
export const backfillAll = async (assets: readonly string[]): Promise<void> => {
  for (let i = 0; i < CANDLE_INTERVALS.length; i++) {
    if (i > 0) await new Promise<void>((r) => setTimeout(r, 300));
    const interval = CANDLE_INTERVALS[i];
    await Promise.allSettled(
      assets.map(async (asset) => {
        try {
          const historical = await fetchKlines(asset, interval);
          prependCandles(interval, asset, historical);
        } catch {
          // Non-fatal: live stream will populate candles over time
        }
      })
    );
  }
};
