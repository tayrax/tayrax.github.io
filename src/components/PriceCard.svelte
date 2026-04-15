<!-- Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com> -->
<!-- See LICENSE file. -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { PriceState } from '../lib/prices';
  import { pctChangeOverWindow } from '../lib/prices';

  export let asset: string;
  export let state: PriceState | undefined;
  export let selected = false;

  const STALE_AFTER_MS = 30_000;

  let now = Date.now();
  const tick = setInterval(() => (now = Date.now()), 5_000);
  onDestroy(() => clearInterval(tick));

  $: pct = state ? pctChangeOverWindow(state) : null;
  $: ageMs = state ? now - state.updatedAt : null;
  $: stale = ageMs !== null && ageMs > STALE_AFTER_MS;
  $: direction =
    state && state.prevPrice !== null
      ? state.price > state.prevPrice
        ? 'up'
        : state.price < state.prevPrice
          ? 'down'
          : 'flat'
      : 'flat';

  const fmt = (n: number): string =>
    n >= 100 ? n.toFixed(2) : n >= 1 ? n.toFixed(4) : n.toPrecision(4);

  const fmtAge = (ms: number): string => {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ago`;
  };
</script>

<button type="button" class="card" class:stale class:selected on:click>
  <header>
    <h2>{asset}</h2>
    {#if stale && ageMs !== null}
      <span class="badge">cached · {fmtAge(ageMs)}</span>
    {/if}
  </header>
  {#if state}
    <div class="price {direction}">${fmt(state.price)}</div>
    <div class="meta">
      {#if pct !== null}
        <span class:up={pct > 0} class:down={pct < 0}>
          {pct >= 0 ? '+' : ''}{pct.toFixed(2)}% /1h
        </span>
      {:else}
        <span class="muted">collecting 1h window…</span>
      {/if}
    </div>
  {:else}
    <div class="price muted">—</div>
    <div class="meta muted">waiting for data</div>
  {/if}
</button>

<style>
  .card {
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    border-radius: 8px;
    padding: 1rem 1.25rem;
    text-align: left;
    cursor: pointer;
    font: inherit;
    width: 100%;
  }
  .card:hover { border-color: #444; }
  .card.selected { border-color: #3730a3; background: #1a1a2e; }
  .card.stale { opacity: 0.7; border-style: dashed; }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  h2 {
    margin: 0;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #aaa;
  }
  .badge {
    font-size: 0.7rem;
    color: #f59e0b;
    background: #2a1f0a;
    border: 1px solid #4a3714;
    border-radius: 999px;
    padding: 0.1rem 0.5rem;
    white-space: nowrap;
  }
  .price {
    font-size: 1.75rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    transition: color 0.4s ease;
  }
  .price.up { color: #4ade80; }
  .price.down { color: #f87171; }
  .price.flat { color: #eee; }
  .meta { margin-top: 0.25rem; font-size: 0.85rem; }
  .meta .up { color: #4ade80; }
  .meta .down { color: #f87171; }
  .muted { color: #777; }
</style>
