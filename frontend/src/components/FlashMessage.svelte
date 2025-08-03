<script lang="ts">
// biome-ignore lint/correctness/noUnusedImports: Used in Svelte template
import { fade } from "svelte/transition";
import errorIcon from "../assets/message-icons/error.svg?raw";
import infoIcon from "../assets/message-icons/info.svg?raw";
import warningIcon from "../assets/message-icons/warning.svg?raw";
import { uiStore } from "../stores/uiStore.js";

export let message: string = "";
export let type: "error" | "warning" | "info" = "info";

// biome-ignore lint/correctness/noUnusedVariables: Used in Svelte template
let visible = false;

$: if (message) {
	visible = true;
}

// Make icon reactive - recompute when type changes
$: icon = (() => {
	switch (type) {
		case "error":
			return errorIcon;
		case "warning":
			return warningIcon;
		case "info":
			return infoIcon;
		default:
			return infoIcon;
	}
})();

// biome-ignore lint/correctness/noUnusedVariables: Used in Svelte template
function dismiss() {
	visible = false;
	uiStore.clearFlash();
}

// biome-ignore lint/correctness/noUnusedVariables: Used in Svelte template
function isHtmlIcon(icon: string): boolean {
	return icon.startsWith("<");
}
</script>

{#if visible && message}
  <div 
    class="flash-message flash-{type}"
    transition:fade={{ duration: 200 }}
    role="alert"
  >
    <span class="flash-icon">
      {#if isHtmlIcon(icon)}
        {@html icon}
      {:else}
        {icon}
      {/if}
    </span>
    <span class="flash-text">{message}</span>
    <button class="flash-dismiss" on:click={dismiss} aria-label="Dismiss">
      ×
    </button>
  </div>
{/if}

<style>
  .flash-message {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
    gap: 0.75rem;
    border-width: 1px;
    border-style: solid;
    border-left-width: 4px;
    position: relative;
    animation: slideDown 0.3s ease-out;
  }

  @keyframes slideDown {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .flash-icon {
    font-size: 1.6rem;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.8rem;
    height: 1.8rem;
  }
  
  .flash-icon :global(svg) {
    width: 100%;
    height: 100%;
  }

  .flash-text {
    flex: 1;
    font-weight: 500;
  }

  .flash-dismiss {
    background: none;
    border: none;
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    padding: 0;
    margin-left: 0.5rem;
    color: inherit;
    opacity: 0.8;
    transition: opacity 0.2s;
  }

  .flash-dismiss:hover {
    opacity: 1;
  }

  /* Error style */
  .flash-error {
    background: #ffd6d6;
    color: rgb(26, 26, 26);
    border-color: #e52d2d;
  }

  .flash-error .flash-icon {
    color: #e52d2d;
  }
  
  .flash-error .flash-text {
    color: rgb(26, 26, 26);
    font-weight: 500;
  }
  
  .flash-error .flash-dismiss {
    color: rgb(26, 26, 26);
  }

  /* Warning style */
  .flash-warning {
    background: rgb(255, 253, 230);
    color: rgb(26, 26, 26);
    border-color: rgb(254, 221, 0);
  }

  .flash-warning .flash-icon {
    color: rgb(254, 221, 0);
  }
  
  .flash-warning .flash-text {
    color: rgb(26, 26, 26);
    font-weight: 500;
  }
  
  .flash-warning .flash-dismiss {
    color: rgb(26, 26, 26);
  }

  /* Info style */
  .flash-info {
    background: rgb(135, 168, 220);
    color: rgb(26, 26, 26);
    border-color: rgb(15, 82, 185);
  }

  .flash-info .flash-icon {
    color: rgb(15, 82, 185);
  }
  
  .flash-info .flash-text {
    color: rgb(26, 26, 26);
    font-weight: 500;
  }
  
  .flash-info .flash-dismiss {
    color: rgb(26, 26, 26);
  }

  /* Dark mode styles */
  :global([data-theme="dark"]) .flash-error {
    background: #ffd6d6;
    color: rgb(26, 26, 26);
    border-color: #e52d2d;
  }

  :global([data-theme="dark"]) .flash-error .flash-icon {
    color: #e52d2d;
  }
  
  :global([data-theme="dark"]) .flash-error .flash-text {
    color: rgb(26, 26, 26);
  }
  
  :global([data-theme="dark"]) .flash-error .flash-dismiss {
    color: rgb(26, 26, 26);
  }

  :global([data-theme="dark"]) .flash-warning {
    background: rgb(255, 253, 230);
    color: rgb(26, 26, 26);
    border-color: rgb(254, 221, 0);
  }

  :global([data-theme="dark"]) .flash-warning .flash-icon {
    color: rgb(254, 221, 0);
  }
  
  :global([data-theme="dark"]) .flash-warning .flash-text {
    color: rgb(26, 26, 26);
  }
  
  :global([data-theme="dark"]) .flash-warning .flash-dismiss {
    color: rgb(26, 26, 26);
  }

  :global([data-theme="dark"]) .flash-info {
    background: #9fbce2;
    color: rgb(26, 26, 26);
    border-color: rgb(15, 82, 185);
  }

  :global([data-theme="dark"]) .flash-info .flash-icon {
    color: rgb(15, 82, 185);
  }
  
  :global([data-theme="dark"]) .flash-info .flash-text {
    color: rgb(26, 26, 26);
  }
  
  :global([data-theme="dark"]) .flash-info .flash-dismiss {
    color: rgb(26, 26, 26);
  }

  :global([data-theme="dark"]) .flash-dismiss {
    color: #cad3f5;
  }
</style>