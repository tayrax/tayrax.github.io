<script lang="ts">
  import { MONITORED_ASSETS } from '../lib/config';
  import { addAlert, type AlertKind } from '../lib/alerts';

  let asset: string = MONITORED_ASSETS[0];
  let kind: AlertKind = 'above';
  let value = '';
  let low = '';
  let high = '';
  let multiplier = '';
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
      <option value="above">price above</option>
      <option value="below">price below</option>
      <option value="range">price in range</option>
      <option value="pctChange">% change /1h</option>
      <option value="volumeSpike">volume spike /1m</option>
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
