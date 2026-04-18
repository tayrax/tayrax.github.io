<!-- Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com> -->
<!-- See LICENSE file. -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import NavMenu from './components/NavMenu.svelte';
  import { getBotClient } from './lib/bot-client';
  import type { BotState } from './lib/bot-types';

  let state: BotState | null = null;

  const botClient = getBotClient();
  const unsub = botClient.subscribe((msg) => {
    if (msg.type === 'botState') state = msg.state;
  });
  botClient.post({ type: 'subscribeBotState' });

  onDestroy(() => {
    unsub();
  });

  function reconnect(feed: 'price' | 'kline'): void {
    botClient.post({ type: 'reconnect', feed });
  }

  function formatTime(ms: number | undefined): string {
    if (!ms) return '—';
    return new Date(ms).toLocaleTimeString();
  }
</script>

<header class="top">
  <div class="brand">
    <NavMenu />
    <span>tayrax</span>
    <span class="sep">/</span>
    <span class="page">bot</span>
  </div>
</header>

<main>
  {#if state === null}
    <section>
      <div class="loading">Connecting to bot worker…</div>
    </section>
  {:else}

    <!-- Feed status -->
    <section>
      <h2>Feed status</h2>
      <div class="cap-grid">
        <div class="cap-row">
          <span class="cap-name">Price feed</span>
          <span
            class="badge"
            class:ok={state.priceStatus === 'open'}
            class:warn={state.priceStatus === 'connecting'}
            class:fail={state.priceStatus === 'closed' || state.priceStatus === 'idle'}
          >{state.priceStatus}</span>
          <button type="button" class="btn-reconnect" on:click={() => reconnect('price')}>reconnect</button>
        </div>
        <div class="cap-row">
          <span class="cap-name">Kline feed</span>
          <span
            class="badge"
            class:ok={state.klineStatus === 'open'}
            class:fail={state.klineStatus === 'closed' || state.klineStatus === 'idle'}
          >{state.klineStatus}</span>
          <button type="button" class="btn-reconnect" on:click={() => reconnect('kline')}>reconnect</button>
        </div>
      </div>
    </section>

    <!-- Stats -->
    <section>
      <h2>Stats</h2>
      <div class="cap-grid">
        <div class="cap-row">
          <span class="cap-name">Connected tabs</span>
          <span class="val">{state.connectedTabCount}</span>
        </div>
        <div class="cap-row">
          <span class="cap-name">Price reconnects</span>
          <span class="val">{state.reconnectCount.price}</span>
        </div>
        <div class="cap-row">
          <span class="cap-name">Kline reconnects</span>
          <span class="val">{state.reconnectCount.kline}</span>
        </div>
      </div>
    </section>

    <!-- Tracked assets -->
    <section>
      <h2>Tracked assets</h2>
      {#if state.enabledAssets.length === 0}
        <div class="hint">No assets enabled.</div>
      {:else}
        <div class="cap-grid">
          {#each state.enabledAssets as asset}
            <div class="cap-row">
              <span class="cap-name">{asset}</span>
              <span class="val">{formatTime(state.lastTickAt[asset])}</span>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <!-- Recent errors -->
    {#if state.recentErrors.length > 0}
      <section>
        <h2>Recent errors</h2>
        <div class="error-list">
          {#each [...state.recentErrors].reverse() as err}
            <div class="error-row">
              <span class="err-feed">{err.feed}</span>
              <span class="err-time">{formatTime(err.at)}</span>
              <span class="err-msg">{err.message}</span>
            </div>
          {/each}
        </div>
      </section>
    {/if}

  {/if}
</main>

<style>
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.5rem;
    border-bottom: 1px solid #222;
    font-size: 0.9rem;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: #ccc;
  }
  .sep { color: #444; }
  .page { color: #888; font-weight: 400; }

  main {
    max-width: 860px;
    margin: 0 auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  section { display: flex; flex-direction: column; gap: 0.75rem; }

  h2 {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #666;
    margin: 0;
  }

  .badge {
    display: inline-block;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    font-size: 0.78rem;
    background: #2a2a2a;
    color: #888;
  }
  .badge.ok   { background: #0f2e1d; color: #4ade80; }
  .badge.warn { background: #2d2310; color: #fbbf24; }
  .badge.fail { background: #3a1f1f; color: #f87171; }

  .cap-grid { display: flex; flex-direction: column; gap: 0.4rem; }
  .cap-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.4rem 0.75rem;
    background: #161616;
    border-radius: 5px;
    border: 1px solid #222;
  }
  .cap-name { font-size: 0.85rem; color: #bbb; flex: 1; }
  .val { font-size: 0.85rem; color: #aaa; }

  .btn-reconnect {
    background: #222;
    color: #aaa;
    border: 1px solid #333;
    border-radius: 5px;
    padding: 0.25rem 0.65rem;
    font: inherit;
    font-size: 0.78rem;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .btn-reconnect:hover { background: #2a2a2a; color: #eee; }

  .error-list { display: flex; flex-direction: column; gap: 0.3rem; }
  .error-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.35rem 0.75rem;
    background: #1f1515;
    border: 1px solid #3a2020;
    border-radius: 5px;
    font-size: 0.82rem;
  }
  .err-feed  { color: #f87171; font-weight: 600; min-width: 3rem; }
  .err-time  { color: #555; min-width: 6rem; }
  .err-msg   { color: #999; }

  .loading, .hint {
    font-size: 0.85rem;
    color: #666;
    padding: 0.5rem 0;
  }
</style>
