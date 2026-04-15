<!-- Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com> -->
<!-- See LICENSE file. -->
<script lang="ts">
  import { SUPPORTED_ASSETS, MANDATORY_ASSET } from '../lib/config';
  import { enabledAssets, toggleAsset } from '../lib/enabled-assets';
</script>

<div class="coin-selector">
  {#each SUPPORTED_ASSETS as asset}
    <label class="coin-row" class:mandatory={asset === MANDATORY_ASSET}>
      <input
        type="checkbox"
        checked={$enabledAssets.includes(asset)}
        disabled={asset === MANDATORY_ASSET}
        on:change={() => toggleAsset(asset)}
      />
      <span class="coin-name">{asset}</span>
      {#if asset === MANDATORY_ASSET}
        <span class="lock">always on</span>
      {/if}
    </label>
  {/each}
</div>

<style>
  .coin-selector {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.25rem;
    padding: 0.75rem 1rem;
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    border-radius: 6px;
  }
  .coin-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: #ccc;
    cursor: pointer;
    user-select: none;
  }
  .coin-row.mandatory {
    color: #666;
    cursor: default;
  }
  .coin-row input[type='checkbox'] {
    accent-color: #2563eb;
    cursor: pointer;
    width: 14px;
    height: 14px;
  }
  .coin-row.mandatory input[type='checkbox'] {
    cursor: default;
  }
  .lock {
    font-size: 0.7rem;
    color: #555;
    font-style: italic;
  }
</style>
