<!-- Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com> -->
<!-- See LICENSE file. -->
<script lang="ts">
  import { SUPPORTED_ASSETS, MANDATORY_ASSET, MAX_ENABLED_ASSETS } from '../lib/config';
  import type { AssetId } from '../lib/config';
  import { enabledAssets, toggleAsset } from '../lib/enabled-assets';

  let query = '';

  $: atLimit = $enabledAssets.length >= MAX_ENABLED_ASSETS;

  $: suggestions = query.trim() === '' || atLimit
    ? []
    : SUPPORTED_ASSETS.filter(
        (a) => a !== MANDATORY_ASSET &&
          !$enabledAssets.includes(a) &&
          a.includes(query.trim().toLowerCase())
      );

  function add(asset: AssetId): void {
    if (atLimit) return;
    toggleAsset(asset);
    query = '';
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && suggestions.length > 0) {
      add(suggestions[0]);
    }
  }
</script>

<div class="coin-selector">
  <div class="chips">
    <span class="chip locked" title="bitcoin is always enabled">
      {MANDATORY_ASSET}
      <span class="lock-icon">⊘</span>
    </span>
    {#each $enabledAssets.filter((a) => a !== MANDATORY_ASSET) as asset}
      <button
        type="button"
        class="chip removable"
        title="Remove {asset}"
        on:click={() => toggleAsset(asset)}
      >
        {asset}
        <span class="remove-icon" aria-hidden="true">×</span>
      </button>
    {/each}
  </div>

  {#if atLimit}
    <p class="limit-msg">Max {MAX_ENABLED_ASSETS} coins enabled. Remove one to add another.</p>
  {:else}
    <div class="search-row">
      <input
        type="text"
        class="search-input"
        placeholder="Add coin…"
        bind:value={query}
        on:keydown={handleKeydown}
        autocomplete="off"
        spellcheck="false"
      />
      {#if suggestions.length > 0}
        <ul class="suggestions" role="listbox">
          {#each suggestions as asset}
            <li role="option" aria-selected="false">
              <button type="button" on:click={() => add(asset)}>{asset}</button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>

<style>
  .coin-selector {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--color-surface-1);
    border: 1px solid var(--color-surface-2);
    border-radius: var(--radius-md);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: var(--text-base);
    padding: 0.2rem 0.55rem;
    border-radius: var(--radius-pill);
    white-space: nowrap;
  }

  .chip.locked {
    background: #1f1f1f;
    border: 1px solid var(--color-border);
    color: var(--color-text-faint);
    cursor: default;
  }

  .lock-icon {
    font-size: 0.7rem;
    color: #444;
  }

  .chip.removable {
    background: #1e2a3a;
    border: 1px solid #2a4060;
    color: #7eb8f7;
    cursor: pointer;
    font: inherit;
  }

  .chip.removable:hover {
    background: #2a1a1a;
    border-color: #603030;
    color: #f87171;
  }

  .remove-icon {
    font-size: 0.85rem;
    line-height: 1;
  }

  .limit-msg {
    margin: 0;
    font-size: var(--text-base);
    color: var(--color-text-dim);
  }

  .search-row {
    position: relative;
  }

  .search-input {
    width: 100%;
    background: #111;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 0.35rem 0.65rem;
    font: inherit;
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    box-sizing: border-box;
    outline: none;
  }

  .search-input:focus {
    border-color: #2563eb;
  }

  .search-input::placeholder {
    color: #444;
  }

  .suggestions {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--color-surface-1);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    margin: 0;
    padding: 0.25rem 0;
    list-style: none;
    z-index: 10;
    max-height: 220px;
    overflow-y: auto;
  }

  .suggestions li button {
    display: block;
    width: 100%;
    background: none;
    border: none;
    padding: 0.35rem 0.75rem;
    text-align: left;
    font: inherit;
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .suggestions li button:hover {
    background: var(--color-surface-2);
    color: #fff;
  }
</style>
