<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import PriceCard from './components/PriceCard.svelte';
  import AlertForm from './components/AlertForm.svelte';
  import AlertList from './components/AlertList.svelte';
  import { MONITORED_ASSETS } from './lib/config';
  import { PriceFeed, type PriceFeedStatus } from './lib/websocket';
  import { BinanceKlineFeed } from './lib/binance';
  import { applyTick, prices } from './lib/prices';
  import { applyCandle, volumes } from './lib/volumes';
  import { alerts, evaluate, markFired } from './lib/alerts';
  import {
    currentPermission,
    notify,
    requestPermission,
    type NotificationPermissionState
  } from './lib/notifications';

  let status: PriceFeedStatus = 'idle';
  let permission: NotificationPermissionState = currentPermission();

  const feed = new PriceFeed({ assets: MONITORED_ASSETS });
  const klineFeed = new BinanceKlineFeed(MONITORED_ASSETS);

  const unsubStatus = feed.onStatus((s) => (status = s));
  const unsubTick = feed.onTick(({ asset, price, receivedAt }) => {
    applyTick(asset, price, receivedAt);
  });
  const unsubCandle = klineFeed.onCandleClosed(({ asset, baseVolume, closeTime }) => {
    applyCandle(asset, baseVolume, closeTime);
  });

  const runEvaluation = (): void => {
    const now = Date.now();
    const priceMap = getPricesSnapshot();
    const volumeMap = getVolumesSnapshot();
    for (const alert of getAlertsSnapshot()) {
      const hit = evaluate(
        alert,
        { price: priceMap[alert.asset], volume: volumeMap[alert.asset] },
        now
      );
      if (!hit) continue;
      markFired(alert.id, now);
      notify(`tayrax · ${alert.asset}`, hit.message);
    }
  };

  const unsubPriceEval = prices.subscribe(() => runEvaluation());
  const unsubVolumeEval = volumes.subscribe(() => runEvaluation());

  let currentAlertsCache: typeof $alerts = [];
  const unsubAlertsCache = alerts.subscribe((a) => (currentAlertsCache = a));
  function getAlertsSnapshot(): typeof $alerts {
    return currentAlertsCache;
  }

  let currentPricesCache: typeof $prices = {};
  const unsubPricesCache = prices.subscribe((p) => (currentPricesCache = p));
  function getPricesSnapshot(): typeof $prices {
    return currentPricesCache;
  }

  let currentVolumesCache: typeof $volumes = {};
  const unsubVolumesCache = volumes.subscribe((v) => (currentVolumesCache = v));
  function getVolumesSnapshot(): typeof $volumes {
    return currentVolumesCache;
  }

  const handlePermission = async (): Promise<void> => {
    permission = await requestPermission();
  };

  onMount(() => {
    feed.start();
    klineFeed.start();
  });

  onDestroy(() => {
    unsubStatus();
    unsubTick();
    unsubCandle();
    unsubPriceEval();
    unsubVolumeEval();
    unsubAlertsCache();
    unsubPricesCache();
    unsubVolumesCache();
    feed.stop();
    klineFeed.stop();
  });
</script>

<header class="top">
  <div class="brand">
    <img src="/tayrax-logo.svg" alt="" width="32" height="32" />
    <h1>tayrax</h1>
  </div>
  <div class="status" class:open={status === 'open'} class:closed={status === 'closed'}>
    {status}
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

  <section class="grid">
    {#each MONITORED_ASSETS as asset}
      <PriceCard {asset} state={$prices[asset]} />
    {/each}
  </section>

  <section>
    <h2>Alerts</h2>
    <AlertForm />
    <div class="list"><AlertList /></div>
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
  .status {
    font-size: 0.8rem;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    background: #2a2a2a;
    color: #aaa;
  }
  .status.open { background: #0f2e1d; color: #4ade80; }
  .status.closed { background: #3a1f1f; color: #f87171; }

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
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
  }
  h2 { font-size: 1rem; margin: 0 0 0.75rem 0; color: #ccc; }
  .list { margin-top: 0.75rem; }
</style>
