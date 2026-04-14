// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

export type PriceTick = { asset: string; price: number; receivedAt: number };

export type PriceFeedListener = (tick: PriceTick) => void;

export type PriceFeedStatus = 'idle' | 'connecting' | 'open' | 'closed';

export type StatusListener = (status: PriceFeedStatus) => void;

type Options = {
  assets: readonly string[];
  url?: (assets: readonly string[]) => string;
};

const defaultUrl = (assets: readonly string[]): string =>
  `wss://ws.coincap.io/prices?assets=${assets.join(',')}`;

export class PriceFeed {
  private ws: WebSocket | null = null;
  private listeners = new Set<PriceFeedListener>();
  private statusListeners = new Set<StatusListener>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private status: PriceFeedStatus = 'idle';

  constructor(private opts: Options) {}

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
    const buildUrl = this.opts.url ?? defaultUrl;
    const url = buildUrl(this.opts.assets);
    this.setStatus('connecting');
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus('open');
    };
    ws.onmessage = (ev: MessageEvent<string>) => {
      let data: Record<string, string>;
      try {
        data = JSON.parse(ev.data) as Record<string, string>;
      } catch {
        return;
      }
      const now = Date.now();
      for (const [asset, priceStr] of Object.entries(data)) {
        const price = Number(priceStr);
        if (!Number.isFinite(price)) continue;
        for (const fn of this.listeners) fn({ asset, price, receivedAt: now });
      }
    };
    ws.onerror = () => {
      ws.close();
    };
    ws.onclose = () => {
      this.ws = null;
      this.setStatus('closed');
      if (this.stopped) return;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    const delay = Math.min(30_000, 500 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private setStatus(next: PriceFeedStatus): void {
    if (this.status === next) return;
    this.status = next;
    for (const fn of this.statusListeners) fn(next);
  }
}
