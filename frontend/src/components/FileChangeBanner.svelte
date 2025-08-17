<script lang="ts">
import { createEventDispatcher } from "svelte";
// biome-ignore lint/correctness/noUnusedImports: Used in template with {@html}
import warningIcon from "../assets/info-icons/warning.svg?raw";

// biome-ignore lint/style/useConst: Svelte component props must use 'let'
export let visible = false;
// biome-ignore lint/style/useConst: Svelte component props must use 'let'
export let fileName = "";
// biome-ignore lint/style/useConst: Svelte component props must use 'let'
export let filePath = "";

const dispatch = createEventDispatcher<{
	reload: undefined;
	hide: undefined;
}>();

// biome-ignore lint/correctness/noUnusedVariables: Used in Svelte template
function handleReload() {
	dispatch("reload");
}

// biome-ignore lint/correctness/noUnusedVariables: Used in Svelte template
function handleHide() {
	dispatch("hide");
}
</script>

{#if visible}
	<div class="file-change-banner">
		<div class="banner-content">
			<div class="icon">
				{@html warningIcon}
			</div>
			<div class="message">
				<div class="message-line"><strong>File {fileName} has changed on disk</strong></div>
				<div class="message-line question">Do you want to reload the file?</div>
			</div>
			<div class="actions">
				<button type="button" class="reload-btn" on:click={handleReload}>
					Reload
				</button>
				<button type="button" class="hide-btn" on:click={handleHide}>
					Ignore
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.file-change-banner {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		background: #f9e2af;
		border-bottom: 1px solid #f5c99b;
		z-index: 100;
		animation: slideDown 0.3s ease-out;
	}

	@keyframes slideDown {
		from {
			transform: translateY(-100%);
		}
		to {
			transform: translateY(0);
		}
	}

	.banner-content {
		display: flex;
		align-items: center;
		padding: 8px 16px;
		gap: 12px;
		justify-content: flex-start;
	}

	.icon {
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		color: #df8e1d;
	}

	.icon :global(svg) {
		width: 100%;
		height: 100%;
	}

	.message {
		flex: 1;
		color: #40310a;
		font-size: 13px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2px;
		text-align: left;
	}

	.message-line {
		line-height: 1.3;
	}

	.message strong {
		font-weight: 600;
	}

	.question {
		color: #5c4813;
		font-size: 12px;
	}

	.actions {
		display: flex;
		gap: 8px;
		flex-shrink: 0;
	}

	button {
		padding: 4px 12px;
		border-radius: 4px;
		font-size: 12px;
		cursor: pointer;
		transition: all 0.2s;
		border: 1px solid transparent;
	}

	.reload-btn {
		background: #df8e1d;
		color: white;
		border-color: #df8e1d;
	}

	.reload-btn:hover {
		background: #c77c0a;
		border-color: #c77c0a;
	}

	.hide-btn {
		background: transparent;
		color: #5c4813;
		border-color: #f5c99b;
	}

	.hide-btn:hover {
		background: #f5c99b;
	}

	/* Dark mode */
	:global([data-theme="dark"]) .file-change-banner {
		background: #665c54;
		border-bottom-color: #504945;
	}

	:global([data-theme="dark"]) .icon {
		color: #fabd2f;
	}

	:global([data-theme="dark"]) .message {
		color: #fbf1c7;
	}

	:global([data-theme="dark"]) .question {
		color: #ebdbb2;
	}

	:global([data-theme="dark"]) .reload-btn {
		background: #fabd2f;
		color: #282828;
		border-color: #fabd2f;
	}

	:global([data-theme="dark"]) .reload-btn:hover {
		background: #f9b915;
		border-color: #f9b915;
	}

	:global([data-theme="dark"]) .hide-btn {
		color: #ebdbb2;
		border-color: #504945;
	}

	:global([data-theme="dark"]) .hide-btn:hover {
		background: #504945;
	}
</style>