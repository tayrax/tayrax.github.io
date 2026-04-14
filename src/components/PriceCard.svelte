<script lang="ts">
  import type { PriceState } from '../lib/prices';
  import { pctChangeOverWindow } from '../lib/prices';

  export let asset: string;
  export let state: PriceState | undefined;

  $: pct = state ? pctChangeOverWindow(state) : null;
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
</script>

<article class="card">
  <header>
    <h2>{asset}</h2>
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
</article>

<style>
  .card {
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    border-radius: 8px;
    padding: 1rem 1.25rem;
  }
  h2 {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #aaa;
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
