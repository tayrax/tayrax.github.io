// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { get, type Readable } from 'svelte/store';
import { SW_UPDATE_INTERVAL_MS } from './config';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

type MockSW = {
  state: ServiceWorkerState;
  postMessage: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  _fire: (event: string) => void;
};

type MockReg = {
  waiting: MockSW | null;
  installing: MockSW | null;
  update: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  _fire: (event: string) => void;
};

type MockNavSW = {
  controller: object | null;
  addEventListener: ReturnType<typeof vi.fn>;
  _fire: (event: string) => void;
};

function makeSW(state: ServiceWorkerState = 'installing'): MockSW {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    state,
    postMessage: vi.fn(),
    addEventListener: vi.fn((event: string, handler: () => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    _fire: (event: string) => listeners[event]?.forEach((h) => h()),
  };
}

function makeReg(): MockReg {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    waiting: null,
    installing: null,
    update: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn((event: string, handler: () => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    _fire: (event: string) => listeners[event]?.forEach((h) => h()),
  };
}

function stubNavSW(controller: object | null): MockNavSW {
  const listeners: Record<string, Array<(e: Event) => void>> = {};
  const mock: MockNavSW = {
    controller,
    addEventListener: vi.fn((event: string, handler: (e: Event) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    _fire: (event: string) => listeners[event]?.forEach((h) => h(new Event(event))),
  };
  vi.stubGlobal('navigator', { serviceWorker: mock });
  return mock;
}

// ---------------------------------------------------------------------------
// Each test uses vi.resetModules() + dynamic import so module-level state
// (reg, _updateWaiting) is fresh.
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('sw-update — updateWaiting store', () => {
  it('starts as false', async () => {
    vi.resetModules();
    const { updateWaiting } = await import('./sw-update') as { updateWaiting: Readable<boolean> };
    expect(get(updateWaiting)).toBe(false);
  });
});

describe('sw-update — watchForUpdates: immediate waiting check', () => {
  it('sets store true when registration already has a waiting SW and controller is present', async () => {
    vi.resetModules();
    stubNavSW({});
    const { watchForUpdates, updateWaiting } = await import('./sw-update') as {
      watchForUpdates: (r: ServiceWorkerRegistration) => void;
      updateWaiting: Readable<boolean>;
    };
    const reg = makeReg();
    reg.waiting = makeSW('installed');
    watchForUpdates(reg as unknown as ServiceWorkerRegistration);
    expect(get(updateWaiting)).toBe(true);
  });

  it('does not set store when registration has waiting SW but controller is null (first install)', async () => {
    vi.resetModules();
    stubNavSW(null);
    const { watchForUpdates, updateWaiting } = await import('./sw-update') as {
      watchForUpdates: (r: ServiceWorkerRegistration) => void;
      updateWaiting: Readable<boolean>;
    };
    const reg = makeReg();
    reg.waiting = makeSW('installed');
    watchForUpdates(reg as unknown as ServiceWorkerRegistration);
    expect(get(updateWaiting)).toBe(false);
  });
});

describe('sw-update — watchForUpdates: updatefound flow', () => {
  it('sets store true when installing SW reaches installed state with controller', async () => {
    vi.resetModules();
    stubNavSW({});
    const { watchForUpdates, updateWaiting } = await import('./sw-update') as {
      watchForUpdates: (r: ServiceWorkerRegistration) => void;
      updateWaiting: Readable<boolean>;
    };
    const reg = makeReg();
    const installing = makeSW('installing');
    watchForUpdates(reg as unknown as ServiceWorkerRegistration);
    reg.installing = installing;
    reg._fire('updatefound');
    installing.state = 'installed';
    installing._fire('statechange');
    expect(get(updateWaiting)).toBe(true);
  });

  it('does not set store when installing SW reaches installed state but no controller (first install)', async () => {
    vi.resetModules();
    stubNavSW(null);
    const { watchForUpdates, updateWaiting } = await import('./sw-update') as {
      watchForUpdates: (r: ServiceWorkerRegistration) => void;
      updateWaiting: Readable<boolean>;
    };
    const reg = makeReg();
    const installing = makeSW('installing');
    watchForUpdates(reg as unknown as ServiceWorkerRegistration);
    reg.installing = installing;
    reg._fire('updatefound');
    installing.state = 'installed';
    installing._fire('statechange');
    expect(get(updateWaiting)).toBe(false);
  });

  it('does not set store when updatefound fires but installing is null', async () => {
    vi.resetModules();
    stubNavSW({});
    const { watchForUpdates, updateWaiting } = await import('./sw-update') as {
      watchForUpdates: (r: ServiceWorkerRegistration) => void;
      updateWaiting: Readable<boolean>;
    };
    const reg = makeReg();
    watchForUpdates(reg as unknown as ServiceWorkerRegistration);
    reg.installing = null;
    reg._fire('updatefound');
    expect(get(updateWaiting)).toBe(false);
  });
});

describe('sw-update — watchForUpdates: polling', () => {
  it('calls registration.update() after the polling interval', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    stubNavSW({});
    const { watchForUpdates } = await import('./sw-update') as {
      watchForUpdates: (r: ServiceWorkerRegistration) => void;
    };
    const reg = makeReg();
    watchForUpdates(reg as unknown as ServiceWorkerRegistration);
    expect(reg.update).not.toHaveBeenCalled();
    vi.advanceTimersByTime(SW_UPDATE_INTERVAL_MS);
    expect(reg.update).toHaveBeenCalledOnce();
  });
});

describe('sw-update — applyUpdate', () => {
  it('does not throw when called before watchForUpdates', async () => {
    vi.resetModules();
    stubNavSW({});
    const { applyUpdate } = await import('./sw-update') as { applyUpdate: () => void };
    expect(() => applyUpdate()).not.toThrow();
  });

  it('posts SKIP_WAITING to the waiting SW and resets the store to false', async () => {
    vi.resetModules();
    stubNavSW({});
    vi.stubGlobal('location', { reload: vi.fn() });
    const { watchForUpdates, applyUpdate, updateWaiting } = await import('./sw-update') as {
      watchForUpdates: (r: ServiceWorkerRegistration) => void;
      applyUpdate: () => void;
      updateWaiting: Readable<boolean>;
    };
    const reg = makeReg();
    const waiting = makeSW('installed');
    reg.waiting = waiting;
    watchForUpdates(reg as unknown as ServiceWorkerRegistration);
    expect(get(updateWaiting)).toBe(true);
    applyUpdate();
    expect(waiting.postMessage).toHaveBeenCalledWith('SKIP_WAITING');
    expect(get(updateWaiting)).toBe(false);
  });

  it('reloads when controllerchange fires after applyUpdate', async () => {
    vi.resetModules();
    const navSW = stubNavSW({});
    const reloadMock = vi.fn();
    vi.stubGlobal('location', { reload: reloadMock });
    const { watchForUpdates, applyUpdate } = await import('./sw-update') as {
      watchForUpdates: (r: ServiceWorkerRegistration) => void;
      applyUpdate: () => void;
    };
    const reg = makeReg();
    reg.waiting = makeSW('installed');
    watchForUpdates(reg as unknown as ServiceWorkerRegistration);
    applyUpdate();
    navSW._fire('controllerchange');
    expect(reloadMock).toHaveBeenCalledOnce();
  });
});
