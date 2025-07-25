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
	scroll: void;
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
			{#if chunk && isFirstInChunk && isLineHighlighted(index)}
				<div class="current-diff-indicator" style="--chunk-height: {chunk.lines};" title="Current diff"></div>
			{/if}
			{#if chunk && isFirstInChunk}
				<!-- Show chunk arrows only on the first line of the chunk -->
				<div class="chunk-actions" style="--chunk-height: {chunk.lines};">
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
		width: var(--gutter-width);
		overflow-y: auto;
		overflow-x: hidden;
		border-left: 1px solid #9ca0b0;
		border-right: 1px solid #9ca0b0;
		background: #e6e9ef;
		position: relative;
		scrollbar-width: none;
		flex-shrink: 0;
	}

	:global([data-theme="dark"]) .center-gutter {
		background: #1e2030;
		border-left-color: #363a4f;
		border-right-color: #363a4f;
	}

	.center-gutter::-webkit-scrollbar {
		display: none;
	}

	.gutter-content {
		position: relative;
	}

	.gutter-line {
		height: var(--line-height);
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		gap: 2px;
	}

	.gutter-line.chunk-start {
		position: relative;
	}

	/* Chunk actions */
	.chunk-actions {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, calc(-50% + (var(--chunk-height) - 1) * var(--line-height) / 2));
		display: flex;
		gap: 2px;
		align-items: center;
		justify-content: center;
		z-index: 10;
	}

	/* Gutter arrows */
	.gutter-arrow {
		background: #7287fd;
		color: white;
		border: none;
		width: 30px;
		height: 22px;
		font-size: 14px;
		font-weight: bold;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		transition: all 0.2s ease;
		border-radius: 3px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	:global([data-theme="dark"]) .gutter-arrow {
		background: #8aadf4;
		color: #24273a;
	}

	.gutter-arrow:hover {
		background: #8839ef;
		transform: scale(1.1);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
	}

	:global([data-theme="dark"]) .gutter-arrow:hover {
		background: #7dc4e4;
	}

	.gutter-arrow.chunk-arrow {
		height: 24px;
		width: 32px;
		font-size: 16px;
	}

	.gutter-arrow.modified-arrow {
		background: #df8e1d;
	}

	:global([data-theme="dark"]) .gutter-arrow.modified-arrow {
		background: #f9e2af;
		color: #24273a;
	}

	.gutter-arrow.modified-arrow:hover {
		background: #fe640b;
	}

	:global([data-theme="dark"]) .gutter-arrow.modified-arrow:hover {
		background: #fab387;
	}

	/* Current diff indicator */
	.current-diff-indicator {
		position: absolute;
		width: 8px;
		height: 8px;
		background-color: #1e66f5;
		border-radius: 50%;
		left: 4px;
		top: 50%;
		transform: translateY(calc(-50% + (var(--chunk-height) - 1) * var(--line-height) / 2));
		z-index: 20;
		box-shadow: 0 0 4px rgba(30, 102, 245, 0.6);
	}

	:global([data-theme="dark"]) .current-diff-indicator {
		background-color: #8aadf4;
	}
</style>