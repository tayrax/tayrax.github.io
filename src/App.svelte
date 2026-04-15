<!-- Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com> -->
<!-- See LICENSE file. -->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import PriceCard from './components/PriceCard.svelte';
  import AlertForm from './components/AlertForm.svelte';
  import AlertList from './components/AlertList.svelte';
  import NavMenu from './components/NavMenu.svelte';
  import Chart from './components/Chart.svelte';
  import CoinSelector from './components/CoinSelector.svelte';
  import { MANDATORY_ASSET, PRICE_PROVIDER } from './lib/config';
  import type { AssetId } from './lib/config';
  import { enabledAssets, getExpiredDisabledAssets, clearExpiredDisabledAt } from './lib/enabled-assets';
  import type { PriceFeedStatus, PriceProvider } from './lib/provider';
  import { PriceFeed } from './lib/websocket';
  import { BinancePriceFeed } from './lib/binance-price';
  import { BinanceKlineFeed } from './lib/binance';
  import { applyTick, prices, pruneAssets } from './lib/prices';
  import { applyCandle, volumes, pruneVolumes } from './lib/volumes';
  import { applyClosedCandle, candles, pruneCandles } from './lib/candles';
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
  let showCoinSelector = false;

  // Track enabled assets — declared early so runEvaluation can reference it safely
  let mounted = false;
  let currentEnabledCache: AssetId[] = [];

  // Feed instances — created/recreated when enabled assets change
  let feed: PriceProvider | null = null;
  let klineFeed: BinanceKlineFeed | null = null;
  let unsubFeedStatus: (() => void) | null = null;
  let unsubFeedTick: (() => void) | null = null;
  let unsubFeedCandle: (() => void) | null = null;

  function createPriceFeed(assets: readonly AssetId[]): PriceProvider {
    if (PRICE_PROVIDER === 'binance') return new BinancePriceFeed(assets);
    return new PriceFeed({ assets });
  }

  function startFeeds(assets: readonly AssetId[]): void {
    // Tear down existing feeds
    unsubFeedStatus?.();
    unsubFeedTick?.();
    unsubFeedCandle?.();
    feed?.stop();
    klineFeed?.stop();

    feed = createPriceFeed(assets);
    klineFeed = new BinanceKlineFeed(assets);

    unsubFeedStatus = feed.onStatus((s) => (status = s));
    unsubFeedTick = feed.onTick(({ asset, price, receivedAt }) => {
      applyTick(asset, price, receivedAt);
    });
    unsubFeedCandle = klineFeed.onCandleClosed((candle) => {
      applyCandle(candle.asset, candle.baseVolume, candle.closeTime);
      applyClosedCandle(candle);
    });

    feed.start();
    klineFeed.start();
  }

  const runEvaluation = (): void => {
    const now = Date.now();
    const priceMap = getPricesSnapshot();
    const volumeMap = getVolumesSnapshot();
    const candleMap = getCandlesSnapshot();
    const enabled = new Set(currentEnabledCache);
    for (const alert of getAlertsSnapshot()) {
      if (!enabled.has(alert.asset as AssetId)) continue;
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

  let selectedAsset: string = MANDATORY_ASSET;

  const unsubEnabled = enabledAssets.subscribe((enabled) => {
    if (!mounted) {
      currentEnabledCache = enabled;
      return;
    }
    const newAssets = enabled.filter((a) => !currentEnabledCache.includes(a));
    currentEnabledCache = enabled;
    startFeeds(enabled);
    if (newAssets.length > 0) void backfillAll(newAssets);
    if (!enabled.includes(selectedAsset as AssetId)) {
      selectedAsset = MANDATORY_ASSET;
    }
  });

  onMount(() => {
    // Prune assets that have been disabled beyond the grace period
    const expired = getExpiredDisabledAssets();
    if (expired.size > 0) {
      pruneAssets(expired);
      pruneCandles(expired);
      pruneVolumes(expired);
      clearExpiredDisabledAt(expired);
    }

    mounted = true;
    startFeeds(currentEnabledCache);
    void backfillAll(currentEnabledCache);
  });

  onDestroy(() => {
    unsubFeedStatus?.();
    unsubFeedTick?.();
    unsubFeedCandle?.();
    unsubPriceEval();
    unsubVolumeEval();
    unsubAlertsCache();
    unsubPricesCache();
    unsubVolumesCache();
    unsubCandlesCache();
    unsubEnabled();
    feed?.stop();
    klineFeed?.stop();
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
