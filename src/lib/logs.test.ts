// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { logs, logAction, clearLogs } from './logs';
import { LOG_MAX_ENTRIES, STORAGE_KEYS } from './config';

const reset = (): void => {
  localStorage.removeItem(STORAGE_KEYS.logs);
  clearLogs();
};

describe('logs — store operations', () => {
  beforeEach(reset);

  it('starts empty', () => {
    expect(get(logs)).toEqual([]);
  });

  it('logAction prepends so newest is first', async () => {
    logAction({ kind: 'alertDispatched', asset: 'bitcoin', message: 'first' });
    // ensure distinct ids even with tight loop
    await new Promise((r) => setTimeout(r, 1));
    logAction({ kind: 'alertDispatched', asset: 'ethereum', message: 'second' });
    const list = get(logs);
    expect(list).toHaveLength(2);
    expect(list[0].message).toBe('second');
    expect(list[1].message).toBe('first');
  });

  it('assigns id and ts to each entry', () => {
    const before = Date.now();
    logAction({ kind: 'alertDispatched', message: 'hello' });
    const after = Date.now();
    const [entry] = get(logs);
    expect(entry.id).toMatch(/.+/);
    expect(entry.ts).toBeGreaterThanOrEqual(before);
    expect(entry.ts).toBeLessThanOrEqual(after);
  });

  it('persists entries to localStorage under the versioned key', () => {
    logAction({ kind: 'alertDispatched', message: 'persisted' });
    const raw = localStorage.getItem(STORAGE_KEYS.logs);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.version).toBe(1);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].message).toBe('persisted');
  });

  it('clearLogs empties the store and persists an empty list', () => {
    logAction({ kind: 'alertDispatched', message: 'x' });
    clearLogs();
    expect(get(logs)).toEqual([]);
    const raw = localStorage.getItem(STORAGE_KEYS.logs);
    const parsed = JSON.parse(raw as string);
    expect(parsed.entries).toEqual([]);
  });

  it('caps the buffer at LOG_MAX_ENTRIES, dropping the oldest', () => {
    for (let i = 0; i < LOG_MAX_ENTRIES + 25; i++) {
      logAction({ kind: 'alertDispatched', message: `m${i}` });
    }
    const list = get(logs);
    expect(list).toHaveLength(LOG_MAX_ENTRIES);
    expect(list[0].message).toBe(`m${LOG_MAX_ENTRIES + 24}`);
    expect(list[list.length - 1].message).toBe(`m${25}`);
  });
});

describe('logs — persistence edge cases', () => {
  beforeEach(reset);

  it('ignores payloads with wrong version (stale load returns empty)', () => {
    localStorage.setItem(
      STORAGE_KEYS.logs,
      JSON.stringify({ version: 999, entries: [{ id: 'x', ts: 0, kind: 'alertDispatched', message: 'm' }] })
    );
    // re-import style check: use a fresh read via logAction to re-trigger state.
    // We can't re-import cleanly; instead verify the shape was rejected by dispatching
    // the storage event which forces a re-hydrate via loadLogs().
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.logs }));
    expect(get(logs)).toEqual([]);
  });

  it('ignores malformed JSON (corrupt storage returns empty)', () => {
    localStorage.setItem(STORAGE_KEYS.logs, 'not-json{{{');
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.logs }));
    expect(get(logs)).toEqual([]);
  });
});

describe('logs — cross-tab sync', () => {
  beforeEach(reset);

  it('re-hydrates on storage event matching the logs key', () => {
    const external = {
      version: 1,
      entries: [
        { id: 'a', ts: 1, kind: 'alertDispatched' as const, message: 'from other tab' }
      ]
    };
    localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(external));
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.logs }));
    const list = get(logs);
    expect(list).toHaveLength(1);
    expect(list[0].message).toBe('from other tab');
  });

  it('ignores storage events for unrelated keys', () => {
    logAction({ kind: 'alertDispatched', message: 'local' });
    const before = get(logs);
    window.dispatchEvent(new StorageEvent('storage', { key: 'some.other.key' }));
    expect(get(logs)).toEqual(before);
  });
});
