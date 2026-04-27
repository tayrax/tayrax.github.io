// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { describe, it, expect } from 'vitest';
import { detectCandlePatterns } from './candle-patterns';
import type { OHLCVCandle } from './candles';
import type { IndicatorParams } from './chart-annotations';

const params: IndicatorParams = {
  smaFast: 20, smaSlow: 50, emaFast: 12, emaSlow: 26,
  bbPeriod: 20, bbStdDev: 2, rsiPeriod: 14,
  macdFast: 12, macdSlow: 26, macdSignal: 9,
};

function candle(open: number, high: number, low: number, close: number, vol = 100): OHLCVCandle {
  return { openTime: 0, closeTime: 1, open, high, low, close, baseVolume: vol };
}

describe('detectCandlePatterns', () => {
  it('returns empty for empty input', () => {
    expect(detectCandlePatterns([], params)).toEqual([]);
  });

  it('detects Doji', () => {
    // Open and close very close — tiny body relative to range
    const c = candle(100, 110, 90, 100.5);
    const matches = detectCandlePatterns([c], params);
    expect(matches.some((m) => m.name === 'Doji')).toBe(true);
  });

  it('detects Hammer', () => {
    // Long lower wick, meaningful body near top, tiny upper wick
    const c = candle(98, 102.1, 80, 102);
    const matches = detectCandlePatterns([c], params);
    expect(matches.some((m) => m.name === 'Hammer')).toBe(true);
  });

  it('detects Bullish Engulfing', () => {
    const bearish = candle(105, 106, 98, 99);
    const bullish = candle(97, 110, 96, 107);
    const matches = detectCandlePatterns([bearish, bullish], params);
    expect(matches.some((m) => m.name === 'Bullish Engulfing')).toBe(true);
  });

  it('detects Bearish Engulfing', () => {
    const bullish = candle(95, 110, 94, 105);
    const bearish = candle(107, 108, 90, 93);
    const matches = detectCandlePatterns([bullish, bearish], params);
    expect(matches.some((m) => m.name === 'Bearish Engulfing')).toBe(true);
  });

  it('detects Three White Soldiers', () => {
    const c1 = candle(100, 115, 99, 113);
    const c2 = candle(114, 128, 113, 126);
    const c3 = candle(127, 142, 126, 140);
    const matches = detectCandlePatterns([c1, c2, c3], params);
    expect(matches.some((m) => m.name === 'Three White Soldiers')).toBe(true);
  });

  it('detects Three Black Crows', () => {
    const c1 = candle(140, 141, 124, 126);
    const c2 = candle(125, 126, 110, 112);
    const c3 = candle(111, 112, 96, 98);
    const matches = detectCandlePatterns([c1, c2, c3], params);
    expect(matches.some((m) => m.name === 'Three Black Crows')).toBe(true);
  });

  it('confidence is within 0-100', () => {
    const c1 = candle(100, 115, 99, 113);
    const c2 = candle(114, 128, 113, 126);
    const c3 = candle(127, 142, 126, 140);
    const matches = detectCandlePatterns([c1, c2, c3], params);
    for (const m of matches) {
      expect(m.confidence).toBeGreaterThanOrEqual(0);
      expect(m.confidence).toBeLessThanOrEqual(100);
    }
  });
});
