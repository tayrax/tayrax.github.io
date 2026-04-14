// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import type { PriceFeedListener, PriceFeedStatus, StatusListener, PriceProvider } from './provider';
import { toBinanceSymbol, fromBinanceSymbol } from './symbols';

type MiniTickerPayload = {
  e: '24hrMiniTicker';
  E: number;
  s: string;
  c: string;
};

type CombinedMessage = { stream: string; data: MiniTickerPayload };

const STABLE_CONNECTION_MS = 10_000;

export class BinancePriceFeed implements PriceProvider {
  private ws: WebSocket | null = null;
  private listeners = new Set<PriceFeedListener>();
  private statusListeners = new Set<StatusListener>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private status: PriceFeedStatus = 'idle';
  private connectedAt: number | null = null;

  constructor(private assets: readonly string[]) {}

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
    this.setStatus('closed');
  }

  onTick(fn: PriceFeedListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onStatus(fn: StatusListener): () => void {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => this.statusListeners.delete(fn);
  }

  private connect(): void {
    if (this.stopped) return;
    const streams = this.assets
      .map((a) => toBinanceSymbol(a))
      .filter((s): s is string => s !== null)
      .map((s) => `${s.toLowerCase()}@miniTicker`);
    if (streams.length === 0) return;
    const url = `wss://stream.binance.com:9443/stream?streams=${streams.join('/')}`;
    this.setStatus('connecting');
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.connectedAt = Date.now();
      this.setStatus('open');
    };
    ws.onmessage = (ev: MessageEvent<string>) => {
      let msg: CombinedMessage;
      try {
        msg = JSON.parse(ev.data) as CombinedMessage;
      } catch {
        return;
      }
      const d = msg.data;
      if (!d || d.e !== '24hrMiniTicker') return;
      const asset = fromBinanceSymbol(d.s);
      if (!asset) return;
      const price = Number(d.c);
      if (!Number.isFinite(price)) return;
      const receivedAt = Date.now();
      for (const fn of this.listeners) fn({ asset, price, receivedAt });
    };
    ws.onerror = () => {
      ws.close();
    };
    ws.onclose = () => {
      const wasStable =
        this.connectedAt !== null && Date.now() - this.connectedAt >= STABLE_CONNECTION_MS;
      this.connectedAt = null;
      this.ws = null;
      this.setStatus('closed');
      if (this.stopped) return;
      if (wasStable) this.reconnectAttempts = 0;
      const delay = Math.min(30_000, 500 * 2 ** this.reconnectAttempts);
      this.reconnectAttempts += 1;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, delay);
    };
  }

  private setStatus(next: PriceFeedStatus): void {
    if (this.status === next) return;
    this.status = next;
    for (const fn of this.statusListeners) fn(next);
  }
}
