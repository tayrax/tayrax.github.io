// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render } from '@testing-library/svelte';
import App from './App.svelte';
import { MANDATORY_ASSET } from './lib/config';
import { toggleAsset } from './lib/enabled-assets';

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

class MockSharedWorker {
  port = {
    postMessage(_msg: unknown) {},
    addEventListener(_type: string, _fn: unknown) {},
    start() {},
    close() {},
  };
}

beforeAll(() => {
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubGlobal('SharedWorker', MockSharedWorker);
});
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
// layout — default (bitcoin only)
// ---------------------------------------------------------------------------
describe('App — layout', () => {
  it('renders the brand heading', () => {
    const { getByRole } = render(App);
    expect(getByRole('heading', { level: 1 })).toHaveTextContent('tayrax');
  });

  it('renders a price card for the mandatory asset (bitcoin) by default', () => {
    const { getAllByRole } = render(App);
    const assetHeadings = getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent ?? '');
    expect(assetHeadings).toContain(MANDATORY_ASSET);
  });

  it('renders only one price card by default (bitcoin only)', () => {
    const { getAllByRole } = render(App);
    // h2 headings include section titles (Coins, Charts, Alerts) plus one per asset card
    const sectionTitles = new Set(['Coins', 'Charts', 'Alerts']);
    const assetHeadings = getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent ?? '')
      .filter((t) => !sectionTitles.has(t));
    expect(assetHeadings).toEqual([MANDATORY_ASSET]);
  });

  it('renders the Add alert button', () => {
    const { getByText } = render(App);
    expect(getByText('Add alert')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// layout — multi-coin (bitcoin + ethereum)
// ---------------------------------------------------------------------------
describe('App — layout with multiple coins enabled', () => {
  beforeAll(() => toggleAsset('ethereum'));
  afterAll(() => toggleAsset('ethereum'));

  it('renders a price card for each enabled asset', () => {
    const { getAllByRole } = render(App);
    const sectionTitles = new Set(['Coins', 'Charts', 'Alerts']);
    const assetHeadings = getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent ?? '')
      .filter((t) => !sectionTitles.has(t));
    expect(assetHeadings).toContain('bitcoin');
    expect(assetHeadings).toContain('ethereum');
    expect(assetHeadings).toHaveLength(2);
  });

  it('renders a price card button for each enabled asset', () => {
    const { getAllByRole } = render(App);
    const sectionTitles = new Set(['Coins', 'Charts', 'Alerts']);
    const assetHeadings = getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent ?? '')
      .filter((t) => !sectionTitles.has(t));
    expect(assetHeadings).toContain('bitcoin');
    expect(assetHeadings).toContain('ethereum');
  });
});
