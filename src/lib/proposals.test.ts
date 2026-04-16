// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateProposals, resetCooldowns } from './proposals';
import type { IndicatorValues } from './indicators';
import type { PriceState } from './prices';

const makeIndicators = (overrides: Partial<IndicatorValues> = {}): IndicatorValues => ({
  sma20: null,
  sma50: null,
  ema12: null,
  ema26: null,
  rsi14: null,
  macd: null,
  bb20: null,
  ...overrides
});

const makePrice = (price: number): PriceState => ({
  price,
  prevPrice: null,
  updatedAt: NOW,
  history: []
});

const NOW = 1_000_000;

describe('evaluateProposals', () => {
  beforeEach(() => resetCooldowns());

  it('returns empty array when no price', () => {
    const ind = makeIndicators({ rsi14: 20 });
    expect(evaluateProposals('bitcoin', ind, undefined, NOW)).toEqual([]);
  });

  it('returns empty array when all indicators are null', () => {
    expect(evaluateProposals('bitcoin', makeIndicators(), makePrice(50000), NOW)).toEqual([]);
  });

  it('emits rsiOversold buy when RSI < 30', () => {
    const ind = makeIndicators({ rsi14: 25 });
    const result = evaluateProposals('bitcoin', ind, makePrice(50000), NOW);
    expect(result).toHaveLength(1);
    expect(result[0].signal).toBe('rsiOversold');
    expect(result[0].direction).toBe('buy');
    expect(result[0].indicatorValue).toBe(25);
  });

  it('does not emit rsiOversold when RSI === 30', () => {
    const ind = makeIndicators({ rsi14: 30 });
    expect(evaluateProposals('bitcoin', ind, makePrice(50000), NOW)).toEqual([]);
  });

  it('emits rsiOverbought sell when RSI > 70', () => {
    const ind = makeIndicators({ rsi14: 75 });
    const result = evaluateProposals('bitcoin', ind, makePrice(50000), NOW);
    expect(result).toHaveLength(1);
    expect(result[0].signal).toBe('rsiOverbought');
    expect(result[0].direction).toBe('sell');
  });

  it('emits macdBullish buy when histogram > 0', () => {
    const ind = makeIndicators({ macd: { macd: 1, signal: 0.5, histogram: 0.5 } });
    const result = evaluateProposals('bitcoin', ind, makePrice(50000), NOW);
    expect(result).toHaveLength(1);
    expect(result[0].signal).toBe('macdBullish');
    expect(result[0].direction).toBe('buy');
  });

  it('emits macdBearish sell when histogram < 0', () => {
    const ind = makeIndicators({ macd: { macd: -1, signal: -0.5, histogram: -0.5 } });
    const result = evaluateProposals('bitcoin', ind, makePrice(50000), NOW);
    expect(result).toHaveLength(1);
    expect(result[0].signal).toBe('macdBearish');
    expect(result[0].direction).toBe('sell');
  });

  it('emits bbBreakBelow buy when price < BB lower', () => {
    const ind = makeIndicators({ bb20: { upper: 55000, middle: 50000, lower: 45000 } });
    const result = evaluateProposals('bitcoin', ind, makePrice(44000), NOW);
    expect(result).toHaveLength(1);
    expect(result[0].signal).toBe('bbBreakBelow');
    expect(result[0].direction).toBe('buy');
  });

  it('emits bbBreakAbove sell when price > BB upper', () => {
    const ind = makeIndicators({ bb20: { upper: 55000, middle: 50000, lower: 45000 } });
    const result = evaluateProposals('bitcoin', ind, makePrice(56000), NOW);
    expect(result).toHaveLength(1);
    expect(result[0].signal).toBe('bbBreakAbove');
    expect(result[0].direction).toBe('sell');
  });

  it('can emit multiple proposals at once', () => {
    const ind = makeIndicators({
      rsi14: 25,
      macd: { macd: 1, signal: 0.5, histogram: 0.5 }
    });
    const result = evaluateProposals('bitcoin', ind, makePrice(50000), NOW);
    expect(result).toHaveLength(2);
  });

  it('suppresses repeat within cooldown window', () => {
    const ind = makeIndicators({ rsi14: 25 });
    const price = makePrice(50000);
    const first = evaluateProposals('bitcoin', ind, price, NOW);
    expect(first).toHaveLength(1);
    const second = evaluateProposals('bitcoin', ind, price, NOW + 1000);
    expect(second).toHaveLength(0);
  });

  it('fires again after cooldown expires', () => {
    const ind = makeIndicators({ rsi14: 25 });
    const price = makePrice(50000);
    evaluateProposals('bitcoin', ind, price, NOW);
    const after = evaluateProposals('bitcoin', ind, price, NOW + 31 * 60 * 1000);
    expect(after).toHaveLength(1);
  });

  it('cooldown is per asset — different asset fires independently', () => {
    const ind = makeIndicators({ rsi14: 25 });
    evaluateProposals('bitcoin', ind, makePrice(50000), NOW);
    const result = evaluateProposals('ethereum', ind, makePrice(2000), NOW + 1000);
    expect(result).toHaveLength(1);
    expect(result[0].asset).toBe('ethereum');
  });

  it('cooldown is per signal — different signal fires independently', () => {
    const ind = makeIndicators({
      rsi14: 25,
      macd: { macd: 1, signal: 0.5, histogram: 0.5 }
    });
    const price = makePrice(50000);
    // First call fires both
    evaluateProposals('bitcoin', ind, price, NOW);
    // Both are now on cooldown — neither fires
    const second = evaluateProposals('bitcoin', ind, price, NOW + 1000);
    expect(second).toHaveLength(0);
  });

  it('proposal includes asset, price, and message', () => {
    const ind = makeIndicators({ rsi14: 25 });
    const result = evaluateProposals('bitcoin', ind, makePrice(50000), NOW);
    expect(result[0].asset).toBe('bitcoin');
    expect(result[0].price).toBe(50000);
    expect(typeof result[0].message).toBe('string');
    expect(result[0].message.length).toBeGreaterThan(0);
  });
});
