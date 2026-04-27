// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

export type CandleMarker = {
  type: 'candle-marker';
  visibleIndex: number;
  direction: 'above' | 'below';
  color: string;
  label: string;
  confidence: number;
};

export type HLine = {
  type: 'hline';
  price: number;
  color: string;
  label: string;
  confidence: number;
};

export type SignalZone = {
  type: 'signal-zone';
  visibleIndex: number;
  direction: 'bullish' | 'bearish';
  confidence: number;
  label: string;
};

export type ChartAnnotation = CandleMarker | HLine | SignalZone;

export type IndicatorParams = {
  smaFast: number;
  smaSlow: number;
  emaFast: number;
  emaSlow: number;
  bbPeriod: number;
  bbStdDev: number;
  rsiPeriod: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
};
