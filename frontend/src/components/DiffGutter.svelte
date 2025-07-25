<script lang="ts">
import { createEventDispatcher } from "svelte";
import type { HighlightedDiffLine, LineChunk } from "../types/diff";

// Props
export let lines: HighlightedDiffLine[];
export let currentDiffChunkIndex: number;
export let diffChunks: LineChunk[];

// Functions passed from parent
export let getChunkForLine: (lineIndex: number) => LineChunk | null;
export let isFirstLineOfChunk: (lineIndex: number, chunk: LineChunk) => boolean;
export let isLineHighlighted: (lineIndex: number) => boolean;
export let isFirstOfConsecutiveModified: (index: number) => boolean;

// Element ref
let gutterElement: HTMLElement;

// Event dispatcher
const dispatch = createEventDispatcher<{
	scroll: undefined;
	copyLineToLeft: number;
	copyLineToRight: number;
	copyChunkToLeft: LineChunk;
	copyChunkToRight: LineChunk;
	copyModifiedChunkToLeft: LineChunk;
	copyModifiedChunkToRight: LineChunk;
	deleteChunkFromLeft: LineChunk;
	deleteChunkFromRight: LineChunk;
}>();

// Event handlers
// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleScroll(): void {
	dispatch("scroll");
}

// Export element for parent to control scroll
export function getElement(): HTMLElement {
	return gutterElement;
}

// Scroll control from parent
export function setScrollTop(scrollTop: number): void {
	if (gutterElement) {
		gutterElement.scrollTop = scrollTop;
	}
}
</script>

<div class="center-gutter" bind:this={gutterElement} on:scroll={handleScroll}>
	<div class="gutter-content" style="height: calc({lines.length} * var(--line-height));">
		{#each lines as line, index}
			{@const chunk = getChunkForLine(index)}
			{@const isFirstInChunk = chunk ? isFirstLineOfChunk(index, chunk) : false}
			{@const isLastInChunk = chunk ? index === chunk.endIndex : false}
			
			<div class="gutter-line {chunk && isFirstInChunk ? 'chunk-start' : ''} {chunk && isLastInChunk ? 'chunk-end' : ''} {isLineHighlighted(index) ? 'current-diff-line' : ''}">
			{#if chunk && isFirstInChunk}
				<!-- Show chunk arrows only on the first line of the chunk -->
				<div class="chunk-actions" style="--chunk-height: {chunk.lines};">
					{#if isLineHighlighted(index)}
						<div class="current-diff-indicator" title="Current diff"></div>
					{/if}
					{#if chunk.type === 'added'}
						<button class="gutter-arrow left-side-arrow chunk-arrow" on:click={() => dispatch('deleteChunkFromRight', chunk)} title="Delete chunk from right ({chunk.lines} lines)">
							→
						</button>
						<button class="gutter-arrow right-side-arrow chunk-arrow" on:click={() => dispatch('copyChunkToLeft', chunk)} title="Copy chunk to left ({chunk.lines} lines)">
							←
						</button>
					{:else if chunk.type === 'removed'}
						<button class="gutter-arrow left-side-arrow chunk-arrow" on:click={() => dispatch('copyChunkToRight', chunk)} title="Copy chunk to right ({chunk.lines} lines)">
							→
						</button>
						<button class="gutter-arrow right-side-arrow chunk-arrow" on:click={() => dispatch('deleteChunkFromLeft', chunk)} title="Delete chunk from left ({chunk.lines} lines)">
							←
						</button>
					{:else if chunk.type === 'modified'}
						<button class="gutter-arrow left-side-arrow chunk-arrow modified-arrow" on:click={() => dispatch('copyModifiedChunkToRight', chunk)} title="Copy left version to right ({chunk.lines} lines)">
							→
						</button>
						<button class="gutter-arrow right-side-arrow chunk-arrow modified-arrow" on:click={() => dispatch('copyModifiedChunkToLeft', chunk)} title="Copy right version to left ({chunk.lines} lines)">
							←
						</button>
					{/if}
				</div>
			{:else if line.type === 'modified' && isFirstOfConsecutiveModified(index)}
				<!-- Show arrows only on the first of consecutive modified lines -->
				<button class="gutter-arrow left-side-arrow" on:click={() => dispatch('copyLineToRight', index)} title="Copy left to right">
					→
				</button>
				<button class="gutter-arrow right-side-arrow" on:click={() => dispatch('copyLineToLeft', index)} title="Copy right to left">
					←
				</button>
			{:else if !chunk && line.type === 'same' && line.leftLine && line.rightLine && line.leftLine !== line.rightLine}
				<!-- Backend marked as 'same' but content actually differs -->
				<button class="gutter-arrow left-side-arrow" on:click={() => dispatch('copyLineToRight', index)} title="Copy left to right">
					→
				</button>
				<button class="gutter-arrow right-side-arrow" on:click={() => dispatch('copyLineToLeft', index)} title="Copy right to left">
					←
				</button>
			{/if}
			<!-- Invisible content to match line structure -->
			<span style="visibility: hidden; font-size: var(--font-size);">​</span>
		</div>
		{/each}
	</div>
</div>

<style>
	.center-gutter {
		width: calc(var(--gutter-width) + 8px);
		overflow-y: auto;
		overflow-x: hidden;
		border-left: 1px solid #9ca0b0;
		border-right: 1px solid #9ca0b0;
		background: #e6e9ef;
		position: relative;
		scrollbar-width: none;
		flex-shrink: 0;
		box-sizing: border-box;
		/* Match pane height by accounting for scrollbar-gutter */
		padding-bottom: 8px;
	}

	:global([data-theme="dark"]) .center-gutter {
		background: #1e2030;
		border-left-color: #363a4f;
		border-right-color: #363a4f;
	}

	/* Hide scrollbar for gutter - it should only scroll via the panes */
	.center-gutter::-webkit-scrollbar {
		display: none;
	}
	
	.center-gutter {
		-ms-overflow-style: none;  /* IE and Edge */
		scrollbar-width: none;  /* Firefox */
	}

	.gutter-content {
		position: relative;
	}

	.gutter-line {
		height: var(--line-height);
		display: flex;
		align-items: center;
		justify-content: space-between;
		position: relative;
		padding: 0 4px 0 4px;
	}

	.gutter-line.chunk-start {
		position: relative;
	}

	/* Chunk actions */
	.chunk-actions {
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		transform: translateY(calc(-50% + (var(--chunk-height) - 1) * var(--line-height) / 2));
		display: flex;
		align-items: center;
		justify-content: space-between;
		z-index: 10;
		padding: 0 4px;
	}

	/* Gutter arrows */
	.gutter-arrow {
		background: transparent !important;
		border: none;
		border-radius: 4px;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-size: 12px;
		font-weight: bold;
		transition: all 0.2s ease;
		box-shadow: none;
		padding: 0;
		line-height: 1;
		color: #7287fd !important; /* Catppuccin Latte Blue */
		-webkit-appearance: none;
		appearance: none;
		outline: none;
	}

	.gutter-arrow:hover {
		background: rgba(114, 135, 253, 0.1) !important;
		transform: scale(1.1);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	:global([data-theme="dark"]) .center-gutter .gutter-arrow {
		background: transparent !important;
		color: #8aadf4 !important; /* Catppuccin Macchiato Blue */
	}

	:global([data-theme="dark"]) .center-gutter .gutter-arrow:hover {
		background: rgba(138, 173, 244, 0.1) !important;
		transform: scale(1.1);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}


	.gutter-arrow.chunk-arrow {
		height: 22px;
		width: 22px;
		font-size: 14px;
	}

	/* Modified arrows use the same color as other arrows */

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
</style>