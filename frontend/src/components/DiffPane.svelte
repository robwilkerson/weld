<script lang="ts">
import { createEventDispatcher } from "svelte";
import type { HighlightedDiffLine, LineChunk, PaneSide } from "../types/diff";
// biome-ignore lint/correctness/noUnusedImports: Used in template
import { escapeHtml, getLineClass } from "../utils/diff";

// Props
export let lines: HighlightedDiffLine[];
export let side: PaneSide;
export let lineNumberWidth: string;

// Functions passed from parent for chunk detection
export let getChunkForLine: (lineIndex: number) => LineChunk | null;
export let isFirstLineOfChunk: (lineIndex: number, chunk: LineChunk) => boolean;
export let isLineHighlighted: (lineIndex: number) => boolean;
export let isLineHovered: (lineIndex: number) => boolean;

// Element ref
let paneElement: HTMLElement;

// Event dispatcher
const dispatch = createEventDispatcher<{
	scroll: undefined;
	chunkClick: number;
	chunkMouseEnter: number;
	chunkMouseLeave: undefined;
}>();

// Event handlers
// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleScroll(): void {
	dispatch("scroll");
}

function handleChunkClick(index: number): void {
	const chunk = getChunkForLine(index);
	if (chunk) {
		dispatch("chunkClick", index);
	}
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleChunkMouseEnter(index: number): void {
	const chunk = getChunkForLine(index);
	if (chunk) {
		dispatch("chunkMouseEnter", index);
	}
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleChunkMouseLeave(): void {
	dispatch("chunkMouseLeave");
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleChunkKeydown(e: KeyboardEvent, index: number): void {
	const chunk = getChunkForLine(index);
	if (chunk && (e.key === "Enter" || e.key === " ")) {
		e.preventDefault();
		handleChunkClick(index);
	}
}

// Export element for parent to control scroll
export function getElement(): HTMLElement {
	return paneElement;
}

// Scroll control from parent
export function setScrollTop(scrollTop: number): void {
	if (paneElement) {
		paneElement.scrollTop = scrollTop;
	}
}

export function setScrollLeft(scrollLeft: number): void {
	if (paneElement) {
		paneElement.scrollLeft = scrollLeft;
	}
}
</script>

<div class="{side}-pane" bind:this={paneElement} on:scroll={handleScroll}>
	<div class="pane-content" style="height: calc({lines.length} * var(--line-height));">
		{#each lines as line, index}
			{@const chunk = getChunkForLine(index)}
			{@const isFirstInChunk = chunk ? isFirstLineOfChunk(index, chunk) : false}
			{@const isLastInChunk = chunk ? index === chunk.endIndex : false}
			<div 
				class="line {getLineClass(line.type)} {chunk && isFirstInChunk ? 'chunk-start' : ''} {chunk && isLastInChunk ? 'chunk-end' : ''} {isLineHighlighted(index) ? 'current-diff' : ''} {chunk ? 'clickable-chunk' : ''} {isLineHovered(index) ? 'chunk-hover' : ''}" 
				data-line-type={line.type}
				on:click={() => chunk && handleChunkClick(index)}
				on:mouseenter={() => chunk && handleChunkMouseEnter(index)}
				on:mouseleave={() => chunk && handleChunkMouseLeave()}
				on:keydown={(e) => handleChunkKeydown(e, index)}
				role={chunk ? 'button' : undefined}
				tabindex={chunk ? 0 : undefined}
			>
				<span class="line-number">{line[side === 'left' ? 'leftNumber' : 'rightNumber'] || ' '}</span>
				<span class="line-text">{@html line[side === 'left' ? 'leftLineHighlighted' : 'rightLineHighlighted'] || escapeHtml(line[side === 'left' ? 'leftLine' : 'rightLine'] || ' ')}</span>
			</div>
		{/each}
	</div>
</div>

<style>
	.left-pane,
	.right-pane {
		flex: 1;
		overflow-y: auto;
		overflow-x: auto;
		font-family: monospace;
		font-size: var(--font-size);
		line-height: var(--line-height);
		white-space: pre;
		background: #eff1f5;
		position: relative;
		scrollbar-gutter: stable;
	}

	:global([data-theme="dark"]) .left-pane,
	:global([data-theme="dark"]) .right-pane {
		background: #24273a;
	}

	/* Scrollbar styling */
	.left-pane::-webkit-scrollbar,
	.right-pane::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}

	.left-pane::-webkit-scrollbar-track,
	.right-pane::-webkit-scrollbar-track {
		background: #e6e9ef;
	}

	.left-pane::-webkit-scrollbar-thumb,
	.right-pane::-webkit-scrollbar-thumb {
		background: #9ca0b0;
		border-radius: 4px;
		border: 1px solid #e6e9ef;
	}

	.left-pane::-webkit-scrollbar-thumb:hover,
	.right-pane::-webkit-scrollbar-thumb:hover {
		background: #6c6f85;
	}

	:global([data-theme="dark"]) .left-pane::-webkit-scrollbar-track,
	:global([data-theme="dark"]) .right-pane::-webkit-scrollbar-track {
		background: #1e2030;
	}

	:global([data-theme="dark"]) .left-pane::-webkit-scrollbar-thumb,
	:global([data-theme="dark"]) .right-pane::-webkit-scrollbar-thumb {
		background: #5b6078;
		border: 1px solid #1e2030;
	}

	:global([data-theme="dark"]) .left-pane::-webkit-scrollbar-thumb:hover,
	:global([data-theme="dark"]) .right-pane::-webkit-scrollbar-thumb:hover {
		background: #6e738d;
	}

	/* Scrollbar corner styling */
	.left-pane::-webkit-scrollbar-corner,
	.right-pane::-webkit-scrollbar-corner {
		background: #e6e9ef;
	}

	:global([data-theme="dark"]) .left-pane::-webkit-scrollbar-corner,
	:global([data-theme="dark"]) .right-pane::-webkit-scrollbar-corner {
		background: #1e2030;
	}

	.left-pane::before,
	.right-pane::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: var(--line-number-width);
		background: #dce0e8;
		z-index: 1;
		pointer-events: none;
	}

	:global([data-theme="dark"]) .left-pane::before,
	:global([data-theme="dark"]) .right-pane::before {
		background: #1e2030;
	}

	.pane-content {
		position: relative;
		min-width: max-content;
	}

	.line {
		display: flex;
		height: var(--line-height);
		position: relative;
		transition: background-color 0.15s ease;
		padding-right: 20px; /* Prevent minimap overlap */
	}

	.line-number {
		width: var(--line-number-width);
		text-align: right;
		padding-right: 5px;
		padding-left: 5px;
		color: #9ca0b0;
		user-select: none;
		background: #dce0e8;
		position: sticky;
		left: 0;
		z-index: 2;
		flex-shrink: 0;
		font-size: 0.75rem;
	}

	:global([data-theme="dark"]) .line-number {
		background: #1e2030;
		color: #8087a2;
	}

	.line-text {
		flex: 1;
		padding-left: 0.5rem;
		padding-right: 0.5rem;
		color: #4c4f69;
		min-width: 0;
		white-space: pre;
		position: relative;
		text-align: left;
	}

	:global([data-theme="dark"]) .line-text {
		color: #cad3f5;
	}

	/* Diff line colors */
	.line-same {
		background: #eff1f5;
	}

	.line-same .line-text {
		border-left: 3px solid #eff1f5;
	}

	:global([data-theme="dark"]) .line-same {
		background: #24273a;
	}

	:global([data-theme="dark"]) .line-same .line-text {
		border-left: 3px solid #24273a;
	}

	.line-added,
	.line-removed,
	.line-modified {
		background: rgba(30, 102, 245, 0.1);
	}

	.line-added .line-text,
	.line-removed .line-text,
	.line-modified .line-text {
		border-left: 3px solid #1e66f5;
	}

	:global([data-theme="dark"]) .line-added,
	:global([data-theme="dark"]) .line-removed,
	:global([data-theme="dark"]) .line-modified {
		background: rgba(138, 173, 244, 0.15);
	}

	:global([data-theme="dark"]) .line-added .line-text,
	:global([data-theme="dark"]) .line-removed .line-text,
	:global([data-theme="dark"]) .line-modified .line-text {
		border-left: 3px solid #8aadf4;
	}

	.line-added .line-number,
	.line-removed .line-number,
	.line-modified .line-number {
		background: #dce0e8;
		color: #1e66f5;
	}

	:global([data-theme="dark"]) .line-added .line-number,
	:global([data-theme="dark"]) .line-removed .line-number,
	:global([data-theme="dark"]) .line-modified .line-number {
		background: #1e2030;
		color: #8aadf4;
	}

	/* Current diff highlighting */
	.line.line-modified.current-diff,
	.line.line-added.current-diff,
	.line.line-removed.current-diff {
		position: relative;
		background-color: rgba(30, 102, 245, 0.25);
	}

	/* Stronger left border for current diff */
	.line.line-modified.current-diff .line-text,
	.line.line-added.current-diff .line-text,
	.line.line-removed.current-diff .line-text {
		border-left-width: 4px;
		border-left-color: #1e66f5;
	}

	:global([data-theme="dark"]) .line.line-modified.current-diff,
	:global([data-theme="dark"]) .line.line-added.current-diff,
	:global([data-theme="dark"]) .line.line-removed.current-diff {
		background-color: rgba(138, 173, 244, 0.25);
	}

	:global([data-theme="dark"]) .line.line-modified.current-diff .line-text,
	:global([data-theme="dark"]) .line.line-added.current-diff .line-text,
	:global([data-theme="dark"]) .line.line-removed.current-diff .line-text {
		border-left-width: 4px;
		border-left-color: #8aadf4;
	}

	/* Chunk hover */
	.line.clickable-chunk {
		cursor: pointer;
	}

	.line.chunk-hover:not(.current-diff) {
		background-color: rgba(30, 102, 245, 0.1);
	}

	:global([data-theme="dark"]) .line.chunk-hover:not(.current-diff) {
		background-color: rgba(138, 173, 244, 0.1);
	}

	.line.clickable-chunk:focus {
		outline: none;
	}
</style>