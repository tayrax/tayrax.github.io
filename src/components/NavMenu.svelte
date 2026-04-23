<!-- Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com> -->
<!-- See LICENSE file. -->
<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';

  export let size: number = 28;
  export let currentView: 'dashboard' | 'logs' | 'system' | 'history' = 'dashboard';

  let open = false;
  let wrapper: HTMLElement;

  const dispatch = createEventDispatcher<{ navigate: 'dashboard' | 'logs' | 'system' | 'history' }>();

  const items: { view: 'dashboard' | 'logs' | 'system' | 'history'; label: string }[] = [
    { view: 'dashboard', label: 'Dashboard' },
    { view: 'history', label: 'History' },
    { view: 'system', label: 'System' },
    { view: 'logs', label: 'Logs' },
  ];

  function toggle(): void {
    open = !open;
  }

  function navigate(view: 'dashboard' | 'logs' | 'system' | 'history'): void {
    dispatch('navigate', view);
    open = false;
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') open = false;
  }

  function handleClickOutside(e: MouseEvent): void {
    if (open && wrapper && !wrapper.contains(e.target as Node)) {
      open = false;
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('click', handleClickOutside);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('click', handleClickOutside);
  });
</script>

<div class="nav-menu" bind:this={wrapper}>
  <button
    class="logo-btn"
    type="button"
    aria-label="Open navigation menu"
    aria-expanded={open}
    on:click={toggle}
  >
    <img src="/tayrax-logo.svg" alt="" width={size} height={size} />
  </button>
  {#if open}
    <ul class="dropdown" role="menu">
      {#each items as item}
        <li role="none" class:active={currentView === item.view}>
          <button role="menuitem" type="button" on:click={() => navigate(item.view)}>{item.label}</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .nav-menu {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
  .logo-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    border-radius: 4px;
  }
  .logo-btn:hover { opacity: 0.8; }
  .dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    z-index: 100;
    list-style: none;
    margin: 0;
    padding: 0.35rem 0;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    min-width: 10rem;
  }
  .dropdown li button {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.45rem 0.9rem 0.45rem 1rem;
    font-size: 0.875rem;
    font: inherit;
    color: #aaa;
    background: none;
    border: none;
    border-left: 2px solid transparent;
    cursor: pointer;
  }
  .dropdown li button:hover { color: #eee; background: #222; }
  .dropdown li.active button {
    color: #eee;
    border-left-color: #2563eb;
    background: #1e2a3a;
  }
</style>
