// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { describe, it, expect } from 'vitest';
import { toBinanceSymbol, fromBinanceSymbol } from './symbols';

describe('toBinanceSymbol', () => {
  it('returns the correct symbol for known assets', () => {
    expect(toBinanceSymbol('bitcoin')).toBe('BTCUSDT');
    expect(toBinanceSymbol('ethereum')).toBe('ETHUSDT');
    expect(toBinanceSymbol('solana')).toBe('SOLUSDT');
    expect(toBinanceSymbol('cardano')).toBe('ADAUSDT');
  });

  it('returns null for unknown assets', () => {
    expect(toBinanceSymbol('unknown')).toBeNull();
    expect(toBinanceSymbol('')).toBeNull();
  });
});

describe('fromBinanceSymbol', () => {
  it('returns the correct asset for known symbols', () => {
    expect(fromBinanceSymbol('BTCUSDT')).toBe('bitcoin');
    expect(fromBinanceSymbol('ETHUSDT')).toBe('ethereum');
    expect(fromBinanceSymbol('SOLUSDT')).toBe('solana');
    expect(fromBinanceSymbol('ADAUSDT')).toBe('cardano');
  });

  it('is case-insensitive', () => {
    expect(fromBinanceSymbol('btcusdt')).toBe('bitcoin');
    expect(fromBinanceSymbol('Ethusdt')).toBe('ethereum');
  });

  it('returns null for unknown symbols', () => {
    expect(fromBinanceSymbol('XYZUSDT')).toBeNull();
    expect(fromBinanceSymbol('')).toBeNull();
  });
});
