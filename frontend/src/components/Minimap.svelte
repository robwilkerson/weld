<script lang="ts">
import { createEventDispatcher } from "svelte";
import type { LineChunk } from "../types";

export let show: boolean = true;
export let lineChunks: LineChunk[] = [];
export let totalLines: number = 0;
export let currentDiffChunkIndex: number = -1;
export let diffChunks: Array<{ startIndex: number; endIndex: number }> = [];
export let viewportTop: number = 0;
export let viewportHeight: number = 0;
export let isDarkMode: boolean = false;

const dispatch = createEventDispatcher();

function handleMinimapClick(event: MouseEvent): void {
	dispatch("minimapClick", { event });
}

function handleViewportMouseDown(event: MouseEvent): void {
	dispatch("viewportMouseDown", { event });
}
</script>

{#if show && totalLines > 0}
	<div class="minimap-pane">
		<div class="minimap" on:click={handleMinimapClick}>
			{#each lineChunks as chunk}
				{#if chunk.type !== "same"}
					{@const isCurrentChunk = diffChunks.findIndex(
						(dc) => dc.startIndex === chunk.startIndex && dc.endIndex === chunk.endIndex
					) === currentDiffChunkIndex}
					<div
						class="minimap-chunk minimap-{chunk.type} {isCurrentChunk ? 'minimap-current' : ''}"
						style="top: {(chunk.startIndex / totalLines) * 100}%; 
						       height: {(chunk.lines / totalLines) * 100}%;"
						data-chunk-start={chunk.startIndex}
						data-chunk-lines={chunk.lines}
					></div>
				{/if}
			{/each}
			<!-- Viewport indicator -->
			<div
				class="minimap-viewport"
				style="top: {viewportTop}%; height: {viewportHeight}%;"
				on:mousedown={handleViewportMouseDown}
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