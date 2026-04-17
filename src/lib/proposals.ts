// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import type { IndicatorValues } from './indicators';
import type { PriceState } from './prices';
import { PROPOSAL_COOLDOWN_MS, type CandleInterval } from './config';

export type TradeDirection = 'buy' | 'sell';

export type TradeSignal =
  | 'rsiOversold'
  | 'rsiOverbought'
  | 'macdBullish'
  | 'macdBearish'
  | 'bbBreakBelow'
  | 'bbBreakAbove';

export type TradeProposal = {
  asset: string;
  interval: CandleInterval;
  direction: TradeDirection;
  signal: TradeSignal;
  indicatorValue: number;
  price: number;
  message: string;
};

const lastFired = new Map<string, number>();

const cooldownKey = (asset: string, interval: CandleInterval, signal: TradeSignal): string =>
  `${asset}:${interval}:${signal}`;

const onCooldown = (asset: string, interval: CandleInterval, signal: TradeSignal, now: number): boolean => {
  const last = lastFired.get(cooldownKey(asset, interval, signal));
  return last !== undefined && now - last < PROPOSAL_COOLDOWN_MS;
};

export const resetCooldowns = (): void => {
  lastFired.clear();
};

const fmt = (n: number): string =>
  n >= 100 ? n.toFixed(2) : n >= 1 ? n.toFixed(4) : n.toPrecision(4);

export const evaluateProposals = (
  asset: string,
  interval: CandleInterval,
  indicators: IndicatorValues,
  price: PriceState | undefined,
  now: number
): TradeProposal[] => {
  if (!price) return [];
  const results: TradeProposal[] = [];
  const p = price.price;

  const emit = (
    signal: TradeSignal,
    direction: TradeDirection,
    indicatorValue: number,
    message: string
  ): void => {
    if (onCooldown(asset, interval, signal, now)) return;
    lastFired.set(cooldownKey(asset, interval, signal), now);
    results.push({ asset, interval, direction, signal, indicatorValue, price: p, message });
  };

  if (indicators.rsi14 !== null && indicators.rsi14 < 30) {
    emit('rsiOversold', 'buy', indicators.rsi14,
      `${asset} [${interval}] RSI(14) ${indicators.rsi14.toFixed(1)} — oversold, consider buying (price $${fmt(p)})`);
  }

  if (indicators.rsi14 !== null && indicators.rsi14 > 70) {
    emit('rsiOverbought', 'sell', indicators.rsi14,
      `${asset} [${interval}] RSI(14) ${indicators.rsi14.toFixed(1)} — overbought, consider selling (price $${fmt(p)})`);
  }

  if (indicators.macd !== null && indicators.macd.histogram > 0) {
    emit('macdBullish', 'buy', indicators.macd.histogram,
      `${asset} [${interval}] MACD bullish crossover (histogram ${indicators.macd.histogram.toFixed(4)}, price $${fmt(p)})`);
  }

  if (indicators.macd !== null && indicators.macd.histogram < 0) {
    emit('macdBearish', 'sell', indicators.macd.histogram,
      `${asset} [${interval}] MACD bearish crossover (histogram ${indicators.macd.histogram.toFixed(4)}, price $${fmt(p)})`);
  }

  if (indicators.bb20 !== null && p < indicators.bb20.lower) {
    emit('bbBreakBelow', 'buy', indicators.bb20.lower,
      `${asset} [${interval}] broke below lower Bollinger Band ($${fmt(indicators.bb20.lower)}), consider buying (price $${fmt(p)})`);
  }

  if (indicators.bb20 !== null && p > indicators.bb20.upper) {
    emit('bbBreakAbove', 'sell', indicators.bb20.upper,
      `${asset} [${interval}] broke above upper Bollinger Band ($${fmt(indicators.bb20.upper)}), consider selling (price $${fmt(p)})`);
  }

  return results;
};
