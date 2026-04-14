// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PriceCard from './PriceCard.svelte';
import type { PriceState } from '../lib/prices';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const makeState = (overrides: Partial<PriceState> = {}): PriceState => ({
  price: 50_000,
  prevPrice: null,
  updatedAt: Date.now(),
  history: [
    { price: 45_000, at: Date.now() - 3_600_000 },
    { price: 50_000, at: Date.now() },
  ],
  ...overrides,
});

// ---------------------------------------------------------------------------
// no state (loading)
// ---------------------------------------------------------------------------
describe('PriceCard — no state', () => {
  it('renders the asset name', () => {
    const { getByRole } = render(PriceCard, { props: { asset: 'bitcoin', state: undefined } });
    expect(getByRole('heading')).toHaveTextContent('bitcoin');
  });

  it('shows the em-dash placeholder price', () => {
    const { getByText } = render(PriceCard, { props: { asset: 'bitcoin', state: undefined } });
    expect(getByText('—')).toBeInTheDocument();
  });

  it('shows "waiting for data"', () => {
    const { getByText } = render(PriceCard, { props: { asset: 'bitcoin', state: undefined } });
    expect(getByText('waiting for data')).toBeInTheDocument();
  });

  it('does not show a stale badge', () => {
    const { queryByText } = render(PriceCard, { props: { asset: 'bitcoin', state: undefined } });
    expect(queryByText(/cached/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// state present — price display
// ---------------------------------------------------------------------------
describe('PriceCard — price display', () => {
  it('renders the formatted price', () => {
    const { getByText } = render(PriceCard, { props: { asset: 'bitcoin', state: makeState() } });
    expect(getByText('$50000.00')).toBeInTheDocument();
  });

  it('applies .up class when price rose', () => {
    const state = makeState({ price: 110, prevPrice: 100 });
    const { container } = render(PriceCard, { props: { asset: 'bitcoin', state } });
    expect(container.querySelector('.price')).toHaveClass('up');
  });

  it('applies .down class when price fell', () => {
    const state = makeState({ price: 90, prevPrice: 100 });
    const { container } = render(PriceCard, { props: { asset: 'bitcoin', state } });
    expect(container.querySelector('.price')).toHaveClass('down');
  });

  it('applies .flat class when prevPrice is null', () => {
    const state = makeState({ prevPrice: null });
    const { container } = render(PriceCard, { props: { asset: 'bitcoin', state } });
    expect(container.querySelector('.price')).toHaveClass('flat');
  });
});

// ---------------------------------------------------------------------------
// pct change label
// ---------------------------------------------------------------------------
describe('PriceCard — pct change', () => {
  it('shows pct change when history has 2+ points', () => {
    const state = makeState({
      price: 110,
      history: [{ price: 100, at: Date.now() - 1000 }, { price: 110, at: Date.now() }],
    });
    const { getByText } = render(PriceCard, { props: { asset: 'bitcoin', state } });
    expect(getByText(/\/1h/)).toBeInTheDocument();
  });

  it('shows "collecting 1h window…" when history has fewer than 2 points', () => {
    const state = makeState({ history: [] });
    const { getByText } = render(PriceCard, { props: { asset: 'bitcoin', state } });
    expect(getByText('collecting 1h window…')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// stale badge
// ---------------------------------------------------------------------------
describe('PriceCard — stale badge', () => {
  it('shows the stale badge when updatedAt is older than 30s', () => {
    const state = makeState({ updatedAt: Date.now() - 35_000 });
    const { getByText } = render(PriceCard, { props: { asset: 'bitcoin', state } });
    expect(getByText(/cached/)).toBeInTheDocument();
  });

  it('does not show the stale badge when data is fresh', () => {
    const state = makeState({ updatedAt: Date.now() - 5_000 });
    const { queryByText } = render(PriceCard, { props: { asset: 'bitcoin', state } });
    expect(queryByText(/cached/)).toBeNull();
  });
});
