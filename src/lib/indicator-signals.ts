// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import type { OHLCVCandle } from './candles';
import type { IndicatorParams } from './chart-annotations';
import { sma, ema, rsi, macd, bollingerBands } from './indicators';

export type SignalMatch = {
  visibleIndex: number;
  signalCount: number;
  direction: 'bullish' | 'bearish';
  signals: string[];
  confidence: number;
};

function confidenceFromCount(count: number): number {
  if (count >= 4) return 85;
  if (count === 3) return 70;
  return 50;
}

export const detectIndicatorSignals = (
  candles: OHLCVCandle[],
  visibleCount: number,
  params: IndicatorParams
): SignalMatch[] => {
  if (candles.length === 0 || visibleCount === 0) return [];

  const startIndex = Math.max(0, candles.length - visibleCount);
  const matches: SignalMatch[] = [];

  for (let i = startIndex; i < candles.length; i++) {
    const slice = candles.slice(0, i + 1);
    const prevSlice = i > 0 ? candles.slice(0, i) : null;
    const visibleIndex = i - startIndex;
    const bullishSignals: string[] = [];
    const bearishSignals: string[] = [];

    // RSI
    const rsiVal = rsi(slice, params.rsiPeriod);
    if (rsiVal !== null) {
      if (rsiVal < 30) bullishSignals.push('RSI oversold');
      if (rsiVal > 70) bearishSignals.push('RSI overbought');
    }

    // MACD histogram zero cross
    if (prevSlice && prevSlice.length > 0) {
      const cur = macd(slice, params.macdFast, params.macdSlow, params.macdSignal);
      const prev = macd(prevSlice, params.macdFast, params.macdSlow, params.macdSignal);
      if (cur !== null && prev !== null) {
        if (prev.histogram < 0 && cur.histogram >= 0) bullishSignals.push('MACD bullish cross');
        if (prev.histogram > 0 && cur.histogram <= 0) bearishSignals.push('MACD bearish cross');
      }
    }

    // Bollinger Band breach
    const bb = bollingerBands(slice, params.bbPeriod, params.bbStdDev);
    if (bb !== null) {
      const close = candles[i].close;
      if (close < bb.lower) bullishSignals.push('Below BB lower');
      if (close > bb.upper) bearishSignals.push('Above BB upper');
    }

    // SMA cross
    if (prevSlice && prevSlice.length > 0) {
      const fastNow = sma(slice, params.smaFast);
      const slowNow = sma(slice, params.smaSlow);
      const fastPrev = sma(prevSlice, params.smaFast);
      const slowPrev = sma(prevSlice, params.smaSlow);
      if (fastNow !== null && slowNow !== null && fastPrev !== null && slowPrev !== null) {
        if (fastPrev <= slowPrev && fastNow > slowNow) bullishSignals.push('SMA bullish cross');
        if (fastPrev >= slowPrev && fastNow < slowNow) bearishSignals.push('SMA bearish cross');
      }
    }

    // EMA cross
    if (prevSlice && prevSlice.length > 0) {
      const fastNow = ema(slice, params.emaFast);
      const slowNow = ema(slice, params.emaSlow);
      const fastPrev = ema(prevSlice, params.emaFast);
      const slowPrev = ema(prevSlice, params.emaSlow);
      if (fastNow !== null && slowNow !== null && fastPrev !== null && slowPrev !== null) {
        if (fastPrev <= slowPrev && fastNow > slowNow) bullishSignals.push('EMA bullish cross');
        if (fastPrev >= slowPrev && fastNow < slowNow) bearishSignals.push('EMA bearish cross');
      }
    }

    const bullCount = bullishSignals.length;
    const bearCount = bearishSignals.length;

    if (bullCount >= 2) {
      matches.push({
        visibleIndex,
        signalCount: bullCount,
        direction: 'bullish',
        signals: bullishSignals,
        confidence: confidenceFromCount(bullCount),
      });
    } else if (bearCount >= 2) {
      matches.push({
        visibleIndex,
        signalCount: bearCount,
        direction: 'bearish',
        signals: bearishSignals,
        confidence: confidenceFromCount(bearCount),
      });
    }
  }

  return matches;
};
