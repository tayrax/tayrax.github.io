<!-- Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com> -->
<!-- See LICENSE file. -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import PriceCard from './components/PriceCard.svelte';
  import AlertForm from './components/AlertForm.svelte';
  import AlertList from './components/AlertList.svelte';
  import NavMenu from './components/NavMenu.svelte';
  import Chart from './components/Chart.svelte';
  import CoinSelector from './components/CoinSelector.svelte';
  import { MANDATORY_ASSET, DEFAULT_CHART_INTERVAL, type CandleInterval } from './lib/config';
  import type { AssetId } from './lib/config';
  import { enabledAssets } from './lib/enabled-assets';
  import type { PriceFeedStatus } from './lib/provider';
  import { applyTick, prices, pruneAssets } from './lib/prices';
  import { applyCandle, pruneVolumes } from './lib/volumes';
  import { applyClosedCandle, pruneCandles } from './lib/candles';
  import {
    currentPermission,
    notify,
    requestPermission,
    type NotificationPermissionState
  } from './lib/notifications';
  import { getBotClient } from './lib/bot-client';
  import type { WorkerToTab } from './lib/bot-types';

  let status: PriceFeedStatus = 'idle';
  let permission: NotificationPermissionState = currentPermission();
  let showCoinSelector = false;

  // The SharedWorker owns all evaluation, logging, backfill, and notification
  // logic, as well as the authoritative alerts + enabled-assets state. This
  // component mirrors feed broadcasts into tab-side stores for UI rendering
  // and relays pruneAssets/notify messages to tab-side cleanup + browser APIs.
  const botClient = getBotClient();

  const handlePermission = async (): Promise<void> => {
    permission = await requestPermission();
  };

  let selectedAsset: string = MANDATORY_ASSET;
  let selectedInterval: CandleInterval = DEFAULT_CHART_INTERVAL;

  const unsubEnabled = enabledAssets.subscribe((enabled) => {
    if (!enabled.includes(selectedAsset as AssetId)) {
      selectedAsset = MANDATORY_ASSET;
    }
  });

  const unsubBot = botClient.subscribe((msg: WorkerToTab) => {
    switch (msg.type) {
      case 'priceTick':
        applyTick(msg.asset, msg.price, msg.receivedAt);
        break;
      case 'closedCandle':
        if (msg.interval === '1m') applyCandle(msg.asset, msg.candle.baseVolume, msg.candle.closeTime);
        applyClosedCandle(msg.interval, { asset: msg.asset, interval: msg.interval, ...msg.candle });
        break;
      case 'priceStatus':
        status = msg.status;
        break;
      case 'notify':
        notify(msg.title, msg.body);
        break;
      case 'pruneAssets': {
        const set = new Set(msg.assets);
        pruneAssets(set);
        pruneCandles(set);
        pruneVolumes(set);
        break;
      }
    }
  });

  onDestroy(() => {
    unsubBot();
    unsubEnabled();
  });
</script>

<header class="top">
  <div class="brand">
    <NavMenu size={32} />
    <h1>tayrax</h1>
  </div>
  <div class="right">
    <div class="status" class:open={status === 'open'} class:closed={status === 'closed'}>
      {status}
    </div>
    <a class="help-btn" href="/help/" aria-label="Help">?</a>
  </div>
</header>

<main>
  {#if permission !== 'granted'}
    <div class="perm">
      {#if permission === 'unsupported'}
        Notifications are not supported in this browser.
      {:else if permission === 'denied'}
        Notifications are blocked. Alerts will still show in the list.
      {:else}
        <button type="button" on:click={handlePermission}>Enable browser notifications</button>
      {/if}
    </div>
  {/if}

  <section class="coins-section">
    <div class="coins-header">
      <h2>Coins</h2>
      <button
        type="button"
        class="toggle-btn"
        on:click={() => (showCoinSelector = !showCoinSelector)}
        aria-expanded={showCoinSelector}
      >{showCoinSelector ? 'hide' : 'configure'}</button>
    </div>
    {#if showCoinSelector}
      <CoinSelector />
    {/if}
  </section>

  <section class="grid">
    {#each $enabledAssets as asset}
      <PriceCard {asset} state={$prices[asset]} selected={selectedAsset === asset} on:click={() => (selectedAsset = asset)} />
    {/each}
  </section>

  <section class="charts">
    <h2>Charts</h2>
    <Chart asset={selectedAsset} bind:selectedInterval />
  </section>

  <section>
    <h2>Alerts</h2>
    <AlertForm {selectedInterval} />
    <div class="list"><AlertList {selectedInterval} /></div>
  </section>
</main>

<style>
  :global(body) {
    font-family: system-ui, -apple-system, sans-serif;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #222;
  }
  .brand { display: flex; align-items: center; gap: 0.6rem; }
  .brand h1 { font-size: 1.1rem; margin: 0; letter-spacing: 0.04em; }
  .right { display: flex; align-items: center; gap: 0.6rem; }
  .status {
    font-size: 0.8rem;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    background: #2a2a2a;
    color: #aaa;
  }
  .status.open { background: #0f2e1d; color: #4ade80; }
  .status.closed { background: #3a1f1f; color: #f87171; }
  .help-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 999px;
    border: 1px solid #444;
    background: #2a2a2a;
    color: #aaa;
    font-size: 0.8rem;
    text-decoration: none;
  }
  .help-btn:hover { background: #333; color: #fff; }

  main {
    max-width: 960px;
    margin: 0 auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .perm {
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    border-radius: 6px;
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
  }
  .perm button {
    background: #2563eb;
    color: white;
    border: 0;
    border-radius: 4px;
    padding: 0.4rem 0.8rem;
    cursor: pointer;
    font: inherit;
  }
  .coins-section { display: flex; flex-direction: column; gap: 0.5rem; }
  .coins-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .coins-header h2 { margin: 0; }
  .toggle-btn {
    font-size: 0.75rem;
    padding: 0.2rem 0.6rem;
    border-radius: 4px;
    border: 1px solid #333;
    background: transparent;
    color: #666;
    cursor: pointer;
    font-family: inherit;
  }
  .toggle-btn:hover { color: #aaa; border-color: #444; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
  }
  h2 { font-size: 1rem; margin: 0 0 0.75rem 0; color: #ccc; }
  .list { margin-top: 0.75rem; }
</style>
