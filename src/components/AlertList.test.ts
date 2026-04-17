// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import AlertList from './AlertList.svelte';
import { alerts, addAlert, removeAlert, markFired } from '../lib/alerts';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// Drain the alerts store to a clean state before each test by removing all
// alerts that may have been left by prior tests in this file.
const clearAlerts = (): void => {
  get(alerts).forEach((a) => removeAlert(a.id));
};

// ---------------------------------------------------------------------------
// empty state
// ---------------------------------------------------------------------------
describe('AlertList — empty state', () => {
  beforeEach(clearAlerts);

  it('shows "No alerts yet" when the store is empty', () => {
    const { getByText } = render(AlertList);
    expect(getByText('No alerts yet. Add one above.')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// populated state
// ---------------------------------------------------------------------------
describe('AlertList — populated', () => {
  beforeEach(clearAlerts);

  it('renders one row per alert', () => {
    addAlert({ asset: 'bitcoin', interval: '1m', kind: 'above', value: 60_000 });
    addAlert({ asset: 'ethereum', interval: '1m', kind: 'below', value: 2_000 });
    const { getAllByRole } = render(AlertList);
    expect(getAllByRole('listitem').length).toBe(2);
  });

  it('renders the correct description for an "above" alert', () => {
    addAlert({ asset: 'bitcoin', interval: '1m', kind: 'above', value: 60_000 });
    const { getByText } = render(AlertList);
    expect(getByText('bitcoin > $60000')).toBeInTheDocument();
  });

  it('renders the correct description for a "range" alert', () => {
    addAlert({ asset: 'solana', interval: '1m', kind: 'range', low: 100, high: 200 });
    const { getByText } = render(AlertList);
    expect(getByText('solana in $100–$200')).toBeInTheDocument();
  });

  it('shows "last fired" when lastFiredAt is set', () => {
    addAlert({ asset: 'bitcoin', interval: '1m', kind: 'above', value: 60_000 });
    const target = get(alerts).at(-1)!;
    markFired(target.id, Date.now());
    const { getByText } = render(AlertList);
    expect(getByText(/last fired/)).toBeInTheDocument();
  });

  it('does not show "last fired" when lastFiredAt is null', () => {
    addAlert({ asset: 'bitcoin', interval: '1m', kind: 'above', value: 60_000 });
    const { queryByText } = render(AlertList);
    expect(queryByText(/last fired/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// remove button
// ---------------------------------------------------------------------------
describe('AlertList — remove', () => {
  beforeEach(clearAlerts);

  it('clicking remove deletes the alert from the store', async () => {
    addAlert({ asset: 'bitcoin', interval: '1m', kind: 'above', value: 60_000 });
    const id = get(alerts).at(-1)!.id;
    const { getAllByText } = render(AlertList);
    await fireEvent.click(getAllByText('remove')[0]);
    expect(get(alerts).find((a) => a.id === id)).toBeUndefined();
  });

  it('shows "No alerts yet" after the last alert is removed', async () => {
    addAlert({ asset: 'bitcoin', interval: '1m', kind: 'above', value: 60_000 });
    const { getByText } = render(AlertList);
    await fireEvent.click(getByText('remove'));
    expect(getByText('No alerts yet. Add one above.')).toBeInTheDocument();
  });
});
