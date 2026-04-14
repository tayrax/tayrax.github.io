// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

export type PriceTick = { asset: string; price: number; receivedAt: number };

export type PriceFeedListener = (tick: PriceTick) => void;

export type PriceFeedStatus = 'idle' | 'connecting' | 'open' | 'closed';

export type StatusListener = (status: PriceFeedStatus) => void;

export interface PriceProvider {
  start(): void;
  stop(): void;
  onTick(fn: PriceFeedListener): () => void;
  onStatus(fn: StatusListener): () => void;
}
