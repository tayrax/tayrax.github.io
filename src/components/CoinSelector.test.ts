// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import CoinSelector from './CoinSelector.svelte';
import { enabledAssets, toggleAsset } from '../lib/enabled-assets';
import { MANDATORY_ASSET } from '../lib/config';

vi.mock('../lib/bot-client');

// Reset enabled assets to default (bitcoin only) before each test
beforeEach(() => {
  const current = get(enabledAssets);
  for (const asset of current) {
    if (asset !== MANDATORY_ASSET) toggleAsset(asset);
  }
});

afterEach(() => {
  const current = get(enabledAssets);
  for (const asset of current) {
    if (asset !== MANDATORY_ASSET) toggleAsset(asset);
  }
});

// ---------------------------------------------------------------------------
// chips — enabled coins
// ---------------------------------------------------------------------------
describe('CoinSelector — chips', () => {
  it('always shows the mandatory asset chip', () => {
    const { getByText } = render(CoinSelector);
    expect(getByText(MANDATORY_ASSET, { exact: false })).toBeInTheDocument();
  });

  it('mandatory chip has no remove button', () => {
    const { container } = render(CoinSelector);
    const locked = container.querySelector('.chip.locked');
    expect(locked).toBeInTheDocument();
    expect(locked!.tagName).not.toBe('BUTTON');
  });

  it('shows a removable chip for each non-mandatory enabled coin', () => {
    toggleAsset('ethereum');
    const { getAllByRole } = render(CoinSelector);
    const chips = getAllByRole('button').filter((b) =>
      b.classList.contains('chip')
    );
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveTextContent('ethereum');
  });

  it('clicking a removable chip disables that coin', () => {
    toggleAsset('ethereum');
    const { getByRole } = render(CoinSelector);
    const chip = getByRole('button', { name: /ethereum/i });
    fireEvent.click(chip);
    expect(get(enabledAssets)).not.toContain('ethereum');
  });
});

// ---------------------------------------------------------------------------
// search — suggestions
// ---------------------------------------------------------------------------
describe('CoinSelector — search', () => {
  it('shows no suggestions when the input is empty', () => {
    const { container } = render(CoinSelector);
    expect(container.querySelector('.suggestions')).not.toBeInTheDocument();
  });

  it('shows matching not-yet-enabled coins as the user types', async () => {
    const { container } = render(CoinSelector);
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'sol' } });
    const items = container.querySelectorAll('.suggestions li button');
    expect(items.length).toBeGreaterThan(0);
    const labels = Array.from(items).map((b) => b.textContent ?? '');
    expect(labels).toContain('solana');
  });

  it('does not suggest the mandatory asset', async () => {
    const { container } = render(CoinSelector);
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'bit' } });
    const items = container.querySelectorAll('.suggestions li button');
    const labels = Array.from(items).map((b) => b.textContent ?? '');
    expect(labels).not.toContain(MANDATORY_ASSET);
  });

  it('does not suggest already-enabled coins', async () => {
    toggleAsset('ethereum');
    const { container } = render(CoinSelector);
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'eth' } });
    const items = container.querySelectorAll('.suggestions li button');
    const labels = Array.from(items).map((b) => b.textContent ?? '');
    expect(labels).not.toContain('ethereum');
  });

  it('clicking a suggestion enables the coin and clears the input', async () => {
    const { container } = render(CoinSelector);
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'sol' } });
    const btn = container.querySelector('.suggestions li button') as HTMLButtonElement;
    await fireEvent.click(btn);
    expect(get(enabledAssets)).toContain('solana');
    expect(input.value).toBe('');
  });

  it('pressing Enter enables the top suggestion and clears the input', async () => {
    const { container } = render(CoinSelector);
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'sol' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(get(enabledAssets)).toContain('solana');
    expect(input.value).toBe('');
  });

  it('pressing Enter does nothing when there are no suggestions', async () => {
    const before = get(enabledAssets).length;
    const { container } = render(CoinSelector);
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(get(enabledAssets).length).toBe(before);
  });
});
