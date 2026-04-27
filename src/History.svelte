<!-- Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com> -->
<!-- See LICENSE file. -->
<script lang="ts">
  import Chart from './components/Chart.svelte';
  import { enabledAssets } from './lib/enabled-assets';
  import { MANDATORY_ASSET } from './lib/config';
  import { fetchHistory, PRESET_CONFIG } from './lib/history-fetch';
  import { HISTORY_PRESETS, CACHE_TTL_MS, clearCached, type HistoryPreset } from './lib/history-cache';
  import type { OHLCVCandle } from './lib/candles';
  import type { ChartAnnotation } from './lib/chart-annotations';
  import { detectCandlePatterns } from './lib/candle-patterns';
  import { findSupportResistance } from './lib/support-resistance';
  import { detectIndicatorSignals } from './lib/indicator-signals';

  let selectedAsset: string = MANDATORY_ASSET;
  let selectedPreset: HistoryPreset = '1W';
  let subPane: 'rsi' | 'macd' = 'rsi';
  let candles: OHLCVCandle[] = [];
  let loading = false;
  let error: string | null = null;
  let loadId = 0;

  // --- indicator params (bound to Chart) ---
  let smaFast = 20;
  let smaSlow = 50;
  let emaFast = 12;
  let emaSlow = 26;
  let bbPeriod = 20;
  let bbStdDev = 2;
  let rsiPeriod = 14;
  let macdFastP = 12;
  let macdSlowP = 26;
  let macdSignalP = 9;

  // --- annotations ---
  type AnalysisMode = 'candle-patterns' | 'support-resistance' | 'indicator-signals';
  let annotations: ChartAnnotation[] = [];
  let analysisResults: Array<{ label: string; confidence: number; detail: string }> = [];
  let activeMode: AnalysisMode | null = null;
  let runningMode: AnalysisMode | null = null;

  function clearAnalysis(): void {
    annotations = [];
    analysisResults = [];
    activeMode = null;
  }

  function confidenceColor(conf: number): string {
    if (conf >= 85) return '#4ade80';
    if (conf >= 65) return '#fb923c';
    if (conf >= 40) return '#facc15';
    return '#6b7280';
  }

  function confidenceLabel(conf: number): string {
    if (conf >= 85) return 'Strong';
    if (conf >= 65) return 'High';
    if (conf >= 40) return 'Medium';
    return 'Low';
  }

  async function runCandlePatterns(): Promise<void> {
    runningMode = 'candle-patterns';
    clearAnalysis();
    await Promise.resolve(); // yield to UI
    const displayCount = effectiveDisplayCount;
    const startIdx = Math.max(0, candles.length - displayCount);
    const visible = candles.slice(startIdx);
    const params = { smaFast, smaSlow, emaFast, emaSlow, bbPeriod, bbStdDev, rsiPeriod, macdFast: macdFastP, macdSlow: macdSlowP, macdSignal: macdSignalP };
    const matches = detectCandlePatterns(candles, params);
    const newAnnotations: ChartAnnotation[] = [];
    const newResults: typeof analysisResults = [];
    for (const m of matches) {
      const visIdx = m.endIndex - startIdx;
      if (visIdx < 0 || visIdx >= visible.length) continue;
      const dir = m.direction === 'bearish' ? 'above' : 'below';
      const color = m.direction === 'bearish' ? '#f87171' : m.direction === 'bullish' ? '#4ade80' : '#a78bfa';
      newAnnotations.push({ type: 'candle-marker', visibleIndex: visIdx, direction: dir, color, label: m.name, confidence: m.confidence });
      const ts = new Date(visible[visIdx].openTime).toLocaleDateString([], { month: 'short', day: 'numeric' });
      newResults.push({ label: m.name, confidence: m.confidence, detail: `${m.direction} · ${ts}` });
    }
    annotations = newAnnotations;
    analysisResults = newResults;
    activeMode = 'candle-patterns';
    runningMode = null;
  }

  async function runSupportResistance(): Promise<void> {
    runningMode = 'support-resistance';
    clearAnalysis();
    await Promise.resolve();
    const levels = findSupportResistance(candles);
    const newAnnotations: ChartAnnotation[] = [];
    const newResults: typeof analysisResults = [];
    for (const lvl of levels) {
      const color = '#a78bfa';
      const label = `S/R ${lvl.price >= 1000 ? lvl.price.toFixed(0) : lvl.price >= 1 ? lvl.price.toFixed(2) : lvl.price.toPrecision(4)}`;
      newAnnotations.push({ type: 'hline', price: lvl.price, color, label, confidence: lvl.confidence });
      newResults.push({ label, confidence: lvl.confidence, detail: `${lvl.touchCount} touches` });
    }
    annotations = newAnnotations;
    analysisResults = newResults;
    activeMode = 'support-resistance';
    runningMode = null;
  }

  async function runIndicatorSignals(): Promise<void> {
    runningMode = 'indicator-signals';
    clearAnalysis();
    await Promise.resolve();
    const displayCount = effectiveDisplayCount;
    const params = { smaFast, smaSlow, emaFast, emaSlow, bbPeriod, bbStdDev, rsiPeriod, macdFast: macdFastP, macdSlow: macdSlowP, macdSignal: macdSignalP };
    const matches = detectIndicatorSignals(candles, displayCount, params);
    const newAnnotations: ChartAnnotation[] = [];
    const newResults: typeof analysisResults = [];
    for (const m of matches) {
      const label = `${m.direction === 'bullish' ? '▲' : '▼'} ${m.signalCount} signals`;
      newAnnotations.push({ type: 'signal-zone', visibleIndex: m.visibleIndex, direction: m.direction, confidence: m.confidence, label });
      newResults.push({ label, confidence: m.confidence, detail: m.signals.join(', ') });
    }
    annotations = newAnnotations;
    analysisResults = newResults;
    activeMode = 'indicator-signals';
    runningMode = null;
  }

  // Clear stale annotations when asset or preset changes
  $: if (selectedAsset || selectedPreset) clearAnalysis();

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
        <button type="button" class="refresh-btn" on:click={refresh} disabled={loading} title="Force refresh">↻</button>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="state-msg">Loading…</div>
  {:else if error}
    <div class="state-msg error">{error}</div>
  {:else}
    <Chart
      asset={selectedAsset}
      overrideCandles={candles}
      overrideDisplayCount={effectiveDisplayCount}
      bind:subPane
      bind:smaFast bind:smaSlow
      bind:emaFast bind:emaSlow
      bind:bbPeriod bind:bbStdDev
      bind:rsiPeriod
      bind:macdFastP bind:macdSlowP bind:macdSignalP
      {annotations}
    />
    {#if candles.length > 0}
      <div class="analysis-panel">
        <div class="analysis-header">
          <span class="analysis-label">Analysis</span>
          <div class="analysis-btns">
            <button
              type="button"
              class="preset-btn"
              class:active={activeMode === 'candle-patterns'}
              disabled={runningMode !== null}
              on:click={runCandlePatterns}
            >{runningMode === 'candle-patterns' ? 'Detecting…' : 'Candle Patterns'}</button>
            <button
              type="button"
              class="preset-btn"
              class:active={activeMode === 'support-resistance'}
              disabled={runningMode !== null}
              on:click={runSupportResistance}
            >{runningMode === 'support-resistance' ? 'Scanning…' : 'Support & Resistance'}</button>
            <button
              type="button"
              class="preset-btn"
              class:active={activeMode === 'indicator-signals'}
              disabled={runningMode !== null}
              on:click={runIndicatorSignals}
            >{runningMode === 'indicator-signals' ? 'Scanning…' : 'Indicator Signals'}</button>
          </div>
        </div>
        {#if analysisResults.length > 0}
          <div class="results-header">
            <span>{analysisResults.length} match{analysisResults.length === 1 ? '' : 'es'}</span>
            <button type="button" class="clear-link" on:click={clearAnalysis}>Clear</button>
          </div>
          <ul class="results-list">
            {#each analysisResults as r}
              <li class="result-item">
                <span class="result-label">{r.label}</span>
                <span class="result-detail">{r.detail}</span>
                <span class="conf-badge" style="background:{confidenceColor(r.confidence)}22;color:{confidenceColor(r.confidence)};border-color:{confidenceColor(r.confidence)}44">{confidenceLabel(r.confidence)} {r.confidence}</span>
              </li>
            {/each}
          </ul>
        {:else if activeMode !== null && runningMode === null}
          <p class="no-results">No matches found.</p>
        {/if}
      </div>
    {/if}
  {/if}
</main>

<style>
  main {
    max-width: var(--view-max-width);
    margin: 0 auto;
    padding: var(--view-padding);
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
  h2 { font-size: 1rem; margin: 0; color: var(--color-text-secondary); }
  .controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .asset-select {
    background: var(--color-surface-1);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    font-size: var(--text-base);
    font-family: inherit;
    padding: 0.2rem 0.5rem;
    cursor: pointer;
  }
  .asset-select:focus { outline: none; border-color: #4c3d8a; }
  .presets { display: flex; gap: 0.3rem; flex-wrap: wrap; }
  .preset-btn {
    font-size: var(--text-sm);
    padding: 0.2rem 0.55rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text-dim);
    cursor: pointer;
    font-family: inherit;
    line-height: 1.4;
  }
  .preset-btn:hover { color: var(--color-text-muted); border-color: #444; }
  .preset-btn.active { background: #1e1e2e; color: #a78bfa; border-color: #4c3d8a; }
  .refresh-btn {
    font-size: 1rem;
    line-height: 1;
    padding: 0.15rem 0.4rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text-faint);
    cursor: pointer;
    font-family: inherit;
  }
  .refresh-btn:hover:not(:disabled) { color: var(--color-text-muted); border-color: #444; }
  .refresh-btn:disabled { opacity: 0.3; cursor: default; }
  @media (max-width: 480px) {
    .presets { flex: 0 0 100%; }
  }
  .state-msg {
    padding: 2rem;
    text-align: center;
    color: var(--color-text-faint);
    font-size: 0.85rem;
  }
  .state-msg.error { color: #f87171; }

  .analysis-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: var(--color-surface-1);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-sm);
    padding: 0.6rem 0.75rem;
  }
  .analysis-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .analysis-label {
    font-size: var(--text-sm);
    color: var(--color-text-dim);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }
  .analysis-btns {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
  }
  @media (max-width: 480px) {
    .analysis-btns { flex: 0 0 100%; }
  }
  .results-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--text-sm);
    color: var(--color-text-dim);
    padding-top: 0.25rem;
    border-top: 1px solid var(--color-border-subtle);
  }
  .clear-link {
    background: none;
    border: none;
    color: var(--color-text-faint);
    font-size: var(--text-sm);
    font-family: inherit;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }
  .clear-link:hover { color: var(--color-text-muted); }
  .results-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 16rem;
    overflow-y: auto;
  }
  .result-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: var(--text-sm);
    flex-wrap: wrap;
  }
  .result-label {
    color: var(--color-text-secondary);
    font-weight: 500;
  }
  .result-detail {
    color: var(--color-text-faint);
    font-size: 0.72rem;
    flex: 1;
  }
  .conf-badge {
    font-size: 0.65rem;
    font-weight: 600;
    padding: 0.1rem 0.35rem;
    border-radius: 99px;
    border: 1px solid;
    white-space: nowrap;
  }
  .no-results {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-faint);
    padding-top: 0.25rem;
    border-top: 1px solid var(--color-border-subtle);
  }
</style>
