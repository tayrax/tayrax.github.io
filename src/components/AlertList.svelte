<!-- Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com> -->
<!-- See LICENSE file. -->
<script lang="ts">
  import { alerts, removeAlert, type StoredAlert } from '../lib/alerts';
  import { DEFAULT_CHART_INTERVAL, type CandleInterval } from '../lib/config';

  export let selectedInterval: CandleInterval = DEFAULT_CHART_INTERVAL;

  $: visibleAlerts = $alerts.filter((a) => a.interval === selectedInterval);

  const describe = (a: StoredAlert): string => {
    switch (a.kind) {
      case 'above': return `${a.asset} > $${a.value}`;
      case 'below': return `${a.asset} < $${a.value}`;
      case 'range': return `${a.asset} in $${a.low}–$${a.high}`;
      case 'pctChange': return `${a.asset} |Δ| ≥ ${a.value}% /1h`;
      case 'volumeSpike': return `${a.asset} volume ≥ ${a.multiplier}× median /1m`;
      case 'rsiBelow': return `${a.asset} RSI(14) < ${a.value} · ${a.interval}`;
      case 'rsiAbove': return `${a.asset} RSI(14) > ${a.value} · ${a.interval}`;
      case 'macdCross': return `${a.asset} MACD ${a.direction} crossover · ${a.interval}`;
      case 'bbBreakout': return `${a.asset} BB breakout ${a.direction} band · ${a.interval}`;
    }
  };
</script>

{#if visibleAlerts.length === 0}
  <p class="muted">{$alerts.length === 0 ? 'No alerts yet. Add one above.' : `No alerts for ${selectedInterval}.`}</p>
{:else}
  <ul>
    {#each visibleAlerts as a (a.id)}
      <li>
        <span>{describe(a)}</span>
        {#if a.lastFiredAt}
          <small>last fired {new Date(a.lastFiredAt).toLocaleTimeString()}</small>
        {/if}
        <button type="button" on:click={() => removeAlert(a.id)}>remove</button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
  li {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    background: var(--color-surface-1);
    border: 1px solid var(--color-surface-2);
    border-radius: var(--radius-md);
    padding: 0.5rem 0.75rem;
  }
  li span { flex: 1; font-variant-numeric: tabular-nums; }
  small { color: #888; }
  button {
    background: transparent;
    color: #f87171;
    border: 1px solid #3a1f1f;
    border-radius: var(--radius-sm);
    padding: 0.25rem 0.5rem;
    cursor: pointer;
    font: inherit;
  }
  button:hover { background: #2a1414; }
  .muted { color: #777; }
</style>
