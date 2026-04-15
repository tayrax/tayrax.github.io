<!-- Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com> -->
<!-- See LICENSE file. -->
<script lang="ts">
  import { MONITORED_ASSETS } from '../lib/config';
  import { addAlert, type AlertKind } from '../lib/alerts';

  let asset: string = MONITORED_ASSETS[0];
  let kind: AlertKind = 'above';
  let value = '';
  let low = '';
  let high = '';
  let multiplier = '';
  let macdDirection: 'bullish' | 'bearish' = 'bullish';
  let bbDirection: 'above' | 'below' = 'above';
  let error = '';

  const reset = (): void => {
    value = '';
    low = '';
    high = '';
    multiplier = '';
    error = '';
  };

  const submit = (): void => {
    error = '';
    if (kind === 'range') {
      const l = Number(low);
      const h = Number(high);
      if (!Number.isFinite(l) || !Number.isFinite(h) || l >= h) {
        error = 'Provide low < high';
        return;
      }
      addAlert({ asset, kind: 'range', low: l, high: h });
    } else if (kind === 'volumeSpike') {
      const m = Number(multiplier);
      if (!Number.isFinite(m) || m <= 1) {
        error = 'Multiplier must be > 1';
        return;
      }
      addAlert({ asset, kind: 'volumeSpike', multiplier: m });
    } else if (kind === 'rsiBelow') {
      const v = Number(value);
      if (!Number.isFinite(v) || v <= 0 || v >= 100) {
        error = 'RSI threshold must be 1–99';
        return;
      }
      addAlert({ asset, kind: 'rsiBelow', value: v });
    } else if (kind === 'rsiAbove') {
      const v = Number(value);
      if (!Number.isFinite(v) || v <= 0 || v >= 100) {
        error = 'RSI threshold must be 1–99';
        return;
      }
      addAlert({ asset, kind: 'rsiAbove', value: v });
    } else if (kind === 'macdCross') {
      addAlert({ asset, kind: 'macdCross', direction: macdDirection });
    } else if (kind === 'bbBreakout') {
      addAlert({ asset, kind: 'bbBreakout', direction: bbDirection });
    } else {
      const v = Number(value);
      if (!Number.isFinite(v)) {
        error = 'Enter a number';
        return;
      }
      if (kind === 'above') addAlert({ asset, kind: 'above', value: v });
      else if (kind === 'below') addAlert({ asset, kind: 'below', value: v });
      else addAlert({ asset, kind: 'pctChange', value: v });
    }
    reset();
  };
</script>

<form on:submit|preventDefault={submit}>
  <label>
    Asset
    <select bind:value={asset}>
      {#each MONITORED_ASSETS as a}
        <option value={a}>{a}</option>
      {/each}
    </select>
  </label>
  <label>
    Rule
    <select bind:value={kind}>
      <optgroup label="Price">
        <option value="above">price above</option>
        <option value="below">price below</option>
        <option value="range">price in range</option>
        <option value="pctChange">% change /1h</option>
        <option value="volumeSpike">volume spike /1m</option>
      </optgroup>
      <optgroup label="Indicators">
        <option value="rsiBelow">RSI below (oversold)</option>
        <option value="rsiAbove">RSI above (overbought)</option>
        <option value="macdCross">MACD crossover</option>
        <option value="bbBreakout">Bollinger Band breakout</option>
      </optgroup>
    </select>
  </label>
  {#if kind === 'range'}
    <label>Low <input type="number" step="any" bind:value={low} required /></label>
    <label>High <input type="number" step="any" bind:value={high} required /></label>
  {:else if kind === 'volumeSpike'}
    <label>
      Multiplier (×)
      <input type="number" step="any" min="1" bind:value={multiplier} required />
    </label>
  {:else if kind === 'rsiBelow' || kind === 'rsiAbove'}
    <label>
      RSI threshold
      <input type="number" step="1" min="1" max="99" bind:value={value} required placeholder={kind === 'rsiBelow' ? '30' : '70'} />
    </label>
  {:else if kind === 'macdCross'}
    <label>
      Direction
      <select bind:value={macdDirection}>
        <option value="bullish">bullish (MACD crosses above signal)</option>
        <option value="bearish">bearish (MACD crosses below signal)</option>
      </select>
    </label>
  {:else if kind === 'bbBreakout'}
    <label>
      Direction
      <select bind:value={bbDirection}>
        <option value="above">above upper band</option>
        <option value="below">below lower band</option>
      </select>
    </label>
  {:else}
    <label>
      {kind === 'pctChange' ? '%' : 'Price'}
      <input type="number" step="any" bind:value={value} required />
    </label>
  {/if}
  <button type="submit">Add alert</button>
  {#if error}<span class="err">{error}</span>{/if}
</form>

<style>
  form {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: end;
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    border-radius: 8px;
    padding: 1rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8rem;
    color: #aaa;
  }
  input, select {
    background: #111;
    color: #eee;
    border: 1px solid #333;
    border-radius: 4px;
    padding: 0.4rem 0.5rem;
    font: inherit;
  }
  button {
    background: #2563eb;
    color: white;
    border: 0;
    border-radius: 4px;
    padding: 0.5rem 0.9rem;
    font: inherit;
    cursor: pointer;
  }
  button:hover { background: #1d4ed8; }
  .err { color: #f87171; font-size: 0.85rem; }
</style>
