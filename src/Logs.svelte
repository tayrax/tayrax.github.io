<!-- Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com> -->
<!-- See LICENSE file.                                    -->
<script lang="ts">
  import { logs, clearLogs, type LogKind, type LogEntry } from './lib/logs';

  const KIND_LABEL: Record<LogKind, string> = {
    alertDispatched: 'alert dispatched',
    tradeProposed: 'trade proposed'
  };

  const ALL_KINDS: readonly LogKind[] = ['alertDispatched', 'tradeProposed'] as const;

  let filter: LogKind | 'all' = 'all';

  $: visible = filter === 'all' ? $logs : $logs.filter((e) => e.kind === filter);

  const formatTs = (ts: number): string => new Date(ts).toLocaleString();

  const formatData = (data: LogEntry['data']): string => {
    if (!data) return '';
    return Object.entries(data)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
  };

  const onClear = (): void => {
    if (typeof window === 'undefined') return;
    const ok = window.confirm('Clear all log entries? This cannot be undone.');
    if (!ok) return;
    clearLogs();
  };
</script>

<main>
  <section>
    <div class="section-header">
      <h2>Action log</h2>
      <div class="controls">
        <label class="filter">
          <span>filter</span>
          <select bind:value={filter}>
            <option value="all">all kinds</option>
            {#each ALL_KINDS as k}
              <option value={k}>{KIND_LABEL[k]}</option>
            {/each}
          </select>
        </label>
        <button type="button" class="btn-clear" on:click={onClear} disabled={$logs.length === 0}>
          Clear logs
        </button>
      </div>
    </div>

    <p class="hint">
      Most recent action at the top. Up to 500 entries are kept; older entries are dropped
      automatically. Logs are stored locally in this browser.
    </p>

    {#if visible.length === 0}
      <div class="empty">
        {#if $logs.length === 0}
          No actions logged yet.
        {:else}
          No entries match the current filter.
        {/if}
      </div>
    {:else}
      <ul class="log-list">
        {#each visible as entry (entry.id)}
          <li class="log-row">
            {#if entry.data}
              <details>
                <summary class="log-main">
                  <span class="ts">{formatTs(entry.ts)}</span>
                  <span class="kind-badge kind-{entry.kind}">{KIND_LABEL[entry.kind]}</span>
                  {#if entry.kind === 'tradeProposed' && entry.data?.interval}
                    <span class="interval-badge">{entry.data.interval}</span>
                  {/if}
                  {#if entry.kind === 'tradeProposed' && entry.data?.direction === 'buy'}
                    <span class="direction-badge direction-buy">buy</span>
                  {:else if entry.kind === 'tradeProposed' && entry.data?.direction === 'sell'}
                    <span class="direction-badge direction-sell">sell</span>
                  {/if}
                  {#if entry.asset}
                    <span class="asset">{entry.asset}</span>
                  {/if}
                  <span class="msg">{entry.message}</span>
                </summary>
                <div class="log-data">{formatData(entry.data)}</div>
              </details>
            {:else}
              <div class="log-main">
                <span class="ts">{formatTs(entry.ts)}</span>
                <span class="kind-badge kind-{entry.kind}">{KIND_LABEL[entry.kind]}</span>
                {#if entry.asset}
                  <span class="asset">{entry.asset}</span>
                {/if}
                <span class="msg">{entry.message}</span>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</main>

<style>
  main {
    max-width: 960px;
    margin: 0 auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  section { display: flex; flex-direction: column; gap: 0.75rem; }

  h2 {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #666;
    margin: 0;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .controls { display: flex; align-items: center; gap: 0.75rem; }
  .filter { display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; color: #888; }
  .filter select {
    background: #161616;
    color: #ccc;
    border: 1px solid #2a2a2a;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font: inherit;
    font-size: 0.82rem;
  }

  .btn-clear {
    background: #2d1a1a;
    color: #f87171;
    border: 1px solid #3a1f1f;
    border-radius: 5px;
    padding: 0.3rem 0.75rem;
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .btn-clear:hover:not(:disabled) { background: #3a1f1f; color: #fca5a5; }
  .btn-clear:disabled { opacity: 0.4; cursor: default; }

  .hint { font-size: 0.82rem; color: #555; margin: 0; line-height: 1.6; }

  .empty {
    padding: 2rem 1rem;
    text-align: center;
    color: #666;
    background: #161616;
    border: 1px dashed #222;
    border-radius: 6px;
    font-size: 0.9rem;
  }

  .log-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .log-row {
    padding: 0.55rem 0.9rem;
    background: #161616;
    border: 1px solid #222;
    border-radius: 5px;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  details { width: 100%; }
  details > summary { list-style: none; cursor: pointer; }
  details > summary::-webkit-details-marker { display: none; }
  details[open] { border-color: #333; }
  details[open] .log-data { margin-top: 0.25rem; }
  .log-row:has(details):hover { border-color: #333; background: #1a1a1a; }

  .log-main,
  details > summary.log-main {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    font-size: 0.85rem;
  }

  .ts {
    color: #666;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.78rem;
    white-space: nowrap;
  }

  .kind-badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    font-size: 0.72rem;
    background: #2a2a2a;
    color: #aaa;
    white-space: nowrap;
  }
  .kind-alertDispatched { background: #1e3a5f; color: #93c5fd; }
  .kind-tradeProposed { background: #2d2200; color: #fbbf24; }

  .interval-badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    font-size: 0.72rem;
    background: #2a2a2a;
    color: #ccc;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-weight: 600;
    white-space: nowrap;
  }

  .direction-badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    white-space: nowrap;
  }
  .direction-buy { background: #0f2e1d; color: #4ade80; }
  .direction-sell { background: #2d1a1a; color: #f87171; }

  .asset {
    color: #ccc;
    font-weight: 600;
    font-size: 0.82rem;
  }

  .msg { color: #bbb; flex: 1; min-width: 12rem; }

  .log-data {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.72rem;
    color: #555;
    padding-left: 0.25rem;
  }
</style>
