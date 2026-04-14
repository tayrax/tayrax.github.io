// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import AlertForm from './AlertForm.svelte';
import { alerts } from '../lib/alerts';
import { MONITORED_ASSETS } from '../lib/config';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const getAlertCount = (): number => get(alerts).length;

const selectKind = async (container: HTMLElement, kind: string): Promise<void> => {
  const select = container.querySelectorAll('select')[1] as HTMLSelectElement;
  await fireEvent.change(select, { target: { value: kind } });
};

const fillInput = async (input: HTMLInputElement | null, value: string): Promise<void> => {
  if (!input) throw new Error('input not found');
  await fireEvent.input(input, { target: { value } });
};

// ---------------------------------------------------------------------------
// rendering
// ---------------------------------------------------------------------------
describe('AlertForm — rendering', () => {
  it('renders an asset select populated with all MONITORED_ASSETS', () => {
    const { container } = render(AlertForm);
    const assetSelect = container.querySelectorAll('select')[0] as HTMLSelectElement;
    const options = Array.from(assetSelect.options).map((o) => o.value);
    expect(options).toEqual(MONITORED_ASSETS);
  });

  it('shows a single value input for "above" kind (default)', () => {
    const { container } = render(AlertForm);
    expect(container.querySelectorAll('input[type="number"]').length).toBe(1);
  });

  it('shows low and high inputs for "range" kind', async () => {
    const { container } = render(AlertForm);
    await selectKind(container, 'range');
    expect(container.querySelectorAll('input[type="number"]').length).toBe(2);
  });

  it('shows a multiplier input for "volumeSpike" kind', async () => {
    const { container } = render(AlertForm);
    await selectKind(container, 'volumeSpike');
    const inputs = container.querySelectorAll('input[type="number"]');
    expect(inputs.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// valid submissions
// ---------------------------------------------------------------------------
describe('AlertForm — valid submission', () => {
  beforeEach(() => {
    // Capture store length before each test; tests use absolute count via snapshot
  });

  it('adds an "above" alert and resets the input', async () => {
    const { container, getByText } = render(AlertForm);
    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    await fillInput(input, '60000');
    const before = getAlertCount();
    await fireEvent.click(getByText('Add alert'));
    expect(getAlertCount()).toBe(before + 1);
    const last = get(alerts).at(-1)!;
    expect(last.kind).toBe('above');
    expect('value' in last && last.value).toBe(60_000);
    expect(input.value).toBe('');
  });

  it('adds a "below" alert', async () => {
    const { container, getByText } = render(AlertForm);
    await selectKind(container, 'below');
    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    await fillInput(input, '40000');
    const before = getAlertCount();
    await fireEvent.click(getByText('Add alert'));
    expect(getAlertCount()).toBe(before + 1);
    const last = get(alerts).at(-1)!;
    expect(last.kind).toBe('below');
  });

  it('adds a "range" alert', async () => {
    const { container, getByText } = render(AlertForm);
    await selectKind(container, 'range');
    const inputs = container.querySelectorAll('input[type="number"]');
    await fillInput(inputs[0] as HTMLInputElement, '40000');
    await fillInput(inputs[1] as HTMLInputElement, '60000');
    const before = getAlertCount();
    await fireEvent.click(getByText('Add alert'));
    expect(getAlertCount()).toBe(before + 1);
    const last = get(alerts).at(-1)!;
    expect(last.kind).toBe('range');
  });

  it('adds a "pctChange" alert', async () => {
    const { container, getByText } = render(AlertForm);
    await selectKind(container, 'pctChange');
    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    await fillInput(input, '5');
    const before = getAlertCount();
    await fireEvent.click(getByText('Add alert'));
    expect(getAlertCount()).toBe(before + 1);
    expect(get(alerts).at(-1)!.kind).toBe('pctChange');
  });

  it('adds a "volumeSpike" alert', async () => {
    const { container, getByText } = render(AlertForm);
    await selectKind(container, 'volumeSpike');
    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    await fillInput(input, '3');
    const before = getAlertCount();
    await fireEvent.click(getByText('Add alert'));
    expect(getAlertCount()).toBe(before + 1);
    expect(get(alerts).at(-1)!.kind).toBe('volumeSpike');
  });
});

// ---------------------------------------------------------------------------
// validation errors
// ---------------------------------------------------------------------------
describe('AlertForm — validation', () => {
  it('shows "Provide low < high" when range low >= high', async () => {
    const { container, getByText } = render(AlertForm);
    await selectKind(container, 'range');
    const inputs = container.querySelectorAll('input[type="number"]');
    await fillInput(inputs[0] as HTMLInputElement, '60000');
    await fillInput(inputs[1] as HTMLInputElement, '40000');
    await fireEvent.click(getByText('Add alert'));
    expect(getByText('Provide low < high')).toBeInTheDocument();
  });

  it('shows "Multiplier must be > 1" for multiplier ≤ 1', async () => {
    const { container, getByText } = render(AlertForm);
    await selectKind(container, 'volumeSpike');
    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    await fillInput(input, '1');
    await fireEvent.click(getByText('Add alert'));
    expect(getByText('Multiplier must be > 1')).toBeInTheDocument();
  });

  it('does not add an alert when validation fails', async () => {
    const { container, getByText } = render(AlertForm);
    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    await fillInput(input, 'bad');
    const before = getAlertCount();
    await fireEvent.click(getByText('Add alert'));
    expect(getAlertCount()).toBe(before);
  });
});
