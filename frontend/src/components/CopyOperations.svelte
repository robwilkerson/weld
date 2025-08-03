<script lang="ts">
import { createEventDispatcher } from "svelte";
import type { HighlightedDiffLine, LineChunk } from "../types/diff";

// Props
export let line: HighlightedDiffLine;
export let index: number;
export let chunk: LineChunk | null;
export let diffChunk: LineChunk | null;
export let isFirstInDiffChunk: boolean;
export let isFirstOfConsecutiveModified: boolean;
export let currentDiffChunkIndex: number;
export let diffChunks: LineChunk[];

// Event dispatcher
// biome-ignore lint/correctness/noUnusedVariables: Used in template event handlers
const dispatch = createEventDispatcher<{
	copyLineToLeft: number;
	copyLineToRight: number;
	copyChunkToLeft: LineChunk;
	copyChunkToRight: LineChunk;
	copyModifiedChunkToLeft: LineChunk;
	copyModifiedChunkToRight: LineChunk;
	deleteChunkFromLeft: LineChunk;
	deleteChunkFromRight: LineChunk;
}>();
</script>

{#if diffChunk && isFirstInDiffChunk && line.type !== 'same'}
	<!-- Show chunk arrows only on the first line of the diff chunk -->
	<div class="chunk-actions" style="--chunk-height: {diffChunk.endIndex - diffChunk.startIndex + 1};">
		{#if currentDiffChunkIndex !== -1 && diffChunks[currentDiffChunkIndex] && diffChunk.startIndex === diffChunks[currentDiffChunkIndex].startIndex}
			<div class="current-diff-indicator" title="Current diff"></div>
		{/if}
		{#if line.type === 'added'}
			<button class="gutter-arrow left-side-arrow chunk-arrow" on:click={() => dispatch('deleteChunkFromRight', chunk)} title="Delete chunk from right ({diffChunk.endIndex - diffChunk.startIndex + 1} lines)">
				→
			</button>
			<button class="gutter-arrow right-side-arrow chunk-arrow" on:click={() => dispatch('copyChunkToLeft', chunk)} title="Copy chunk to left ({diffChunk.endIndex - diffChunk.startIndex + 1} lines)">
				←
			</button>
		{:else if line.type === 'removed'}
			<button class="gutter-arrow left-side-arrow chunk-arrow" on:click={() => dispatch('copyChunkToRight', chunk)} title="Copy chunk to right ({diffChunk.endIndex - diffChunk.startIndex + 1} lines)">
				→
			</button>
			<button class="gutter-arrow right-side-arrow chunk-arrow" on:click={() => dispatch('deleteChunkFromLeft', chunk)} title="Delete chunk from left ({diffChunk.endIndex - diffChunk.startIndex + 1} lines)">
				←
			</button>
		{:else if line.type === 'modified'}
			<button class="gutter-arrow left-side-arrow chunk-arrow modified-arrow" on:click={() => dispatch('copyModifiedChunkToRight', chunk)} title="Copy left version to right ({diffChunk.endIndex - diffChunk.startIndex + 1} lines)">
				→
			</button>
			<button class="gutter-arrow right-side-arrow chunk-arrow modified-arrow" on:click={() => dispatch('copyModifiedChunkToLeft', chunk)} title="Copy right version to left ({diffChunk.endIndex - diffChunk.startIndex + 1} lines)">
				←
			</button>
		{/if}
	</div>
{:else if line.type === 'modified' && isFirstOfConsecutiveModified}
	<!-- Show arrows only on the first of consecutive modified lines -->
	<div class="line-actions">
		<button class="gutter-arrow left-side-arrow" on:click={() => dispatch('copyLineToRight', index)} title="Copy left to right">
			→
		</button>
		<button class="gutter-arrow right-side-arrow" on:click={() => dispatch('copyLineToLeft', index)} title="Copy right to left">
			←
		</button>
	</div>
{:else if !chunk && line.type === 'same' && line.leftLine && line.rightLine && line.leftLine !== line.rightLine}
	<!-- Backend marked as 'same' but content actually differs -->
	<div class="line-actions">
		<button class="gutter-arrow left-side-arrow" on:click={() => dispatch('copyLineToRight', index)} title="Copy left to right">
			→
		</button>
		<button class="gutter-arrow right-side-arrow" on:click={() => dispatch('copyLineToLeft', index)} title="Copy right to left">
			←
		</button>
	</div>
{/if}

<style>
	/* Chunk actions container */
	.chunk-actions {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		position: absolute;
		width: 100%;
		left: 0;
		padding: 0 4px;
		top: 0;
		height: calc(var(--chunk-height) * var(--line-height));
		z-index: 10;
		box-sizing: border-box;
	}

	/* Gutter arrows */
	.gutter-arrow {
		background: transparent !important;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		padding: 0;
		margin: 0;
		height: 18px;
		width: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		font-size: 12px;
		font-weight: 600;
		color: #7287fd !important; /* Catppuccin Latte Lavender */
		transition: all 0.15s ease-in-out;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		position: relative;
		z-index: 1;
		outline: none;
	}

	.gutter-arrow:hover {
		background: rgba(114, 135, 253, 0.1) !important;
		transform: scale(1.1);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	:global([data-theme="dark"]) .gutter-arrow {
		background: transparent !important;
		color: #8aadf4 !important; /* Catppuccin Macchiato Blue */
	}

	:global([data-theme="dark"]) .gutter-arrow:hover {
		background: rgba(138, 173, 244, 0.1) !important;
		transform: scale(1.1);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	.gutter-arrow.chunk-arrow {
		height: 22px;
		width: 22px;
		font-size: 14px;
	}

	/* Current diff indicator */
	.current-diff-indicator {
		position: absolute;
		width: 6px;
		height: 6px;
		background-color: #1e66f5;
		border-radius: 50%;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		z-index: 20;
		box-shadow: 
			0 0 0 1px rgba(255, 255, 255, 0.3),
			0 0 8px rgba(30, 102, 245, 0.8),
			0 0 12px rgba(30, 102, 245, 0.6),
			0 0 16px rgba(30, 102, 245, 0.4);
		animation: pulse-glow 2s ease-in-out infinite;
	}

	@keyframes pulse-glow {
		0%, 100% {
			box-shadow: 
				0 0 0 1px rgba(255, 255, 255, 0.3),
				0 0 8px rgba(30, 102, 245, 0.8),
				0 0 12px rgba(30, 102, 245, 0.6),
				0 0 16px rgba(30, 102, 245, 0.4);
		}
		50% {
			box-shadow: 
				0 0 0 1px rgba(255, 255, 255, 0.5),
				0 0 10px rgba(30, 102, 245, 1),
				0 0 16px rgba(30, 102, 245, 0.8),
				0 0 20px rgba(30, 102, 245, 0.6);
		}
	}


	:global([data-theme="dark"]) .current-diff-indicator {
		background-color: #8aadf4;
		box-shadow: 
			0 0 0 1px rgba(0, 0, 0, 0.3),
			0 0 8px rgba(138, 173, 244, 0.8),
			0 0 12px rgba(138, 173, 244, 0.6),
			0 0 16px rgba(138, 173, 244, 0.4);
		animation: pulse-glow-dark 2s ease-in-out infinite;
	}

	@keyframes pulse-glow-dark {
		0%, 100% {
			box-shadow: 
				0 0 0 1px rgba(0, 0, 0, 0.3),
				0 0 8px rgba(138, 173, 244, 0.8),
				0 0 12px rgba(138, 173, 244, 0.6),
				0 0 16px rgba(138, 173, 244, 0.4);
		}
		50% {
			box-shadow: 
				0 0 0 1px rgba(0, 0, 0, 0.5),
				0 0 10px rgba(138, 173, 244, 1),
				0 0 16px rgba(138, 173, 244, 0.8),
				0 0 20px rgba(138, 173, 244, 0.6);
		}
	}

	/* Line actions container for single-line modifications */
	.line-actions {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0 4px;
		box-sizing: border-box;
	}
</style>