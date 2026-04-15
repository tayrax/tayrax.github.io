// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import Logs from './Logs.svelte';
import { logAction, clearLogs } from './lib/logs';
import { STORAGE_KEYS } from './lib/config';

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEYS.logs);
  clearLogs();
});

describe('Logs page — smoke', () => {
  it('mounts without throwing', () => {
    expect(() => render(Logs)).not.toThrow();
  });

  it('shows the empty state when no entries exist', () => {
    const { getByText } = render(Logs);
    expect(getByText('No actions logged yet.')).toBeInTheDocument();
  });

  it('renders an entry after logAction', async () => {
    logAction({ kind: 'alertDispatched', asset: 'bitcoin', message: 'bitcoin is above $100' });
    const { findByText } = render(Logs);
    expect(await findByText('bitcoin is above $100')).toBeInTheDocument();
  });

  it('disables the clear button when the list is empty', () => {
    const { getByRole } = render(Logs);
    const btn = getByRole('button', { name: /clear logs/i });
    expect(btn).toBeDisabled();
  });

  it('clear button empties the list after confirm', async () => {
    logAction({ kind: 'alertDispatched', message: 'to be cleared' });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { getByRole, findByText, queryByText } = render(Logs);
    const btn = getByRole('button', { name: /clear logs/i });
    btn.click();
    expect(confirmSpy).toHaveBeenCalled();
    expect(await findByText('No actions logged yet.')).toBeInTheDocument();
    expect(queryByText('to be cleared')).toBeNull();
    confirmSpy.mockRestore();
  });
});
