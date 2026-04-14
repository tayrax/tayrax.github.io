// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { toBinanceSymbol, fromBinanceSymbol } from './symbols';

export type ClosedCandle = {
  asset: string;
  openTime: number;
  closeTime: number;
  close: number;
  baseVolume: number;
};

export type CandleListener = (candle: ClosedCandle) => void;

type KlinePayload = {
  e: 'kline';
  s: string;
  k: {
    t: number;
    T: number;
    s: string;
    i: string;
    x: boolean;
    c: string;
    v: string;
  };
};

type CombinedMessage = { stream: string; data: KlinePayload };

export class BinanceKlineFeed {
  private ws: WebSocket | null = null;
  private listeners = new Set<CandleListener>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;

  constructor(private assets: readonly string[], private interval: string = '1m') {}

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  onCandleClosed(fn: CandleListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private connect(): void {
    if (this.stopped) return;
    const streams = this.assets
      .map((a) => toBinanceSymbol(a))
      .filter((s): s is string => s !== null)
      .map((s) => `${s.toLowerCase()}@kline_${this.interval}`);
    if (streams.length === 0) return;
    const url = `wss://stream.binance.com:9443/stream?streams=${streams.join('/')}`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
    };
    ws.onmessage = (ev: MessageEvent<string>) => {
      let msg: CombinedMessage;
      try {
        msg = JSON.parse(ev.data) as CombinedMessage;
      } catch {
        return;
      }
      const k = msg.data?.k;
      if (!k || !k.x) return;
      const asset = fromBinanceSymbol(k.s);
      if (!asset) return;
      const close = Number(k.c);
      const baseVolume = Number(k.v);
      if (!Number.isFinite(close) || !Number.isFinite(baseVolume)) return;
      const candle: ClosedCandle = {
        asset,
        openTime: k.t,
        closeTime: k.T,
        close,
        baseVolume
      };
      for (const fn of this.listeners) fn(candle);
    };
    ws.onerror = () => {
      ws.close();
    };
    ws.onclose = () => {
      this.ws = null;
      if (this.stopped) return;
      const delay = Math.min(30_000, 500 * 2 ** this.reconnectAttempts);
      this.reconnectAttempts += 1;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, delay);
    };
  }
}
