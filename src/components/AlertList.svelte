<script lang="ts">
  import { alerts, removeAlert, type StoredAlert } from '../lib/alerts';

  const describe = (a: StoredAlert): string => {
    switch (a.kind) {
      case 'above': return `${a.asset} > $${a.value}`;
      case 'below': return `${a.asset} < $${a.value}`;
      case 'range': return `${a.asset} in $${a.low}–$${a.high}`;
      case 'pctChange': return `${a.asset} |Δ| ≥ ${a.value}% /1h`;
    }
  };
</script>

{#if $alerts.length === 0}
  <p class="muted">No alerts yet. Add one above.</p>
{:else}
  <ul>
    {#each $alerts as a (a.id)}
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
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
  }
  li span { flex: 1; font-variant-numeric: tabular-nums; }
  small { color: #888; }
  button {
    background: transparent;
    color: #f87171;
    border: 1px solid #3a1f1f;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
    font: inherit;
  }
  button:hover { background: #2a1414; }
  .muted { color: #777; }
</style>
