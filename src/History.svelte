<!-- Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com> -->
<!-- See LICENSE file. -->
<script lang="ts">
  import Chart from './components/Chart.svelte';
  import { enabledAssets } from './lib/enabled-assets';
  import { MANDATORY_ASSET } from './lib/config';
  import { fetchHistory, PRESET_CONFIG } from './lib/history-fetch';
  import { HISTORY_PRESETS, CACHE_TTL_MS, clearCached, type HistoryPreset } from './lib/history-cache';
  import type { OHLCVCandle } from './lib/candles';

  let selectedAsset: string = MANDATORY_ASSET;
  let selectedPreset: HistoryPreset = '1W';
  let subPane: 'rsi' | 'macd' = 'rsi';
  let candles: OHLCVCandle[] = [];
  let loading = false;
  let error: string | null = null;
  let loadId = 0;

  // MACD(12,26,9) requires 34 candles for a valid signal value — the most demanding
  // default indicator. When Binance returns fewer candles than the preset's full limit
  // (e.g. ALL monthly for assets only available since 2017), reserve this many candles
  // as warmup so indicators are valid from the first visible candle.
  const MIN_CHART_WARMUP = 34;

  async function load(asset: string, preset: HistoryPreset): Promise<void> {
    const id = ++loadId;
    loading = true;
    error = null;
    try {
      const result = await fetchHistory(asset, preset);
      if (id !== loadId) return;
      candles = result;
    } catch (e) {
      if (id !== loadId) return;
      error = e instanceof Error ? e.message : 'Failed to load history';
      candles = [];
    } finally {
      if (id === loadId) loading = false;
    }
  }

  async function refresh(): Promise<void> {
    await clearCached(selectedAsset, selectedPreset);
    await load(selectedAsset, selectedPreset);
  }

  $: void load(selectedAsset, selectedPreset);

  // When the API returns fewer candles than the preset's full limit (e.g. ALL for
  // assets listed on Binance only since 2017), reduce the display window so that at
  // least MIN_CHART_WARMUP candles remain as hidden warmup history for indicators.
  $: effectiveDisplayCount = (() => {
    const { displayCount, limit } = PRESET_CONFIG[selectedPreset];
    if (candles.length === 0 || candles.length >= limit) return displayCount;
    return Math.max(1, candles.length - MIN_CHART_WARMUP);
  })();

  const ttlLabel = (preset: HistoryPreset): string => {
    const ms = CACHE_TTL_MS[preset];
    if (ms < 60 * 60 * 1000) return `${ms / 60 / 1000}m`;
    if (ms < 24 * 60 * 60 * 1000) return `${ms / 60 / 60 / 1000}h`;
    return `${ms / 24 / 60 / 60 / 1000}d`;
  };
</script>

<main>
  <div class="history-header">
    <h2>History</h2>
    <div class="controls">
      <select bind:value={selectedAsset} class="asset-select">
        {#each $enabledAssets as asset}
          <option value={asset}>{asset}</option>
        {/each}
      </select>
      <div class="presets">
        {#each HISTORY_PRESETS as preset}
          <button
            type="button"
            class="preset-btn"
            class:active={selectedPreset === preset}
            on:click={() => (selectedPreset = preset)}
            title="{PRESET_CONFIG[preset].interval} candles · cache {ttlLabel(preset)}"
          >{preset}</button>
        {/each}
      </div>
      <button type="button" class="refresh-btn" on:click={refresh} disabled={loading} title="Force refresh">↻</button>
    </div>
  </div>

  {#if loading}
    <div class="state-msg">Loading…</div>
  {:else if error}
    <div class="state-msg error">{error}</div>
  {:else}
    <Chart asset={selectedAsset} overrideCandles={candles} overrideDisplayCount={effectiveDisplayCount} bind:subPane />
  {/if}
</main>

<style>
  main {
    max-width: 960px;
    margin: 0 auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  h2 { font-size: 1rem; margin: 0; color: #ccc; }
  .controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .asset-select {
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 4px;
    color: #ccc;
    font-size: 0.8rem;
    font-family: inherit;
    padding: 0.2rem 0.5rem;
    cursor: pointer;
  }
  .asset-select:focus { outline: none; border-color: #4c3d8a; }
  .presets { display: flex; gap: 0.3rem; }
  .preset-btn {
    font-size: 0.75rem;
    padding: 0.2rem 0.55rem;
    border-radius: 4px;
    border: 1px solid #333;
    background: transparent;
    color: #666;
    cursor: pointer;
    font-family: inherit;
    line-height: 1.4;
  }
  .preset-btn:hover { color: #aaa; border-color: #444; }
  .preset-btn.active { background: #1e1e2e; color: #a78bfa; border-color: #4c3d8a; }
  .refresh-btn {
    font-size: 1rem;
    line-height: 1;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    border: 1px solid #333;
    background: transparent;
    color: #555;
    cursor: pointer;
    font-family: inherit;
  }
  .refresh-btn:hover:not(:disabled) { color: #aaa; border-color: #444; }
  .refresh-btn:disabled { opacity: 0.3; cursor: default; }
  .state-msg {
    padding: 2rem;
    text-align: center;
    color: #555;
    font-size: 0.85rem;
  }
  .state-msg.error { color: #f87171; }
</style>
