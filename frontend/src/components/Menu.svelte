<script lang="ts">
// biome-ignore lint/correctness/noUnusedImports: Used in Svelte reactive statements with $ prefix
import { uiStore } from "../stores/uiStore.js";

// biome-ignore lint/style/useConst: This is a Svelte component prop that needs to be reactive
export let hasAnyUnsavedChanges: boolean = false;
export let onDiscardChanges: () => void;
export let onToggleDarkMode: () => void;
</script>

<div class="menu-container">
  <button class="menu-toggle" on:click={() => uiStore.toggleMenu()} title="Menu">
    ☰
  </button>
  {#if $uiStore.showMenu}
    <div class="dropdown-menu">
      <button class="menu-item" on:click={onToggleDarkMode}>
        {$uiStore.isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
      </button>
      <button 
        class="menu-item" 
        on:click={onDiscardChanges}
        disabled={!hasAnyUnsavedChanges}
      >
        🗑️ Discard Changes
      </button>
    </div>
  {/if}
</div>

<style>
  .menu-container {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 1000;
  }

  .menu-toggle {
    background: none;
    border: 1px solid rgba(108, 111, 133, 0.3);
    cursor: pointer;
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    color: #6c6f85;
    transition: all 0.2s ease;
    font-size: 1.2rem;
    line-height: 1;
  }

  .menu-toggle:hover {
    background: rgba(76, 79, 105, 0.1);
    border-color: rgba(76, 79, 105, 0.5);
    color: #4c4f69;
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.5rem;
    background: #eff1f5;
    border: 1px solid #9ca0b0;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    min-width: 150px;
  }

  .menu-item {
    display: block;
    width: 100%;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s ease;
    color: #4c4f69;
  }

  .menu-item:hover:not(:disabled) {
    background: rgba(76, 79, 105, 0.1);
  }

  .menu-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .menu-item:not(:last-child) {
    border-bottom: 1px solid #9ca0b0;
  }

  /* Dark mode styles */
  :global([data-theme="dark"]) .menu-toggle {
    color: #a5adcb;
    border-color: rgba(165, 173, 203, 0.3);
  }

  :global([data-theme="dark"]) .menu-toggle:hover {
    background: rgba(202, 211, 245, 0.1);
    border-color: rgba(202, 211, 245, 0.5);
    color: #cad3f5;
  }

  :global([data-theme="dark"]) .dropdown-menu {
    background: #24273a;
    border-color: #363a4f;
  }

  :global([data-theme="dark"]) .menu-item {
    color: #cad3f5;
  }

  :global([data-theme="dark"]) .menu-item:hover:not(:disabled) {
    background: rgba(202, 211, 245, 0.1);
  }

  :global([data-theme="dark"]) .menu-item:not(:last-child) {
    border-bottom-color: #363a4f;
  }
</style>