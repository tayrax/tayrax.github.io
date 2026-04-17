// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import type { TabToWorker, WorkerToTab } from './bot-types';

export type MessageHandler = (msg: WorkerToTab) => void;

export interface BotClient {
  post(msg: TabToWorker): void;
  subscribe(handler: MessageHandler): () => void;
  destroy(): void;
}

class SharedWorkerBotClient implements BotClient {
  private worker: SharedWorker;
  private handlers = new Set<MessageHandler>();

  constructor() {
    this.worker = new SharedWorker(
      new URL('./bot.worker.ts', import.meta.url),
      { type: 'module', name: 'tayrax-bot' }
    );
    this.worker.port.addEventListener('message', (ev: MessageEvent<WorkerToTab>) => {
      for (const h of this.handlers) h(ev.data);
    });
    this.worker.port.start();
  }

  post(msg: TabToWorker): void {
    this.worker.port.postMessage(msg);
  }

  subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  destroy(): void {
    this.handlers.clear();
    // Do NOT call port.close() here. onDestroy fires during page teardown, before
    // the next page connects. Explicitly closing the port gives Chrome a clear
    // zero-connection window and causes it to kill the worker. Letting the browser
    // close the port naturally on page unload keeps the worker alive long enough
    // for the next page to connect without a cold restart.
  }
}

export function createBotClient(): BotClient {
  return new SharedWorkerBotClient();
}
