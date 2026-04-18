<!-- Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com> -->
<!-- See LICENSE file. -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  export let size: number = 28;

  let open = false;
  let current = '/';
  let wrapper: HTMLElement;

  const items: { path: string; label: string }[] = [
    { path: '/', label: 'Dashboard' },
    { path: '/system/', label: 'System' },
    { path: '/logs/', label: 'Logs' },
  ];

  function toggle(): void {
    open = !open;
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
    current = window.location.pathname;
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
        <li role="none" class:active={current === item.path}>
          <a role="menuitem" href={item.path}>{item.label}</a>
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
  .dropdown li a {
    display: block;
    padding: 0.45rem 0.9rem 0.45rem 1rem;
    font-size: 0.875rem;
    color: #aaa;
    text-decoration: none;
    border-left: 2px solid transparent;
  }
  .dropdown li a:hover { color: #eee; background: #222; }
  .dropdown li.active a {
    color: #eee;
    border-left-color: #2563eb;
    background: #1e2a3a;
  }
</style>
