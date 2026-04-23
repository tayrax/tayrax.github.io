// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import type { OHLCVCandle } from './candles';
import { toBinanceSymbol } from './symbols';
import { getCached, putCached, type HistoryPreset } from './history-cache';

type BinanceInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';

type PresetConfig = {
  interval: BinanceInterval;
  displayCount: number;
  limit: number;
};

// Each preset fetches displayCount + warmup candles in a single API call.
// The extra candles are used only for indicator warm-up (RSI, MACD, EMA) so
// that all displayed candles show accurate values, matching what trading
// platforms show when they have years of prior history.
export const PRESET_CONFIG: Record<HistoryPreset, PresetConfig> = {
  '1D':  { interval: '5m', displayCount: 288, limit:  488 },  // 288 + 200 warmup
  '3D':  { interval: '5m', displayCount: 864, limit:  964 },  // 864 + 100 warmup (200 would exceed 1000-candle limit)
  '1W':  { interval: '1h', displayCount: 168, limit:  368 },  // 168 + 200 warmup
  '1M':  { interval: '4h', displayCount: 180, limit:  380 },  // 180 + 200 warmup
  '6M':  { interval: '1d', displayCount: 182, limit:  382 },  // 182 + 200 warmup
  '1Y':  { interval: '1d', displayCount: 365, limit:  565 },  // 365 + 200 warmup
  '3Y':  { interval: '1w', displayCount: 156, limit:  256 },  // 156 + 100 warmup
  '5Y':  { interval: '1w', displayCount: 260, limit:  360 },  // 260 + 100 warmup
  'ALL': { interval: '1M', displayCount: 120, limit:  170 },  // 120 +  50 warmup
};

type BinanceKlineRow = [number, string, string, string, string, string, number, ...unknown[]];

const parseRow = (row: BinanceKlineRow): OHLCVCandle | null => {
  const open = Number(row[1]);
  const high = Number(row[2]);
  const low  = Number(row[3]);
  const close = Number(row[4]);
  const baseVolume = Number(row[5]);
  if (!Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) ||
      !Number.isFinite(close) || !Number.isFinite(baseVolume)) return null;
  return { openTime: row[0], closeTime: row[6], open, high, low, close, baseVolume };
};

const fetchFromBinance = async (asset: string, preset: HistoryPreset): Promise<OHLCVCandle[]> => {
  const symbol = toBinanceSymbol(asset);
  if (!symbol) return [];
  const { interval, limit } = PRESET_CONFIG[preset];
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance klines ${symbol} ${interval}: HTTP ${res.status}`);
  const rows = (await res.json()) as BinanceKlineRow[];
  const out: OHLCVCandle[] = [];
  for (const row of rows) {
    const c = parseRow(row);
    if (c) out.push(c);
  }
  return out;
};

export const fetchHistory = async (asset: string, preset: HistoryPreset): Promise<OHLCVCandle[]> => {
  const cached = await getCached(asset, preset);
  if (cached) return cached;
  const candles = await fetchFromBinance(asset, preset);
  await putCached(asset, preset, candles);
  return candles;
};
