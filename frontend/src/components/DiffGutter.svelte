<script lang="ts">
import { createEventDispatcher } from "svelte";
import type { HighlightedDiffLine, LineChunk } from "../types/diff";
// biome-ignore lint/correctness/noUnusedImports: Used in template
import CopyOperations from "./CopyOperations.svelte";

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

export function setScrollLeft(scrollLeft: number): void {
	if (gutterElement) {
		gutterElement.scrollLeft = scrollLeft;
	}
}
</script>

<div class="center-gutter" bind:this={gutterElement} on:scroll={handleScroll}>
	<div class="gutter-content" style="height: calc({lines.length} * var(--line-height));">
		{#each lines as line, index}
			{@const chunk = getChunkForLine(index)}
			{@const diffChunk = diffChunks.find(c => index >= c.startIndex && index <= c.endIndex)}
			{@const isFirstInDiffChunk = diffChunk && index === diffChunk.startIndex}
			{@const isLastInChunk = chunk ? index === chunk.endIndex : false}
			
			<div class="gutter-line {chunk && isFirstLineOfChunk(index, chunk) ? 'chunk-start' : ''} {chunk && isLastInChunk ? 'chunk-end' : ''} {isLineHighlighted(index) ? 'current-diff-line' : ''}">
				<CopyOperations
					{line}
					{index}
					{chunk}
					{diffChunk}
					{isFirstInDiffChunk}
					isFirstOfConsecutiveModified={isFirstOfConsecutiveModified(index)}
					{currentDiffChunkIndex}
					{diffChunks}
					on:copyLineToLeft={(e) => dispatch('copyLineToLeft', e.detail)}
					on:copyLineToRight={(e) => dispatch('copyLineToRight', e.detail)}
					on:copyChunkToLeft={(e) => dispatch('copyChunkToLeft', e.detail)}
					on:copyChunkToRight={(e) => dispatch('copyChunkToRight', e.detail)}
					on:copyModifiedChunkToLeft={(e) => dispatch('copyModifiedChunkToLeft', e.detail)}
					on:copyModifiedChunkToRight={(e) => dispatch('copyModifiedChunkToRight', e.detail)}
					on:deleteChunkFromLeft={(e) => dispatch('deleteChunkFromLeft', e.detail)}
					on:deleteChunkFromRight={(e) => dispatch('deleteChunkFromRight', e.detail)}
			/>
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

	/* Chunk start needs relative positioning for absolute child elements */
	.gutter-line.chunk-start {
		position: relative;
	}

</style>