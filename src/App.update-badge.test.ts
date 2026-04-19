// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import App from './App.svelte';

vi.mock('./lib/sw-update', () => ({
  updateWaiting: readable(true),
  applyUpdate: vi.fn(),
}));

class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  close() {}
}

beforeAll(() => vi.stubGlobal('WebSocket', MockWebSocket));
afterAll(() => vi.unstubAllGlobals());

describe('App — update badge visible', () => {
  it('shows the update badge when updateWaiting is true', () => {
    const { getByText } = render(App);
    expect(getByText('update')).toBeInTheDocument();
  });
});
