<!-- Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com> -->
<!-- See LICENSE file. -->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import PriceCard from './components/PriceCard.svelte';
  import AlertForm from './components/AlertForm.svelte';
  import AlertList from './components/AlertList.svelte';
  import NavMenu from './components/NavMenu.svelte';
  import Chart from './components/Chart.svelte';
  import { MONITORED_ASSETS, PRICE_PROVIDER } from './lib/config';
  import type { PriceFeedStatus, PriceProvider } from './lib/provider';
  import { PriceFeed } from './lib/websocket';
  import { BinancePriceFeed } from './lib/binance-price';
  import { BinanceKlineFeed } from './lib/binance';
  import { applyTick, prices } from './lib/prices';
  import { applyCandle, volumes } from './lib/volumes';
  import { applyClosedCandle, candles } from './lib/candles';
  import { backfillAll } from './lib/backfill';
  import { computeIndicators } from './lib/indicators';
  import { alerts, evaluate, markFired } from './lib/alerts';
  import { logAction } from './lib/logs';
  import {
    currentPermission,
    notify,
    requestPermission,
    type NotificationPermissionState
  } from './lib/notifications';

  let status: PriceFeedStatus = 'idle';
  let permission: NotificationPermissionState = currentPermission();

  function createPriceFeed(): PriceProvider {
    if (PRICE_PROVIDER === 'binance') return new BinancePriceFeed(MONITORED_ASSETS);
    return new PriceFeed({ assets: MONITORED_ASSETS });
  }

  const feed: PriceProvider = createPriceFeed();
  const klineFeed = new BinanceKlineFeed(MONITORED_ASSETS);

  const unsubStatus = feed.onStatus((s) => (status = s));
  const unsubTick = feed.onTick(({ asset, price, receivedAt }) => {
    applyTick(asset, price, receivedAt);
  });
  const unsubCandle = klineFeed.onCandleClosed((candle) => {
    applyCandle(candle.asset, candle.baseVolume, candle.closeTime);
    applyClosedCandle(candle);
  });

  const runEvaluation = (): void => {
    const now = Date.now();
    const priceMap = getPricesSnapshot();
    const volumeMap = getVolumesSnapshot();
    const candleMap = getCandlesSnapshot();
    for (const alert of getAlertsSnapshot()) {
      const assetCandles = candleMap[alert.asset] ?? [];
      const indicators = assetCandles.length > 0 ? computeIndicators(assetCandles) : undefined;
      const hit = evaluate(
        alert,
        { price: priceMap[alert.asset], volume: volumeMap[alert.asset], indicators },
        now
      );
      if (!hit) continue;
      markFired(alert.id, now);
      notify(`tayrax · ${alert.asset}`, hit.message);
      logAction({
        kind: 'alertDispatched',
        asset: alert.asset,
        message: hit.message,
        data: { alertId: alert.id, alertKind: alert.kind }
      });
    }
  };

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

  let currentCandlesCache: typeof $candles = {};
  const unsubCandlesCache = candles.subscribe((c) => (currentCandlesCache = c));
  function getCandlesSnapshot(): typeof $candles {
    return currentCandlesCache;
  }

  const unsubPriceEval = prices.subscribe(() => runEvaluation());
  const unsubVolumeEval = volumes.subscribe(() => runEvaluation());

  const handlePermission = async (): Promise<void> => {
    permission = await requestPermission();
  };

  let selectedAsset: string = MONITORED_ASSETS[0];

  onMount(() => {
    feed.start();
    klineFeed.start();
    backfillAll(MONITORED_ASSETS);
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
    unsubCandlesCache();
    feed.stop();
    klineFeed.stop();
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

  <section class="grid">
    {#each MONITORED_ASSETS as asset}
      <PriceCard {asset} state={$prices[asset]} />
    {/each}
  </section>

  <section class="charts">
    <div class="charts-header">
      <h2>Charts</h2>
      <div class="asset-tabs">
        {#each MONITORED_ASSETS as asset}
          <button
            type="button"
            class="tab"
            class:active={selectedAsset === asset}
            on:click={() => (selectedAsset = asset)}
          >{asset}</button>
        {/each}
      </div>
    </div>
    <Chart asset={selectedAsset} />
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
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
  }
  .charts-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }
  .asset-tabs { display: flex; gap: 0.3rem; }
  .tab {
    font-size: 0.75rem;
    padding: 0.2rem 0.6rem;
    border-radius: 4px;
    border: 1px solid #333;
    background: transparent;
    color: #666;
    cursor: pointer;
    font-family: inherit;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .tab:hover { color: #aaa; border-color: #444; }
  .tab.active { background: #1a1a2e; color: #818cf8; border-color: #3730a3; }
  h2 { font-size: 1rem; margin: 0 0 0.75rem 0; color: #ccc; }
  .list { margin-top: 0.75rem; }
</style>
