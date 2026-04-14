// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import {
  alerts,
  addAlert,
  removeAlert,
  markFired,
  evaluate,
  type StoredAlert,
  type EvalContext,
} from './alerts';
import { ALERT_COOLDOWN_MS } from './config';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const makeAlert = (overrides: Partial<StoredAlert> = {}): StoredAlert =>
  ({
    id: 'test-id',
    asset: 'bitcoin',
    kind: 'above',
    value: 50_000,
    lastFiredAt: null,
    ...overrides,
  } as StoredAlert);

const priceCtx = (price: number, history: { price: number; at: number }[] = []): EvalContext => ({
  price: {
    price,
    prevPrice: null,
    updatedAt: Date.now(),
    history: history.length ? history : [{ price: price * 0.99, at: Date.now() - 1000 }, { price, at: Date.now() }],
  },
});

// ---------------------------------------------------------------------------
// evaluate — cooldown
// ---------------------------------------------------------------------------
describe('evaluate — cooldown', () => {
  it('returns null when the alert fired recently', () => {
    const now = Date.now();
    const alert = makeAlert({ lastFiredAt: now - ALERT_COOLDOWN_MS + 1 });
    expect(evaluate(alert, priceCtx(100_000), now)).toBeNull();
  });

  it('fires again once the cooldown expires', () => {
    const now = Date.now();
    const alert = makeAlert({ lastFiredAt: now - ALERT_COOLDOWN_MS - 1 });
    expect(evaluate(alert, priceCtx(100_000), now)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluate — above
// ---------------------------------------------------------------------------
describe('evaluate — above', () => {
  const alert = makeAlert({ kind: 'above', value: 50_000 });
  const now = Date.now();

  it('fires when price is above the threshold', () => {
    const result = evaluate(alert, priceCtx(51_000), now);
    expect(result).not.toBeNull();
    expect(result?.message).toContain('above');
    expect(result?.message).toContain('bitcoin');
  });

  it('does not fire when price equals the threshold', () => {
    expect(evaluate(alert, priceCtx(50_000), now)).toBeNull();
  });

  it('does not fire when price is below the threshold', () => {
    expect(evaluate(alert, priceCtx(49_000), now)).toBeNull();
  });

  it('returns null when no price data is available', () => {
    expect(evaluate(alert, {}, now)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluate — below
// ---------------------------------------------------------------------------
describe('evaluate — below', () => {
  const alert = makeAlert({ kind: 'below', value: 50_000 });
  const now = Date.now();

  it('fires when price is below the threshold', () => {
    expect(evaluate(alert, priceCtx(49_000), now)).not.toBeNull();
  });

  it('does not fire when price equals the threshold', () => {
    expect(evaluate(alert, priceCtx(50_000), now)).toBeNull();
  });

  it('does not fire when price is above the threshold', () => {
    expect(evaluate(alert, priceCtx(51_000), now)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluate — range
// ---------------------------------------------------------------------------
describe('evaluate — range', () => {
  const alert = makeAlert({ kind: 'range', low: 40_000, high: 60_000 } as StoredAlert);
  const now = Date.now();

  it('fires when price is within the range (inclusive)', () => {
    expect(evaluate(alert, priceCtx(40_000), now)).not.toBeNull();
    expect(evaluate(alert, priceCtx(50_000), now)).not.toBeNull();
    expect(evaluate(alert, priceCtx(60_000), now)).not.toBeNull();
  });

  it('does not fire when price is outside the range', () => {
    expect(evaluate(alert, priceCtx(39_999), now)).toBeNull();
    expect(evaluate(alert, priceCtx(60_001), now)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluate — pctChange
// ---------------------------------------------------------------------------
describe('evaluate — pctChange', () => {
  const alert = makeAlert({ kind: 'pctChange', value: 5 });
  const now = Date.now();

  it('fires when the absolute pct change meets or exceeds the threshold', () => {
    const ctx = priceCtx(105, [{ price: 100, at: now - 1000 }, { price: 105, at: now }]);
    expect(evaluate(alert, ctx, now)).not.toBeNull();
  });

  it('fires for negative moves beyond the threshold', () => {
    const ctx = priceCtx(94, [{ price: 100, at: now - 1000 }, { price: 94, at: now }]);
    expect(evaluate(alert, ctx, now)).not.toBeNull();
  });

  it('does not fire when the move is smaller than the threshold', () => {
    const ctx = priceCtx(103, [{ price: 100, at: now - 1000 }, { price: 103, at: now }]);
    expect(evaluate(alert, ctx, now)).toBeNull();
  });

  it('returns null when history is insufficient for pct calculation', () => {
    const ctx: EvalContext = {
      price: { price: 105, prevPrice: null, updatedAt: now, history: [] },
    };
    expect(evaluate(alert, ctx, now)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluate — volumeSpike
// ---------------------------------------------------------------------------
describe('evaluate — volumeSpike', () => {
  const alert = makeAlert({ kind: 'volumeSpike', multiplier: 3 } as StoredAlert);
  const now = Date.now();

  const makeVolumeCtx = (priorVolumes: number[], latest: number): EvalContext => ({
    volume: { recent: [...priorVolumes, latest], latest, updatedAt: now },
  });

  it('fires when the spike ratio meets the multiplier', () => {
    // 9 prior candles of volume 10, latest 30 → ratio 3 → meets threshold 3
    const ctx = makeVolumeCtx(Array(9).fill(10), 30);
    expect(evaluate(alert, ctx, now)).not.toBeNull();
  });

  it('fires when the spike ratio exceeds the multiplier', () => {
    const ctx = makeVolumeCtx(Array(9).fill(10), 50);
    expect(evaluate(alert, ctx, now)).not.toBeNull();
  });

  it('does not fire when the ratio is below the multiplier', () => {
    const ctx = makeVolumeCtx(Array(9).fill(10), 25);
    expect(evaluate(alert, ctx, now)).toBeNull();
  });

  it('does not fire when there are insufficient volume samples', () => {
    const ctx = makeVolumeCtx([10, 20], 100);
    expect(evaluate(alert, ctx, now)).toBeNull();
  });

  it('returns null when no volume data is available', () => {
    expect(evaluate(alert, {}, now)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// store operations: addAlert / removeAlert / markFired
// ---------------------------------------------------------------------------
describe('alert store', () => {
  it('addAlert appends a new alert with a generated id', () => {
    const before = get(alerts).length;
    addAlert({ asset: 'bitcoin', kind: 'above', value: 100_000 });
    const after = get(alerts);
    expect(after.length).toBe(before + 1);
    const added = after[after.length - 1];
    expect(added.id).toBeTruthy();
    expect(added.lastFiredAt).toBeNull();
  });

  it('removeAlert deletes the alert by id', () => {
    addAlert({ asset: 'ethereum', kind: 'below', value: 1000 });
    const all = get(alerts);
    const target = all[all.length - 1];
    removeAlert(target.id);
    expect(get(alerts).find((a) => a.id === target.id)).toBeUndefined();
  });

  it('markFired sets lastFiredAt on the matching alert', () => {
    addAlert({ asset: 'solana', kind: 'pctChange', value: 10 });
    const before = get(alerts);
    const target = before[before.length - 1];
    const ts = Date.now();
    markFired(target.id, ts);
    const updated = get(alerts).find((a) => a.id === target.id);
    expect(updated?.lastFiredAt).toBe(ts);
  });
});
