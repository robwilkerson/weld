<script lang="ts">
import { createEventDispatcher } from "svelte";
// biome-ignore lint/correctness/noUnusedImports: Used in template
import { getDisplayPath } from "../utils/diff";

// Props
export let leftFilePath: string;
export let rightFilePath: string;
export let hasUnsavedLeftChanges: boolean;
export let hasUnsavedRightChanges: boolean;
export let isFirstLineDiff: boolean;
export let lineNumberWidth: string;

// Event dispatcher
const dispatch = createEventDispatcher<{
	saveLeft: void;
	saveRight: void;
}>();

// Event handlers
// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleSaveLeft(): void {
	dispatch("saveLeft");
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleSaveRight(): void {
	dispatch("saveRight");
}
</script>

<div class="file-header {isFirstLineDiff ? 'first-line-diff' : ''}" style="--line-number-width: {lineNumberWidth}">
	<div class="file-info left">
		<button class="save-btn" disabled={!hasUnsavedLeftChanges} on:click={handleSaveLeft} title="Save changes">📥</button>
		<span class="file-path">{getDisplayPath(leftFilePath, rightFilePath, true)}</span>
	</div>
	<div class="action-gutter-header">
		<!-- Empty header space above action gutter -->
	</div>
	<div class="file-info right">
		<button class="save-btn" disabled={!hasUnsavedRightChanges} on:click={handleSaveRight} title="Save changes">📥</button>
		<span class="file-path">{getDisplayPath(leftFilePath, rightFilePath, false)}</span>
	</div>
</div>

<style>
	.file-header {
		display: flex;
		background: #e6e9ef;
		overflow: hidden;
		min-height: 40px;
		align-items: stretch;
	}

	:global([data-theme="dark"]) .file-header {
		background: #1e2030;
	}

	.file-header.first-line-diff {
		border-bottom: none;
	}

	.file-info {
		flex: 1;
		display: flex;
		align-items: center;
		padding: 0.5rem 1rem;
		min-width: 0;
		border-bottom: 1px solid #9ca0b0;
	}

	:global([data-theme="dark"]) .file-info {
		border-bottom-color: #363a4f;
		color: #cad3f5;
	}

	/* Remove custom padding - let flex: 1 handle equal sizing */

	.save-btn {
		background: #acb0be;
		border: 1px solid #9ca0b0;
		border-radius: 4px;
		padding: 4px 8px;
		margin-right: 8px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	:global([data-theme="dark"]) .save-btn {
		background: #494d64;
		border: 1px solid #5b6078;
	}

	.save-btn:disabled {
		background: #dce0e8;
		border: 1px solid #ccd0da;
		cursor: not-allowed;
		opacity: 0.4;
	}

	:global([data-theme="dark"]) .save-btn:disabled {
		background: #363a4f;
		border: 1px solid #5b6078;
		opacity: 0.4;
	}

	.save-btn:not(:disabled):hover {
		background: #8c8fa1;
		border-color: #6c6f85;
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	:global([data-theme="dark"]) .save-btn:not(:disabled):hover {
		background: #5b6078;
		border-color: #6e738d;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.file-path {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.9rem;
		color: #4c4f69;
		font-family: monospace;
	}

	:global([data-theme="dark"]) .file-path {
		color: #cad3f5;
	}

	.action-gutter-header {
		width: calc(var(--gutter-width) + 8px);
		background: #e6e9ef;
		border-left: 1px solid #9ca0b0;
		border-right: 1px solid #9ca0b0;
		flex-shrink: 0;
		box-sizing: border-box; /* Include borders in width calculation */
	}

	:global([data-theme="dark"]) .action-gutter-header {
		background: #1e2030;
		border-left-color: #363a4f;
		border-right-color: #363a4f;
	}
</style>