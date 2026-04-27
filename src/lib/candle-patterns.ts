// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import type { OHLCVCandle } from './candles';
import type { IndicatorParams } from './chart-annotations';
import { rsi, macd, bollingerBands } from './indicators';

export type PatternMatch = {
  name: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  endIndex: number;
  confidence: number;
};

const bodySize = (c: OHLCVCandle): number => Math.abs(c.close - c.open);
const totalRange = (c: OHLCVCandle): number => c.high - c.low;
const upperWick = (c: OHLCVCandle): number => c.high - Math.max(c.open, c.close);
const lowerWick = (c: OHLCVCandle): number => Math.min(c.open, c.close) - c.low;
const isBull = (c: OHLCVCandle): boolean => c.close >= c.open;

function avgVolume(candles: OHLCVCandle[], endIndex: number, lookback = 10): number {
  const start = Math.max(0, endIndex - lookback);
  const slice = candles.slice(start, endIndex);
  if (slice.length === 0) return 0;
  return slice.reduce((s, c) => s + c.baseVolume, 0) / slice.length;
}

function booster(
  candles: OHLCVCandle[],
  endIndex: number,
  direction: 'bullish' | 'bearish' | 'neutral',
  params: IndicatorParams
): number {
  let bonus = 0;
  const c = candles[endIndex];
  const slice = candles.slice(0, endIndex + 1);

  // Volume boost
  const avg = avgVolume(candles, endIndex);
  if (avg > 0 && c.baseVolume > avg) bonus += 10;

  // RSI boost
  const rsiVal = rsi(slice, params.rsiPeriod);
  if (rsiVal !== null) {
    if (direction === 'bullish' && rsiVal < 40) bonus += 10;
    if (direction === 'bearish' && rsiVal > 60) bonus += 10;
  }

  // MACD boost
  const macdVal = macd(slice, params.macdFast, params.macdSlow, params.macdSignal);
  if (macdVal !== null) {
    if (direction === 'bullish' && macdVal.histogram > 0) bonus += 10;
    if (direction === 'bearish' && macdVal.histogram < 0) bonus += 10;
  }

  // BB boost
  const bb = bollingerBands(slice, params.bbPeriod, params.bbStdDev);
  if (bb !== null) {
    const pct = Math.abs(c.close - (direction === 'bullish' ? bb.lower : bb.upper)) / bb.upper;
    if (pct <= 0.01) bonus += 5;
  }

  return bonus;
}

function isDoji(c: OHLCVCandle): boolean {
  const body = bodySize(c);
  const range = totalRange(c);
  return range > 0 && body / range < 0.1;
}

function isHammer(c: OHLCVCandle): boolean {
  const body = bodySize(c);
  const lower = lowerWick(c);
  const upper = upperWick(c);
  const range = totalRange(c);
  return range > 0 && lower >= body * 2 && upper <= body * 0.5 && body / range > 0.05;
}

function isInvertedHammer(c: OHLCVCandle): boolean {
  const body = bodySize(c);
  const upper = upperWick(c);
  const lower = lowerWick(c);
  const range = totalRange(c);
  return range > 0 && upper >= body * 2 && lower <= body * 0.5 && body / range > 0.05;
}

export const detectCandlePatterns = (
  candles: OHLCVCandle[],
  params: IndicatorParams
): PatternMatch[] => {
  const matches: PatternMatch[] = [];
  if (candles.length === 0) return matches;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const prev = i > 0 ? candles[i - 1] : null;
    const prev2 = i > 1 ? candles[i - 2] : null;

    // --- single-candle ---
    if (isDoji(c)) {
      const base = 35;
      const conf = Math.min(95, base + booster(candles, i, 'neutral', params));
      matches.push({ name: 'Doji', direction: 'neutral', endIndex: i, confidence: conf });
    }

    if (isHammer(c)) {
      const base = 45;
      const conf = Math.min(95, base + booster(candles, i, 'bullish', params));
      matches.push({ name: 'Hammer', direction: 'bullish', endIndex: i, confidence: conf });
    }

    if (isInvertedHammer(c)) {
      const base = 45;
      // Inverted hammer is bullish at the bottom, bearish (shooting star) at the top
      // Distinguish by context: if lowerWick is small and candle is at a low area -> bullish
      const dir = isBull(c) ? 'bullish' : 'bearish';
      const name = dir === 'bullish' ? 'Inverted Hammer' : 'Shooting Star';
      const conf = Math.min(95, base + booster(candles, i, dir, params));
      matches.push({ name, direction: dir, endIndex: i, confidence: conf });
    }

    if (isHammer(c) && !isBull(c)) {
      const base = 45;
      const conf = Math.min(95, base + booster(candles, i, 'bearish', params));
      matches.push({ name: 'Hanging Man', direction: 'bearish', endIndex: i, confidence: conf });
    }

    // --- two-candle ---
    if (prev !== null) {
      // Bullish Engulfing: prev bearish, current bullish, current body engulfs prev body
      if (!isBull(prev) && isBull(c) && c.open < prev.close && c.close > prev.open) {
        const base = 65;
        const conf = Math.min(95, base + booster(candles, i, 'bullish', params));
        matches.push({ name: 'Bullish Engulfing', direction: 'bullish', endIndex: i, confidence: conf });
      }
      // Bearish Engulfing: prev bullish, current bearish, current body engulfs prev body
      if (isBull(prev) && !isBull(c) && c.open > prev.close && c.close < prev.open) {
        const base = 65;
        const conf = Math.min(95, base + booster(candles, i, 'bearish', params));
        matches.push({ name: 'Bearish Engulfing', direction: 'bearish', endIndex: i, confidence: conf });
      }
    }

    // --- three-candle ---
    if (prev !== null && prev2 !== null) {
      // Morning Star: large bearish, small body (doji-like), large bullish
      const p2Bear = !isBull(prev2) && bodySize(prev2) / (totalRange(prev2) || 1) > 0.4;
      const pSmall = bodySize(prev) / (totalRange(prev) || 1) < 0.3;
      const cBull = isBull(c) && bodySize(c) / (totalRange(c) || 1) > 0.4;
      if (p2Bear && pSmall && cBull) {
        const base = 70;
        const conf = Math.min(95, base + booster(candles, i, 'bullish', params));
        matches.push({ name: 'Morning Star', direction: 'bullish', endIndex: i, confidence: conf });
      }

      // Evening Star: large bullish, small body, large bearish
      const p2Bull = isBull(prev2) && bodySize(prev2) / (totalRange(prev2) || 1) > 0.4;
      const cBear = !isBull(c) && bodySize(c) / (totalRange(c) || 1) > 0.4;
      if (p2Bull && pSmall && cBear) {
        const base = 70;
        const conf = Math.min(95, base + booster(candles, i, 'bearish', params));
        matches.push({ name: 'Evening Star', direction: 'bearish', endIndex: i, confidence: conf });
      }

      // Three White Soldiers: three consecutive bullish candles, each closing higher
      if (
        isBull(prev2) && isBull(prev) && isBull(c) &&
        prev.close > prev2.close && c.close > prev.close &&
        prev.open > prev2.open && c.open > prev.open
      ) {
        const base = 70;
        const conf = Math.min(95, base + booster(candles, i, 'bullish', params));
        matches.push({ name: 'Three White Soldiers', direction: 'bullish', endIndex: i, confidence: conf });
      }

      // Three Black Crows: three consecutive bearish candles, each closing lower
      if (
        !isBull(prev2) && !isBull(prev) && !isBull(c) &&
        prev.close < prev2.close && c.close < prev.close &&
        prev.open < prev2.open && c.open < prev.open
      ) {
        const base = 70;
        const conf = Math.min(95, base + booster(candles, i, 'bearish', params));
        matches.push({ name: 'Three Black Crows', direction: 'bearish', endIndex: i, confidence: conf });
      }
    }
  }

  return matches;
};
