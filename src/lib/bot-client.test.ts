// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { vi, describe, it, expect } from 'vitest';
import type { WorkerToTab } from './bot-types';
import { createBotClient } from './bot-client';

// ---------------------------------------------------------------------------
// SharedWorkerBotClient
// ---------------------------------------------------------------------------
describe('SharedWorkerBotClient', () => {
  it('constructs a client and subscribes/destroys cleanly', () => {
    const mockPort = {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      start: vi.fn(),
      close: vi.fn(),
    };
    vi.stubGlobal('SharedWorker', class { port = mockPort; });
    const client = createBotClient();
    expect(client).toBeDefined();
    client.destroy();
    vi.unstubAllGlobals();
  });

  it('does not close the port on destroy (prevents premature worker termination)', () => {
    const mockPort = {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      start: vi.fn(),
      close: vi.fn(),
    };
    vi.stubGlobal('SharedWorker', class { port = mockPort; });
    const client = createBotClient();
    client.destroy();
    expect(mockPort.close).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('routes incoming port messages to subscribers', () => {
    let capturedListener: ((ev: MessageEvent) => void) | null = null;
    const mockPort = {
      postMessage: vi.fn(),
      addEventListener: vi.fn((type: string, fn: (ev: MessageEvent) => void) => {
        if (type === 'message') capturedListener = fn;
      }),
      start: vi.fn(),
      close: vi.fn(),
    };
    vi.stubGlobal('SharedWorker', class { port = mockPort; });
    const client = createBotClient();
    const received: WorkerToTab[] = [];
    client.subscribe((msg) => received.push(msg));
    const msg: WorkerToTab = { type: 'priceStatus', status: 'open' };
    capturedListener!({ data: msg } as MessageEvent);
    expect(received).toEqual([msg]);
    client.destroy();
    vi.unstubAllGlobals();
  });

  it('posts messages to the worker port', () => {
    const mockPort = {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      start: vi.fn(),
      close: vi.fn(),
    };
    vi.stubGlobal('SharedWorker', class { port = mockPort; });
    const client = createBotClient();
    client.post({ type: 'subscribeBotState' });
    expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'subscribeBotState' });
    client.destroy();
    vi.unstubAllGlobals();
  });

  it('unsubscribe removes handler', () => {
    let capturedListener: ((ev: MessageEvent) => void) | null = null;
    const mockPort = {
      postMessage: vi.fn(),
      addEventListener: vi.fn((type: string, fn: (ev: MessageEvent) => void) => {
        if (type === 'message') capturedListener = fn;
      }),
      start: vi.fn(),
      close: vi.fn(),
    };
    vi.stubGlobal('SharedWorker', class { port = mockPort; });
    const client = createBotClient();
    const received: WorkerToTab[] = [];
    const unsub = client.subscribe((msg) => received.push(msg));
    capturedListener!({ data: { type: 'priceStatus', status: 'open' } } as MessageEvent);
    unsub();
    capturedListener!({ data: { type: 'priceStatus', status: 'closed' } } as MessageEvent);
    expect(received).toHaveLength(1);
    client.destroy();
    vi.unstubAllGlobals();
  });
});
