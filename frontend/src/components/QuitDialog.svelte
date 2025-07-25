<script lang="ts">
import { createEventDispatcher } from "svelte";
// biome-ignore lint/correctness/noUnusedImports: Used in template
import { getDisplayFileName } from "../utils/path.js";

// biome-ignore-start lint/style/useConst: Svelte component props must use 'let' for reactivity
export let show: boolean = false;
export let quitDialogFiles: string[] = [];
export let leftFilePath: string = "";
export let rightFilePath: string = "";
export let fileSelections: Record<string, boolean> = {};
// biome-ignore-end lint/style/useConst: Svelte component props must use 'let' for reactivity

const dispatch = createEventDispatcher();

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleSaveAndQuit() {
	dispatch("saveAndQuit");
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleQuitWithoutSaving() {
	dispatch("quitWithoutSaving");
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleCancel() {
	dispatch("cancel");
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleOverlayClick() {
	dispatch("cancel");
}
</script>

{#if show}
  <div class="modal-overlay" on:click={handleOverlayClick}>
    <div class="quit-dialog" on:click|stopPropagation>
      <h3>Unsaved Changes</h3>
      <p>Select which files to save before quitting:</p>
      
      <div class="file-list">
        {#if leftFilePath}
          <label class="file-item">
            <input 
              type="checkbox" 
              bind:checked={fileSelections[leftFilePath]}
              disabled={!quitDialogFiles.includes(leftFilePath)}
            />
            <span class="file-name">{getDisplayFileName(leftFilePath)}</span>
            {#if !quitDialogFiles.includes(leftFilePath)}
              <span class="file-status">(no changes)</span>
            {/if}
          </label>
        {/if}
        
        {#if rightFilePath && rightFilePath !== leftFilePath}
          <label class="file-item">
            <input 
              type="checkbox" 
              bind:checked={fileSelections[rightFilePath]}
              disabled={!quitDialogFiles.includes(rightFilePath)}
            />
            <span class="file-name">{getDisplayFileName(rightFilePath)}</span>
            {#if !quitDialogFiles.includes(rightFilePath)}
              <span class="file-status">(no changes)</span>
            {/if}
          </label>
        {/if}
      </div>
      
      <div class="dialog-buttons">
        <button class="btn-primary" on:click={handleSaveAndQuit}>
          Save Selected & Quit
        </button>
        <button class="btn-secondary" on:click={handleQuitWithoutSaving}>
          Quit Without Saving
        </button>
        <button class="btn-tertiary" on:click={handleCancel}>
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .quit-dialog {
    background: #ffffff;
    border-radius: 8px;
    padding: 24px;
    min-width: 400px;
    max-width: 500px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  .quit-dialog h3 {
    margin: 0 0 16px 0;
    font-size: 18px;
    font-weight: 600;
  }

  .quit-dialog p {
    margin: 0 0 20px 0;
    color: #6c7086;
  }

  .file-list {
    margin-bottom: 24px;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    cursor: pointer;
  }

  .file-item input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .file-item input[type="checkbox"]:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .file-name {
    font-weight: 500;
  }

  .file-status {
    color: #6c7086;
    font-size: 14px;
    font-style: italic;
  }

  .button-group,
  .dialog-buttons {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .button-group button,
  .dialog-buttons button {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
  }

  .btn-primary {
    background: #1e66f5;
    color: white;
  }

  .btn-primary:hover {
    background: #1952c7;
  }

  .btn-secondary {
    background: #dc2626;
    color: white;
  }

  .btn-secondary:hover {
    background: #b91c1c;
  }

  .btn-tertiary {
    background: #e4e4e7;
    color: #52525b;
  }

  .btn-tertiary:hover {
    background: #d4d4d8;
  }

  /* Dark mode styles */
  :global([data-theme="dark"]) .quit-dialog {
    background: #363a4f;
    color: #cad3f5;
  }

  :global([data-theme="dark"]) .quit-dialog p {
    color: #a5adcb;
  }

  :global([data-theme="dark"]) .file-status {
    color: #8087a2;
  }

  :global([data-theme="dark"]) .btn-primary {
    background: #8aadf4;
    color: #24273a;
  }

  :global([data-theme="dark"]) .btn-primary:hover {
    background: #7dc4e4;
  }

  :global([data-theme="dark"]) .btn-secondary {
    background: #ed8796;
    color: #24273a;
  }

  :global([data-theme="dark"]) .btn-secondary:hover {
    background: #e57a89;
  }

  :global([data-theme="dark"]) .btn-tertiary {
    background: #494d64;
    color: #cad3f5;
  }

  :global([data-theme="dark"]) .btn-tertiary:hover {
    background: #5b6078;
  }
</style>