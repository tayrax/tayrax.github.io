<!-- Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com> -->
<!-- See LICENSE file. -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { candleStores } from '../lib/candles';
  import { CANDLE_INTERVALS, DEFAULT_CHART_INTERVAL, type CandleInterval } from '../lib/config';
  import { sma, ema, rsi, macd, bollingerBands } from '../lib/indicators';
  import type { OHLCVCandle, CandleMap } from '../lib/candles';

  export let asset: string;
  export let selectedInterval: CandleInterval = DEFAULT_CHART_INTERVAL;

  let candleMaps: Record<CandleInterval, CandleMap> = Object.fromEntries(
    CANDLE_INTERVALS.map((iv) => [iv, {}])
  ) as Record<CandleInterval, CandleMap>;

  const _unsubs = CANDLE_INTERVALS.map((iv) =>
    candleStores[iv].subscribe((map) => { candleMaps = { ...candleMaps, [iv]: map }; })
  );
  onDestroy(() => _unsubs.forEach((u) => u()));

  // Number of candles to display in the visible window
  const VISIBLE = 60;
  // Height split: main chart and sub-pane
  const MAIN_H = 200;
  const SUB_H = 80;
  const PADDING = { top: 10, right: 8, bottom: 20, left: 60 };
  const SUB_PAD_TOP = 10;
  const SUB_PAD_BOTTOM = 16;

  type SubPane = 'rsi' | 'macd';
  let subPane: SubPane = 'rsi';

  // --- indicator parameters (user-configurable) ---
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

  let showSettings = false;

  $: assetCandles = candleMaps[selectedInterval][asset] ?? [];
  $: visible = assetCandles.slice(-VISIBLE);

  // --- price scale helpers ---
  $: priceMin = visible.length
    ? visible.reduce((m, c) => Math.min(m, c.low), Infinity)
    : 0;
  $: priceMax = visible.length
    ? visible.reduce((m, c) => Math.max(m, c.high), -Infinity)
    : 1;
  $: priceRange = priceMax - priceMin || 1;

  // Chart inner dimensions
  $: innerW = 640 - PADDING.left - PADDING.right;
  $: innerH = MAIN_H - PADDING.top - PADDING.bottom;

  const py = (price: number, min: number, range: number, h: number): number =>
    h - ((price - min) / range) * h;

  // Candle x/width
  $: candleW = visible.length ? Math.max(2, Math.floor(innerW / visible.length) - 1) : 8;
  $: candleX = (i: number): number =>
    PADDING.left + Math.floor((i / (visible.length || 1)) * innerW) + Math.floor(candleW / 4);

  // --- overlays ---
  // SMA/EMA computed over the full history, projected onto visible window
  $: sma20vals = computeLineOverlay(assetCandles, (s) => sma(s, smaFast));
  $: sma50vals = computeLineOverlay(assetCandles, (s) => sma(s, smaSlow));
  $: emaFastVals = computeLineOverlay(assetCandles, (s) => ema(s, emaFast));
  $: emaSlowVals = computeLineOverlay(assetCandles, (s) => ema(s, emaSlow));

  function computeLineOverlay(
    all: OHLCVCandle[],
    fn: (s: OHLCVCandle[]) => number | null
  ): (number | null)[] {
    const result: (number | null)[] = [];
    const start = Math.max(0, all.length - VISIBLE);
    for (let i = start; i < all.length; i++) {
      result.push(fn(all.slice(0, i + 1)));
    }
    return result;
  }

  function linePoints(
    vals: (number | null)[],
    min: number,
    range: number,
    h: number
  ): string {
    const pts: string[] = [];
    vals.forEach((v, i) => {
      if (v === null) return;
      const x = candleX(i) + Math.floor(candleW / 2);
      const y = PADDING.top + py(v, min, range, h);
      pts.push(`${x},${y}`);
    });
    return pts.join(' ');
  }

  // Bollinger band area path (upper → right → lower → left)
  $: bbUpperVals = computeLineOverlay(assetCandles, (s) => {
    const b = bollingerBands(s, bbPeriod, bbStdDev);
    return b ? b.upper : null;
  });
  $: bbLowerVals = computeLineOverlay(assetCandles, (s) => {
    const b = bollingerBands(s, bbPeriod, bbStdDev);
    return b ? b.lower : null;
  });

  function bbAreaPath(
    upper: (number | null)[],
    lower: (number | null)[],
    min: number,
    range: number,
    h: number
  ): string {
    const pairs: Array<{ x: number; u: number; l: number }> = [];
    for (let i = 0; i < upper.length; i++) {
      if (upper[i] === null || lower[i] === null) continue;
      pairs.push({
        x: candleX(i) + Math.floor(candleW / 2),
        u: PADDING.top + py(upper[i]!, min, range, h),
        l: PADDING.top + py(lower[i]!, min, range, h)
      });
    }
    if (pairs.length < 2) return '';
    const top = pairs.map((p) => `${p.x},${p.u}`).join(' L ');
    const bot = pairs
      .slice()
      .reverse()
      .map((p) => `${p.x},${p.l}`)
      .join(' L ');
    return `M ${top} L ${bot} Z`;
  }

  // --- price axis ticks ---
  function priceTicks(min: number, max: number, count = 4): number[] {
    const step = (max - min) / count;
    return Array.from({ length: count + 1 }, (_, i) => min + i * step);
  }

  // --- sub-pane: RSI ---
  $: rsiVal = rsi(assetCandles, rsiPeriod);
  $: rsiVals = computeLineOverlay(assetCandles, (s) => rsi(s, rsiPeriod));

  function rsiLinePoints(vals: (number | null)[]): string {
    const pts: string[] = [];
    const h = SUB_H - SUB_PAD_TOP - SUB_PAD_BOTTOM;
    vals.forEach((v, i) => {
      if (v === null) return;
      const x = candleX(i) + Math.floor(candleW / 2);
      const y = MAIN_H + SUB_PAD_TOP + ((100 - v) / 100) * h;
      pts.push(`${x},${y}`);
    });
    return pts.join(' ');
  }

  // --- sub-pane: MACD ---
  $: macdResult = macd(assetCandles, macdFastP, macdSlowP, macdSignalP);
  type MACDPoint = { macd: number | null; signal: number | null; histogram: number | null };
  $: macdVals = (() => {
    const result: MACDPoint[] = [];
    const start = Math.max(0, assetCandles.length - VISIBLE);
    for (let i = start; i < assetCandles.length; i++) {
      const m = macd(assetCandles.slice(0, i + 1), macdFastP, macdSlowP, macdSignalP);
      result.push({
        macd: m ? m.macd : null,
        signal: m ? m.signal : null,
        histogram: m ? m.histogram : null
      });
    }
    return result;
  })();

  $: macdMin = macdVals.reduce((m, p) => {
    const v = p.histogram ?? p.macd;
    return v !== null ? Math.min(m, v) : m;
  }, 0);
  $: macdMax = macdVals.reduce((m, p) => {
    const v = p.histogram ?? p.macd;
    return v !== null ? Math.max(m, v) : m;
  }, 0);
  $: macdRange = Math.max(Math.abs(macdMin), Math.abs(macdMax)) * 2 || 1;

  function macdY(v: number): number {
    const h = SUB_H - SUB_PAD_TOP - SUB_PAD_BOTTOM;
    return MAIN_H + SUB_PAD_TOP + h / 2 - (v / macdRange) * h;
  }

  function macdLinePoints(vals: MACDPoint[], key: 'macd' | 'signal'): string {
    const pts: string[] = [];
    vals.forEach((p, i) => {
      const v = p[key];
      if (v === null) return;
      const x = candleX(i) + Math.floor(candleW / 2);
      pts.push(`${x},${macdY(v)}`);
    });
    return pts.join(' ');
  }

  // --- price format ---
  const fmt = (n: number): string =>
    n >= 100 ? n.toFixed(2) : n >= 1 ? n.toFixed(4) : n.toPrecision(4);
</script>

<div class="chart-wrap">
  <div class="chart-header">
    <span class="asset-label">{asset}</span>
    <div class="controls">
      <div class="ctrl-row">
        {#each CANDLE_INTERVALS as iv}
          <button
            class="pane-btn"
            class:active={selectedInterval === iv}
            on:click={() => (selectedInterval = iv)}
            type="button"
          >{iv}</button>
        {/each}
      </div>
      <span class="sep desktop-sep"></span>
      <div class="ctrl-row">
        <button
          class="pane-btn"
          class:active={subPane === 'rsi'}
          on:click={() => (subPane = 'rsi')}
          type="button"
        >RSI{rsiVal !== null ? ` ${rsiVal.toFixed(0)}` : ''}</button>
        <button
          class="pane-btn"
          class:active={subPane === 'macd'}
          on:click={() => (subPane = 'macd')}
          type="button"
        >MACD</button>
        <span class="sep"></span>
        <button
          class="pane-btn"
          class:active={showSettings}
          on:click={() => (showSettings = !showSettings)}
          type="button"
          title="Indicator settings"
        >⚙</button>
      </div>
    </div>
  </div>

  {#if showSettings}
    <div class="settings-panel">
      <fieldset class="settings-group">
        <legend>SMA</legend>
        <label>Fast <input type="number" bind:value={smaFast} min="2" max="500" /></label>
        <label>Slow <input type="number" bind:value={smaSlow} min="2" max="500" /></label>
      </fieldset>
      <fieldset class="settings-group">
        <legend>EMA</legend>
        <label>Fast <input type="number" bind:value={emaFast} min="2" max="500" /></label>
        <label>Slow <input type="number" bind:value={emaSlow} min="2" max="500" /></label>
      </fieldset>
      <fieldset class="settings-group">
        <legend>BB</legend>
        <label>Period <input type="number" bind:value={bbPeriod} min="2" max="500" /></label>
        <label>StdDev <input type="number" bind:value={bbStdDev} min="0.5" max="5" step="0.5" /></label>
      </fieldset>
      <fieldset class="settings-group">
        <legend>RSI</legend>
        <label>Period <input type="number" bind:value={rsiPeriod} min="2" max="100" /></label>
      </fieldset>
      <fieldset class="settings-group">
        <legend>MACD</legend>
        <label>Fast <input type="number" bind:value={macdFastP} min="2" max="100" /></label>
        <label>Slow <input type="number" bind:value={macdSlowP} min="2" max="200" /></label>
        <label>Signal <input type="number" bind:value={macdSignalP} min="2" max="50" /></label>
      </fieldset>
    </div>
  {/if}

  {#if visible.length === 0}
    <div class="empty">Waiting for candle data…</div>
  {:else}
    <svg
      width="100%"
      viewBox="0 0 640 {MAIN_H + SUB_H}"
      preserveAspectRatio="xMidYMid meet"
      aria-label="{asset} price chart"
      role="img"
    >
      <!-- Main chart background -->
      <rect x={PADDING.left} y={PADDING.top} width={innerW} height={innerH} fill="#111" />

      <!-- Price axis ticks -->
      {#each priceTicks(priceMin, priceMax) as tick}
        {@const ty = PADDING.top + py(tick, priceMin, priceRange, innerH)}
        <line x1={PADDING.left} y1={ty} x2={PADDING.left + innerW} y2={ty} stroke="#222" stroke-width="1" />
        <text x={PADDING.left - 4} y={ty + 4} text-anchor="end" fill="#666" font-size="10">{fmt(tick)}</text>
      {/each}

      <!-- Bollinger Bands fill -->
      {#if bbUpperVals.some((v) => v !== null)}
        <path
          d={bbAreaPath(bbUpperVals, bbLowerVals, priceMin, priceRange, innerH)}
          fill="rgba(99,102,241,0.08)"
          stroke="none"
        />
        <polyline
          points={linePoints(bbUpperVals, priceMin, priceRange, innerH)}
          fill="none"
          stroke="#6366f1"
          stroke-width="1"
          opacity="0.5"
        />
        <polyline
          points={linePoints(bbLowerVals, priceMin, priceRange, innerH)}
          fill="none"
          stroke="#6366f1"
          stroke-width="1"
          opacity="0.5"
        />
      {/if}

      <!-- SMA fast -->
      {#if sma20vals.some((v) => v !== null)}
        <polyline
          points={linePoints(sma20vals, priceMin, priceRange, innerH)}
          fill="none"
          stroke="#f59e0b"
          stroke-width="1.5"
        />
      {/if}

      <!-- SMA slow -->
      {#if sma50vals.some((v) => v !== null)}
        <polyline
          points={linePoints(sma50vals, priceMin, priceRange, innerH)}
          fill="none"
          stroke="#22d3ee"
          stroke-width="1.5"
        />
      {/if}

      <!-- EMA fast -->
      {#if emaFastVals.some((v) => v !== null)}
        <polyline
          points={linePoints(emaFastVals, priceMin, priceRange, innerH)}
          fill="none"
          stroke="#f472b6"
          stroke-width="1.5"
          stroke-dasharray="4,2"
        />
      {/if}

      <!-- EMA slow -->
      {#if emaSlowVals.some((v) => v !== null)}
        <polyline
          points={linePoints(emaSlowVals, priceMin, priceRange, innerH)}
          fill="none"
          stroke="#34d399"
          stroke-width="1.5"
          stroke-dasharray="4,2"
        />
      {/if}

      <!-- Candlesticks -->
      {#each visible as candle, i}
        {@const x = candleX(i)}
        {@const cx = x + Math.floor(candleW / 2)}
        {@const bodyTop = PADDING.top + py(Math.max(candle.open, candle.close), priceMin, priceRange, innerH)}
        {@const bodyBot = PADDING.top + py(Math.min(candle.open, candle.close), priceMin, priceRange, innerH)}
        {@const bodyH = Math.max(1, bodyBot - bodyTop)}
        {@const wickTop = PADDING.top + py(candle.high, priceMin, priceRange, innerH)}
        {@const wickBot = PADDING.top + py(candle.low, priceMin, priceRange, innerH)}
        {@const bull = candle.close >= candle.open}
        <!-- Wick -->
        <line x1={cx} y1={wickTop} x2={cx} y2={wickBot} stroke={bull ? '#4ade80' : '#f87171'} stroke-width="1" />
        <!-- Body -->
        <rect
          x={x}
          y={bodyTop}
          width={candleW}
          height={bodyH}
          fill={bull ? '#4ade80' : '#f87171'}
        />
      {/each}

      <!-- Legend -->
      <g transform="translate({PADDING.left + 4}, {PADDING.top + 14})">
        <rect width="10" height="2" y="-1" fill="#f59e0b" />
        <text x="14" y="4" fill="#f59e0b" font-size="9">SMA{smaFast}</text>
        <rect x="54" width="10" height="2" y="-1" fill="#22d3ee" />
        <text x="68" y="4" fill="#22d3ee" font-size="9">SMA{smaSlow}</text>
        <rect x="108" width="10" height="2" y="-1" fill="#6366f1" />
        <text x="122" y="4" fill="#6366f1" font-size="9">BB{bbPeriod}</text>
        <rect x="148" width="10" height="2" y="-1" fill="#f472b6" stroke-dasharray="4,2" />
        <text x="162" y="4" fill="#f472b6" font-size="9">EMA{emaFast}</text>
        <rect x="202" width="10" height="2" y="-1" fill="#34d399" />
        <text x="216" y="4" fill="#34d399" font-size="9">EMA{emaSlow}</text>
      </g>

      <!-- Sub-pane divider -->
      <line x1={PADDING.left} y1={MAIN_H} x2={PADDING.left + innerW} y2={MAIN_H} stroke="#333" stroke-width="1" />

      <!-- Sub-pane background -->
      <rect x={PADDING.left} y={MAIN_H} width={innerW} height={SUB_H} fill="#0d0d0d" />

      {#if subPane === 'rsi'}
        <!-- RSI sub-pane -->
        {@const rsiH = SUB_H - SUB_PAD_TOP - SUB_PAD_BOTTOM}
        {@const y70 = MAIN_H + SUB_PAD_TOP + ((100 - 70) / 100) * rsiH}
        {@const y50 = MAIN_H + SUB_PAD_TOP + ((100 - 50) / 100) * rsiH}
        {@const y30 = MAIN_H + SUB_PAD_TOP + ((100 - 30) / 100) * rsiH}
        <line x1={PADDING.left} y1={y70} x2={PADDING.left + innerW} y2={y70} stroke="#f87171" stroke-width="1" stroke-dasharray="3,3" opacity="0.4" />
        <line x1={PADDING.left} y1={y50} x2={PADDING.left + innerW} y2={y50} stroke="#444" stroke-width="1" />
        <line x1={PADDING.left} y1={y30} x2={PADDING.left + innerW} y2={y30} stroke="#4ade80" stroke-width="1" stroke-dasharray="3,3" opacity="0.4" />
        <text x={PADDING.left - 4} y={y70 + 4} text-anchor="end" fill="#666" font-size="9">70</text>
        <text x={PADDING.left - 4} y={y30 + 4} text-anchor="end" fill="#666" font-size="9">30</text>
        <text x={PADDING.left + 2} y={MAIN_H + SUB_PAD_TOP + 8} fill="#888" font-size="9">RSI({rsiPeriod})</text>
        {#if rsiVals.some((v) => v !== null)}
          <polyline
            points={rsiLinePoints(rsiVals)}
            fill="none"
            stroke="#a78bfa"
            stroke-width="1.5"
          />
        {/if}
        {#if rsiVal !== null}
          {@const color = rsiVal >= 70 ? '#f87171' : rsiVal <= 30 ? '#4ade80' : '#a78bfa'}
          <text
            x={PADDING.left + innerW - 2}
            y={MAIN_H + SUB_PAD_TOP + 8}
            text-anchor="end"
            fill={color}
            font-size="9"
            font-weight="600"
          >{rsiVal.toFixed(1)}</text>
        {/if}
      {:else}
        <!-- MACD sub-pane -->
        {@const midY = MAIN_H + SUB_PAD_TOP + (SUB_H - SUB_PAD_TOP - SUB_PAD_BOTTOM) / 2}
        <line x1={PADDING.left} y1={midY} x2={PADDING.left + innerW} y2={midY} stroke="#333" stroke-width="1" />
        <text x={PADDING.left + 2} y={MAIN_H + SUB_PAD_TOP + 8} fill="#888" font-size="9">MACD({macdFastP},{macdSlowP},{macdSignalP})</text>
        <!-- Histogram bars -->
        {#each macdVals as p, i}
          {#if p.histogram !== null}
            {@const x = candleX(i)}
            {@const barTop = Math.min(macdY(p.histogram), midY)}
            {@const barBot = Math.max(macdY(p.histogram), midY)}
            {@const barH = Math.max(1, barBot - barTop)}
            <rect
              x={x}
              y={barTop}
              width={candleW}
              height={barH}
              fill={p.histogram >= 0 ? 'rgba(74,222,128,0.5)' : 'rgba(248,113,113,0.5)'}
            />
          {/if}
        {/each}
        <!-- MACD and signal lines -->
        {#if macdVals.some((p) => p.macd !== null)}
          <polyline
            points={macdLinePoints(macdVals, 'macd')}
            fill="none"
            stroke="#38bdf8"
            stroke-width="1.5"
          />
        {/if}
        {#if macdVals.some((p) => p.signal !== null)}
          <polyline
            points={macdLinePoints(macdVals, 'signal')}
            fill="none"
            stroke="#f97316"
            stroke-width="1.5"
          />
        {/if}
        <!-- Current MACD value -->
        {#if macdResult !== null}
          <text
            x={PADDING.left + innerW - 2}
            y={MAIN_H + SUB_PAD_TOP + 8}
            text-anchor="end"
            fill={macdResult.histogram >= 0 ? '#4ade80' : '#f87171'}
            font-size="9"
            font-weight="600"
          >{macdResult.histogram >= 0 ? '+' : ''}{macdResult.histogram.toFixed(4)}</text>
        {/if}
      {/if}

      <!-- Time axis: first and last candle time -->
      {#if visible.length > 0}
        {@const firstTime = new Date(visible[0].openTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        {@const lastTime = new Date(visible[visible.length - 1].closeTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        <text x={PADDING.left} y={MAIN_H + SUB_H - 2} fill="#555" font-size="9">{firstTime}</text>
        <text x={PADDING.left + innerW} y={MAIN_H + SUB_H - 2} text-anchor="end" fill="#555" font-size="9">{lastTime}</text>
      {/if}
    </svg>
  {/if}
</div>

<style>
  .chart-wrap {
    background: #111;
    border: 1px solid #222;
    border-radius: 8px;
    overflow: hidden;
  }
  .chart-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #1a1a1a;
  }
  .asset-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #888;
    font-weight: 600;
  }
  .controls { display: flex; gap: 0.3rem; align-items: center; }
  .ctrl-row { display: flex; gap: 0.3rem; align-items: center; }
  .sep { width: 1px; height: 1rem; background: #333; margin: 0 0.15rem; }

  @media (max-width: 480px) {
    .chart-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.4rem;
      padding-bottom: 0.6rem;
    }
    .controls {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.3rem;
    }
    .desktop-sep { display: none; }
    .settings-group {
      flex: 0 0 100%;
      box-sizing: border-box;
      flex-wrap: wrap;
      row-gap: 0.35rem;
    }
    .settings-group input[type='number'] {
      width: 2.5rem;
    }
  }
  .pane-btn {
    font-size: 0.7rem;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    border: 1px solid #333;
    background: transparent;
    color: #666;
    cursor: pointer;
    font-family: inherit;
    line-height: 1.4;
  }
  .pane-btn:hover { color: #aaa; border-color: #444; }
  .pane-btn.active { background: #1e1e2e; color: #a78bfa; border-color: #4c3d8a; }
  .empty {
    padding: 2rem;
    text-align: center;
    color: #555;
    font-size: 0.85rem;
  }
  svg { display: block; width: 100%; }

  .settings-panel {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #1a1a1a;
    background: #0d0d0d;
  }
  .settings-group {
    border: 1px solid #2a2a2a;
    border-radius: 4px;
    padding: 0.25rem 0.5rem 0.35rem;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin: 0;
  }
  .settings-group legend {
    font-size: 0.65rem;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0 0.2rem;
  }
  .settings-group label {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.68rem;
    color: #888;
  }
  .settings-group input[type='number'] {
    width: 3.5rem;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 3px;
    color: #ccc;
    font-size: 0.68rem;
    font-family: inherit;
    padding: 0.1rem 0.3rem;
    text-align: right;
  }
  .settings-group input[type='number']:focus {
    outline: none;
    border-color: #4c3d8a;
    color: #fff;
  }
</style>
