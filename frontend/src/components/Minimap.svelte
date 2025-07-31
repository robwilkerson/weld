<script lang="ts">
import { createEventDispatcher } from "svelte";
import type { HighlightedDiffLine } from "../types/diff";

// biome-ignore-start lint/style/useConst: Svelte component props must use 'let' for reactivity
export let show: boolean = true;
export let totalLines: number = 0;
export let currentDiffChunkIndex: number = -1;
export let diffChunks: Array<{ startIndex: number; endIndex: number }> = [];
export let viewportTop: number = 0;
export let viewportHeight: number = 0;
export let diffLines: HighlightedDiffLine[] = [];
// biome-ignore-end lint/style/useConst: Svelte component props must use 'let' for reactivity

const dispatch = createEventDispatcher();

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function getChunkTooltip(
	chunk: { startIndex: number; endIndex: number },
	type: string,
): string {
	if (!diffLines || diffLines.length === 0) {
		return `Diff: Lines ${chunk.startIndex + 1}-${chunk.endIndex + 1}`;
	}

	// Get the actual line numbers from the diff lines
	const startLine = diffLines[chunk.startIndex];
	const endLine = diffLines[chunk.endIndex];

	// For added/removed chunks, show the line numbers from the side that has content
	if (type === "added") {
		const startNum = startLine?.rightNumber || 0;
		const endNum = endLine?.rightNumber || 0;
		return `Added: Right lines ${startNum}-${endNum}`;
	} else if (type === "removed") {
		const startNum = startLine?.leftNumber || 0;
		const endNum = endLine?.leftNumber || 0;
		return `Removed: Left lines ${startNum}-${endNum}`;
	} else if (type === "modified") {
		// For modified, show both sides
		const leftStart = startLine?.leftNumber || 0;
		const leftEnd = endLine?.leftNumber || 0;
		const rightStart = startLine?.rightNumber || 0;
		const rightEnd = endLine?.rightNumber || 0;
		return `Modified: Left ${leftStart}-${leftEnd}, Right ${rightStart}-${rightEnd}`;
	}

	// Fallback
	return `Diff: Lines ${chunk.startIndex + 1}-${chunk.endIndex + 1}`;
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleMinimapClick(event: MouseEvent): void {
	event.stopPropagation();

	// Check if we clicked on a specific chunk
	const target = event.target as HTMLElement;

	// If we clicked on a chunk element, get its data
	if (target.classList.contains("minimap-chunk")) {
		const chunkIndex = parseInt(
			target.getAttribute("data-chunk-index") || "-1",
			10,
		);

		if (chunkIndex >= 0 && chunkIndex < diffChunks.length) {
			const chunk = diffChunks[chunkIndex];
			// Create a lineChunk-like object for compatibility with the event handler
			const firstLine = diffLines[chunk.startIndex];
			const chunkType = firstLine ? firstLine.type : "same";
			const lineChunk = {
				startIndex: chunk.startIndex,
				endIndex: chunk.endIndex,
				type: chunkType,
				lines: chunk.endIndex - chunk.startIndex + 1,
			};
			dispatch("minimapClick", {
				chunk: lineChunk,
				diffChunkIndex: chunkIndex,
			});
			return;
		}
	}

	// Otherwise, calculate based on click position
	const minimap = event.currentTarget as HTMLElement;
	const minimapRect = minimap.getBoundingClientRect();
	const clickY = event.clientY - minimapRect.top;
	const clickPercentage = clickY / minimapRect.height;

	dispatch("minimapClick", { clickPercentage });
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleViewportMouseDown(event: MouseEvent): void {
	dispatch("viewportMouseDown", { event });
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleMinimapKeyDown(event: KeyboardEvent): void {
	if (event.key === "Enter" || event.key === " ") {
		event.preventDefault();
		// Simulate a click at the center of the minimap
		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const clickEvent = new MouseEvent("click", {
			clientX: rect.left + rect.width / 2,
			clientY: rect.top + rect.height / 2,
		});
		target.dispatchEvent(clickEvent);
	}
}
</script>

{#if show && totalLines > 0}
	<div class="minimap-pane">
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
		<div 
			class="minimap" 
			on:click={handleMinimapClick}
			on:keydown={handleMinimapKeyDown}
			role="navigation"
			aria-label="Minimap navigation"
			tabindex="0"
		>
			{#each diffChunks as chunk, index}
				{@const firstLine = diffLines[chunk.startIndex]}
				{@const chunkType = firstLine ? firstLine.type : 'same'}
				{@const isCurrentChunk = index === currentDiffChunkIndex}
				<div
					class="minimap-chunk minimap-{chunkType} {isCurrentChunk ? 'minimap-current' : ''}"
					style="top: {(chunk.startIndex / totalLines) * 100}%; 
					       height: {((chunk.endIndex - chunk.startIndex + 1) / totalLines) * 100}%;"
					data-chunk-start={chunk.startIndex}
					data-chunk-index={index}
					data-chunk-lines={chunk.endIndex - chunk.startIndex + 1}
					title="{getChunkTooltip(chunk, chunkType)} (Diff {index + 1})"
				></div>
			{/each}
			<!-- Viewport indicator -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="minimap-viewport"
				style="top: {viewportTop}%; height: {viewportHeight}%;"
				on:mousedown={handleViewportMouseDown}
				role="slider"
				aria-label="Viewport position"
				aria-valuenow={Math.round((viewportTop / 100) * 100)}
				aria-valuemin="0"
				aria-valuemax="100"
				tabindex="0"
			></div>
		</div>
	</div>
{/if}

<style>
	.minimap-pane {
		width: 18px;
		background: #e6e9ef;
		overflow: hidden;
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		z-index: 10;
	}

	.minimap {
		width: 100%;
		height: calc(100% - 5px); /* Leave space for horizontal scrollbar */
		cursor: pointer;
		position: relative;
		min-height: 300px;
	}

	.minimap-chunk {
		position: absolute;
		width: 100%;
		left: 0;
		border-radius: 1px;
		cursor: pointer;
		transition: opacity 0.2s ease;
	}

	.minimap-chunk:hover {
		opacity: 0.7;
	}

	.minimap-same {
		background: #eff1f5;
	}

	.minimap-added {
		background: rgba(33, 150, 243, 0.4);
	}

	.minimap-removed {
		background: rgba(33, 150, 243, 0.4);
	}

	.minimap-modified {
		background: rgba(255, 193, 7, 0.5);
	}

	.minimap-current {
		box-shadow: 0 0 0 2px #1e66f5;
		z-index: 5;
	}

	.minimap-viewport {
		position: absolute;
		width: 100%;
		left: 0;
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid rgba(0, 0, 0, 0.4);
		border-radius: 2px;
		cursor: grab;
		user-select: none;
		min-height: 10px;
	}

	.minimap-viewport:hover {
		background: rgba(0, 0, 0, 0.3);
	}

	.minimap-viewport:active {
		cursor: grabbing;
	}

	/* Dark mode styles */
	:global([data-theme="dark"]) .minimap-pane {
		background: #1e2030;
	}

	:global([data-theme="dark"]) .minimap-viewport {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.3);
	}

	:global([data-theme="dark"]) .minimap-viewport:hover {
		background: rgba(255, 255, 255, 0.15);
	}

	:global([data-theme="dark"]) .minimap-same {
		background: #24273a;
	}

	:global([data-theme="dark"]) .minimap-added {
		background: rgba(100, 181, 246, 0.4);
	}

	:global([data-theme="dark"]) .minimap-removed {
		background: rgba(100, 181, 246, 0.4);
	}

	:global([data-theme="dark"]) .minimap-modified {
		background: rgba(255, 183, 77, 0.5);
	}

	:global([data-theme="dark"]) .minimap-current {
		box-shadow: 0 0 0 2px #8aadf4;
	}
</style>