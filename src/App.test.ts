// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render } from '@testing-library/svelte';
import App from './App.svelte';
import { MONITORED_ASSETS } from './lib/config';

// ---------------------------------------------------------------------------
// WebSocket stub — jsdom has no WebSocket; onMount calls feed.start() which
// calls new WebSocket(...). Provide a no-op stand-in so the constructor and
// event-handler assignments don't throw.
// ---------------------------------------------------------------------------
class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  close() {}
}

beforeAll(() => vi.stubGlobal('WebSocket', MockWebSocket));
afterAll(() => vi.unstubAllGlobals());

// ---------------------------------------------------------------------------
// smoke
// ---------------------------------------------------------------------------
describe('App — smoke', () => {
  it('mounts without throwing', () => {
    expect(() => render(App)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// layout
// ---------------------------------------------------------------------------
describe('App — layout', () => {
  it('renders the brand heading', () => {
    const { getByRole } = render(App);
    expect(getByRole('heading', { level: 1 })).toHaveTextContent('tayrax');
  });

  it('renders one price card per monitored asset', () => {
    const { getAllByRole } = render(App);
    const assetHeadings = getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent ?? '')
      .filter((t) => (MONITORED_ASSETS as readonly string[]).includes(t));
    expect(assetHeadings).toEqual([...MONITORED_ASSETS]);
  });

  it('renders the Add alert button', () => {
    const { getByText } = render(App);
    expect(getByText('Add alert')).toBeInTheDocument();
  });
});
