// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import type { OHLCVCandle } from './candles';

export type MACDResult = {
  macd: number;
  signal: number;
  histogram: number;
};

export type BollingerBandsResult = {
  upper: number;
  middle: number;
  lower: number;
};

export type IndicatorValues = {
  sma20: number | null;
  sma50: number | null;
  ema12: number | null;
  ema26: number | null;
  rsi14: number | null;
  macd: MACDResult | null;
  bb20: BollingerBandsResult | null;
};

// Returns the SMA of the last `period` closing prices, or null if not enough data.
export const sma = (candles: OHLCVCandle[], period: number): number | null => {
  if (candles.length < period) return null;
  const slice = candles.slice(candles.length - period);
  const sum = slice.reduce((acc, c) => acc + c.close, 0);
  return sum / period;
};

// Returns the EMA of closing prices for all candles, seeded with SMA for the first period.
// Returns null if not enough data.
export const ema = (candles: OHLCVCandle[], period: number): number | null => {
  if (candles.length < period) return null;
  const k = 2 / (period + 1);
  // Seed with SMA of first `period` candles
  let value = candles.slice(0, period).reduce((acc, c) => acc + c.close, 0) / period;
  for (let i = period; i < candles.length; i++) {
    value = candles[i].close * k + value * (1 - k);
  }
  return value;
};

// Returns the RSI(period) for the last candle, or null if not enough data.
// Standard Wilder RSI using smoothed averages.
export const rsi = (candles: OHLCVCandle[], period = 14): number | null => {
  // Need period+1 candles to compute period changes
  if (candles.length < period + 1) return null;

  const closes = candles.map((c) => c.close);
  // Compute first avgGain/avgLoss over initial period
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += -diff;
  }
  avgGain /= period;
  avgLoss /= period;

  // Smooth over the rest of the candles
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
};

// Returns MACD line, signal line, and histogram for the last candle.
// Requires at least slow+signal-1 candles for a meaningful signal EMA.
export const macd = (
  candles: OHLCVCandle[],
  fast = 12,
  slow = 26,
  signal = 9
): MACDResult | null => {
  if (candles.length < slow + signal - 1) return null;

  // Build an array of MACD values (ema12 - ema26) for each candle starting at index `slow-1`
  const k_fast = 2 / (fast + 1);
  const k_slow = 2 / (slow + 1);

  // Seed EMAs with SMA of first `fast`/`slow` candles
  let ema_fast = candles.slice(0, fast).reduce((s, c) => s + c.close, 0) / fast;
  let ema_slow = candles.slice(0, slow).reduce((s, c) => s + c.close, 0) / slow;

  const macdValues: number[] = [];

  for (let i = fast; i < slow; i++) {
    ema_fast = candles[i].close * k_fast + ema_fast * (1 - k_fast);
  }

  for (let i = slow; i < candles.length; i++) {
    ema_fast = candles[i].close * k_fast + ema_fast * (1 - k_fast);
    ema_slow = candles[i].close * k_slow + ema_slow * (1 - k_slow);
    macdValues.push(ema_fast - ema_slow);
  }

  if (macdValues.length < signal) return null;

  // Compute signal EMA over the macdValues array
  const k_sig = 2 / (signal + 1);
  let signalEma = macdValues.slice(0, signal).reduce((s, v) => s + v, 0) / signal;
  for (let i = signal; i < macdValues.length; i++) {
    signalEma = macdValues[i] * k_sig + signalEma * (1 - k_sig);
  }

  const macdLine = macdValues[macdValues.length - 1];
  return {
    macd: macdLine,
    signal: signalEma,
    histogram: macdLine - signalEma
  };
};

// Returns Bollinger Bands (upper, middle, lower) for the last candle.
export const bollingerBands = (
  candles: OHLCVCandle[],
  period = 20,
  stdDevMultiplier = 2
): BollingerBandsResult | null => {
  if (candles.length < period) return null;
  const slice = candles.slice(candles.length - period);
  const middle = slice.reduce((acc, c) => acc + c.close, 0) / period;
  const variance = slice.reduce((acc, c) => acc + (c.close - middle) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    upper: middle + stdDevMultiplier * stdDev,
    middle,
    lower: middle - stdDevMultiplier * stdDev
  };
};

// Computes all indicators in one pass. Used by the alert evaluator.
export const computeIndicators = (candles: OHLCVCandle[]): IndicatorValues => ({
  sma20: sma(candles, 20),
  sma50: sma(candles, 50),
  ema12: ema(candles, 12),
  ema26: ema(candles, 26),
  rsi14: rsi(candles, 14),
  macd: macd(candles),
  bb20: bollingerBands(candles, 20)
});
