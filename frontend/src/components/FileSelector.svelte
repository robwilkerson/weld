<script lang="ts">
import { createEventDispatcher } from "svelte";
import { SelectFile } from "../../wailsjs/go/backend/App.js";
// biome-ignore lint/correctness/noUnusedImports: Used in template
import { getFileIcon, getFileTypeName } from "../utils/fileIcons.js";

// biome-ignore-start lint/style/useConst: Svelte component props must use 'let' for reactivity
export let leftFilePath: string = "";
export let rightFilePath: string = "";
export let leftFileName: string = "Select left file...";
export let rightFileName: string = "Select right file...";
export let isDarkMode: boolean = false;
export let isComparing: boolean = false;
export let hasCompletedComparison: boolean = false;
// biome-ignore-end lint/style/useConst: Svelte component props must use 'let' for reactivity

const dispatch = createEventDispatcher();

// biome-ignore lint/correctness/noUnusedVariables: Used in template
async function selectLeftFile(): Promise<void> {
	try {
		const path = await SelectFile();
		if (path) {
			dispatch("leftFileSelected", { path });
		}
	} catch (error) {
		dispatch("error", { message: `Error selecting left file: ${error}` });
	}
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
async function selectRightFile(): Promise<void> {
	try {
		const path = await SelectFile();
		if (path) {
			dispatch("rightFileSelected", { path });
		}
	} catch (error) {
		dispatch("error", { message: `Error selecting right file: ${error}` });
	}
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleCompareClick(): void {
	dispatch("compare");
}
</script>

<div class="file-selectors">
  <button class="file-btn" on:click={selectLeftFile}>
    <span class="file-icon" title={getFileTypeName(leftFileName)}>{@html getFileIcon(leftFileName, isDarkMode)}</span>
    <span class="file-name">{leftFileName}</span>
  </button>
  <button class="file-btn" on:click={selectRightFile}>
    <span class="file-icon" title={getFileTypeName(rightFileName)}>{@html getFileIcon(rightFileName, isDarkMode)}</span>
    <span class="file-name">{rightFileName}</span>
  </button>
  <button class="compare-btn" on:click={handleCompareClick} disabled={!leftFilePath || !rightFilePath || isComparing || hasCompletedComparison}>
    {#if isComparing}
      Comparing...
    {:else}
      Compare
    {/if}
  </button>
  <div class="menu-slot">
    <slot name="menu" />
  </div>
</div>

<style>
  .file-selectors {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.5rem;
    align-items: center;
    width: 100%;
    position: relative;
  }

  .menu-slot {
    margin-left: auto;
    display: flex;
    align-items: center;
  }

  .file-btn {
    display: flex;
    align-items: stretch;
    padding: 0;
    border: 1px solid #acb0be;
    border-radius: 4px;
    background: #dce0e8;
    cursor: pointer;
    font-size: 0.9rem;
    width: auto;
    height: 42px;
    max-width: 350px;
    overflow: hidden;
    transition: background-color 0.2s ease;
    color: #4c4f69;
  }

  .file-btn:hover {
    background: #ccd0da;
  }

  .file-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 0.6rem;
    height: 100%;
    background: transparent;
    border-right: 1px solid #acb0be;
    min-width: 32px;
  }

  .file-btn:hover .file-icon {
    background: transparent;
  }

  .file-icon :global(svg) {
    width: 20px;
    height: 20px;
  }

  .file-name {
    padding: 0 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: flex;
    align-items: center;
    width: 200px;
    font-weight: 500;
  }

  .compare-btn {
    padding: 0 1.5rem;
    border: 1px solid #1e66f5;
    border-radius: 4px;
    background: #1e66f5;
    color: #eff1f5;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    min-width: 120px;
    height: 42px;
    transition: background-color 0.2s ease;
  }

  .compare-btn:hover:not(:disabled) {
    background: #04a5e5;
  }

  .compare-btn:disabled {
    background: #94a3b8;
    border-color: #94a3b8;
    cursor: not-allowed;
    opacity: 0.7;
  }

  /* Dark mode styles */
  :global([data-theme="dark"]) .file-btn {
    background: #363a4f;
    border-color: #5b6078;
    color: #cad3f5;
  }

  :global([data-theme="dark"]) .file-btn:hover {
    background: #414559;
  }

  :global([data-theme="dark"]) .file-icon {
    background: transparent;
    border-right-color: #5b6078;
  }

  :global([data-theme="dark"]) .file-btn:hover .file-icon {
    background: transparent;
  }

  :global([data-theme="dark"]) .compare-btn {
    background: #8aadf4;
    border-color: #8aadf4;
    color: #24273a;
  }

  :global([data-theme="dark"]) .compare-btn:hover:not(:disabled) {
    background: #7dc4e4;
  }

  :global([data-theme="dark"]) .compare-btn:disabled {
    background: #5b6078;
    border-color: #5b6078;
    color: #a5adcb;
    opacity: 0.7;
  }
</style>