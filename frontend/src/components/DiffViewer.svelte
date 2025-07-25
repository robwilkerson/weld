<script lang="ts">
import { createEventDispatcher } from "svelte";
import type {
	DiffViewerEvents,
	DiffViewerProps,
	HighlightedDiffLine,
	LineChunk,
} from "../types/diff";
// biome-ignore lint/correctness/noUnusedImports: Used in template
import { getDisplayPath } from "../utils/diff";
// biome-ignore lint/correctness/noUnusedImports: Used in template
import DiffGutter from "./DiffGutter.svelte";
// biome-ignore lint/correctness/noUnusedImports: Used in template
import DiffHeader from "./DiffHeader.svelte";
// biome-ignore lint/correctness/noUnusedImports: Used in template
import DiffPane from "./DiffPane.svelte";
// biome-ignore lint/correctness/noUnusedImports: Used in template
import Minimap from "./Minimap.svelte";

// Props
export let leftFilePath: DiffViewerProps["leftFilePath"];
export let rightFilePath: DiffViewerProps["rightFilePath"];
export let diffResult: DiffViewerProps["diffResult"];
export let hasUnsavedLeftChanges: DiffViewerProps["hasUnsavedLeftChanges"];
export let hasUnsavedRightChanges: DiffViewerProps["hasUnsavedRightChanges"];
export let currentDiffChunkIndex: DiffViewerProps["currentDiffChunkIndex"];
export let hoveredChunkIndex: DiffViewerProps["hoveredChunkIndex"];
export let showMinimap: DiffViewerProps["showMinimap"];
export let isDarkMode: DiffViewerProps["isDarkMode"];
export let isComparing: DiffViewerProps["isComparing"];
export let hasCompletedComparison: DiffViewerProps["hasCompletedComparison"];
export let areFilesIdentical: DiffViewerProps["areFilesIdentical"];
export let isSameFile: DiffViewerProps["isSameFile"];
export let lineNumberWidth: DiffViewerProps["lineNumberWidth"];

// Component refs for scroll synchronization
let leftPaneComponent: any;
let rightPaneComponent: any;
let centerGutterComponent: any;

// Viewport tracking for minimap
// biome-ignore lint/correctness/noUnusedVariables: Used in Minimap component
export let viewportTop = 0;
// biome-ignore lint/correctness/noUnusedVariables: Used in Minimap component
export let viewportHeight = 0;

// Event dispatcher
const dispatch = createEventDispatcher<DiffViewerEvents>();

// Line chunks for grouping
let lineChunks: LineChunk[] = [];
let diffChunks: LineChunk[] = [];

// Process chunks when diffResult changes
$: if (diffResult) {
	lineChunks = detectLineChunks(diffResult.lines);
	diffChunks = lineChunks.filter((chunk) => chunk.type !== "same");
}

// Helper functions
function detectLineChunks(lines: HighlightedDiffLine[]): LineChunk[] {
	const chunks: LineChunk[] = [];
	let currentChunk: LineChunk | null = null;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (!currentChunk || currentChunk.type !== line.type) {
			// Start a new chunk
			if (currentChunk) {
				chunks.push(currentChunk);
			}
			currentChunk = {
				startIndex: i,
				endIndex: i,
				type: line.type,
				lines: 1,
			};
		} else {
			// Continue current chunk
			currentChunk.endIndex = i;
			currentChunk.lines++;
		}
	}

	// Don't forget the last chunk
	if (currentChunk) {
		chunks.push(currentChunk);
	}

	return chunks;
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function isFirstLineOfChunk(lineIndex: number, chunk: LineChunk): boolean {
	return lineIndex === chunk.startIndex;
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function getChunkForLine(lineIndex: number): LineChunk | null {
	return (
		lineChunks.find(
			(chunk) => lineIndex >= chunk.startIndex && lineIndex <= chunk.endIndex,
		) || null
	);
}

// Make this a reactive function so it updates when dependencies change
$: isLineHighlighted = (lineIndex: number): boolean => {
	if (currentDiffChunkIndex === -1) return false;
	const chunk = diffChunks[currentDiffChunkIndex];
	const result =
		chunk && lineIndex >= chunk.startIndex && lineIndex <= chunk.endIndex;

	return result;
};

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function isLineHovered(lineIndex: number): boolean {
	if (hoveredChunkIndex === -1) return false;
	const chunk = diffChunks[hoveredChunkIndex];
	return chunk && lineIndex >= chunk.startIndex && lineIndex <= chunk.endIndex;
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function isFirstOfConsecutiveModified(index: number): boolean {
	if (
		!diffResult ||
		!diffResult.lines[index] ||
		diffResult.lines[index].type !== "modified"
	) {
		return false;
	}

	// Check if previous line is not modified
	if (index === 0 || diffResult.lines[index - 1].type !== "modified") {
		return true;
	}

	return false;
}

// Event handlers
// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleChunkClick(lineIndex: number): void {
	// Find which diff chunk this line belongs to
	const clickedChunkIndex = diffChunks.findIndex(
		(chunk) => lineIndex >= chunk.startIndex && lineIndex <= chunk.endIndex,
	);

	if (clickedChunkIndex !== -1) {
		dispatch("chunkClick", { chunkIndex: clickedChunkIndex, lineIndex });
	}
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleChunkMouseEnter(lineIndex: number): void {
	dispatch("chunkHover", lineIndex);
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleChunkMouseLeave(): void {
	dispatch("chunkLeave");
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleSaveLeft(): void {
	dispatch("saveLeft");
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleSaveRight(): void {
	dispatch("saveRight");
}

// Scroll sync handlers
// biome-ignore lint/correctness/noUnusedVariables: Used in template
function syncLeftScroll(): void {
	if (leftPaneComponent && rightPaneComponent && centerGutterComponent) {
		const leftElement = leftPaneComponent.getElement();
		const scrollTop = leftElement.scrollTop;
		rightPaneComponent.setScrollTop(scrollTop);
		centerGutterComponent.setScrollTop(scrollTop);
		updateMinimapViewport();
	}
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function syncRightScroll(): void {
	if (leftPaneComponent && rightPaneComponent && centerGutterComponent) {
		const rightElement = rightPaneComponent.getElement();
		const scrollTop = rightElement.scrollTop;
		leftPaneComponent.setScrollTop(scrollTop);
		centerGutterComponent.setScrollTop(scrollTop);
		updateMinimapViewport();
	}
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function syncCenterScroll(): void {
	if (leftPaneComponent && rightPaneComponent && centerGutterComponent) {
		const centerElement = centerGutterComponent.getElement();
		const scrollTop = centerElement.scrollTop;
		leftPaneComponent.setScrollTop(scrollTop);
		rightPaneComponent.setScrollTop(scrollTop);
		updateMinimapViewport();
	}
}

// Update minimap viewport
function updateMinimapViewport(): void {
	if (leftPaneComponent && diffResult && diffResult.lines.length > 0) {
		const leftElement = leftPaneComponent.getElement();
		const scrollHeight = leftElement.scrollHeight;
		const clientHeight = leftElement.clientHeight;
		const scrollTop = leftElement.scrollTop;

		viewportTop = (scrollTop / scrollHeight) * 100;
		viewportHeight = (clientHeight / scrollHeight) * 100;
	}
}

// Update viewport when content changes
$: if (leftPaneComponent && diffResult && diffResult.lines.length > 0) {
	updateMinimapViewport();
}

// Scroll to a specific line
export function scrollToLine(lineIndex: number): void {
	if (leftPaneComponent && rightPaneComponent && centerGutterComponent) {
		const lineHeight = 19.2; // from CSS var(--line-height)
		const scrollTop = lineIndex * lineHeight;

		leftPaneComponent.setScrollTop(scrollTop);
		rightPaneComponent.setScrollTop(scrollTop);
		centerGutterComponent.setScrollTop(scrollTop);

		updateMinimapViewport();
	}
}

// Auto-scroll to first diff when content loads
$: if (
	leftPaneComponent &&
	rightPaneComponent &&
	centerGutterComponent &&
	diffResult &&
	diffResult.lines.length > 0 &&
	diffChunks.length > 0
) {
	// Only scroll if we haven't scrolled yet (initial load)
	const leftElement = leftPaneComponent.getElement();
	if (leftElement.scrollTop === 0) {
		const firstDiffLine = diffResult.lines.findIndex(
			(line) => line.type !== "same",
		);
		if (firstDiffLine !== -1) {
			setTimeout(() => {
				scrollToLine(firstDiffLine);
			}, 100);
		}
	}
}
</script>

<div class="diff-viewer" class:comparing={isComparing}>
	{#if diffResult && hasCompletedComparison}
		<DiffHeader
			{leftFilePath}
			{rightFilePath}
			{hasUnsavedLeftChanges}
			{hasUnsavedRightChanges}
			isFirstLineDiff={diffResult.lines?.[0]?.type !== 'same'}
			{lineNumberWidth}
			on:saveLeft={handleSaveLeft}
			on:saveRight={handleSaveRight}
		/>
		
		{#if isSameFile}
			<div class="same-file-banner">
				<div class="warning-icon">⚠️</div>
				<div class="warning-text">
					File <strong>{getDisplayPath(leftFilePath, rightFilePath, true)}</strong> is being compared to itself
				</div>
			</div>
		{:else if areFilesIdentical}
			<div class="identical-files-banner">
				<div class="info-icon">💡</div>
				<div class="info-text">
					Files are identical
				</div>
			</div>
		{/if}
		
		<div class="diff-content" style="--line-number-width: {lineNumberWidth}">
			<!-- Left pane -->
			<DiffPane
				bind:this={leftPaneComponent}
				lines={diffResult?.lines || []}
				side="left"
				{lineNumberWidth}
				{getChunkForLine}
				{isFirstLineOfChunk}
				{isLineHighlighted}
				{isLineHovered}
				on:scroll={syncLeftScroll}
				on:chunkClick={(e) => handleChunkClick(e.detail)}
				on:chunkMouseEnter={(e) => handleChunkMouseEnter(e.detail)}
				on:chunkMouseLeave={handleChunkMouseLeave}
			/>
			
			<!-- Center gutter -->
			<DiffGutter
				bind:this={centerGutterComponent}
				lines={diffResult?.lines || []}
				{currentDiffChunkIndex}
				{diffChunks}
				{getChunkForLine}
				{isFirstLineOfChunk}
				{isLineHighlighted}
				{isFirstOfConsecutiveModified}
				on:scroll={syncCenterScroll}
				on:copyLineToLeft={(e) => dispatch('copyLineToLeft', e.detail)}
				on:copyLineToRight={(e) => dispatch('copyLineToRight', e.detail)}
				on:copyChunkToLeft={(e) => dispatch('copyChunkToLeft', e.detail)}
				on:copyChunkToRight={(e) => dispatch('copyChunkToRight', e.detail)}
				on:copyModifiedChunkToLeft={(e) => dispatch('copyModifiedChunkToLeft', e.detail)}
				on:copyModifiedChunkToRight={(e) => dispatch('copyModifiedChunkToRight', e.detail)}
				on:deleteChunkFromLeft={(e) => dispatch('deleteChunkFromLeft', e.detail)}
				on:deleteChunkFromRight={(e) => dispatch('deleteChunkFromRight', e.detail)}
			/>
			
			<!-- Right pane -->
			<DiffPane
				bind:this={rightPaneComponent}
				lines={diffResult?.lines || []}
				side="right"
				{lineNumberWidth}
				{getChunkForLine}
				{isFirstLineOfChunk}
				{isLineHighlighted}
				{isLineHovered}
				on:scroll={syncRightScroll}
				on:chunkClick={(e) => handleChunkClick(e.detail)}
				on:chunkMouseEnter={(e) => handleChunkMouseEnter(e.detail)}
				on:chunkMouseLeave={handleChunkMouseLeave}
			/>
			
			<!-- Minimap -->
			<Minimap
				show={showMinimap && diffResult && diffResult.lines.length > 0}
				{lineChunks}
				totalLines={diffResult?.lines.length || 0}
				{currentDiffChunkIndex}
				{diffChunks}
				{viewportTop}
				{viewportHeight}
				{isDarkMode}
				on:minimapClick={(e) => dispatch('minimapClick', e.detail.event)}
				on:viewportMouseDown={(e) => dispatch('viewportMouseDown', e.detail.event)}
			/>
		</div>
	{:else if leftFilePath && rightFilePath}
		<div class="empty-state">
			Files selected. Click "Compare Files" button above to see differences.
		</div>
	{:else}
		<div class="empty-state">
			Select two files to compare their differences
		</div>
	{/if}
</div>

<style>
	:root {
		--line-height: 19.2px;
		--font-size: 0.8rem;
		--gutter-width: 72px;
	}

	.diff-viewer {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		position: relative;
	}

	.diff-viewer.comparing {
		opacity: 0.6;
		pointer-events: none;
	}

	/* Banner styles */
	.same-file-banner,
	.identical-files-banner {
		display: flex;
		align-items: center;
		padding: 1rem;
		background: #fef3c7;
		border-bottom: 1px solid #f59e0b;
		gap: 0.75rem;
	}

	.identical-files-banner {
		background: #dbeafe;
		border-bottom-color: #3b82f6;
	}

	:global([data-theme="dark"]) .same-file-banner {
		background: rgba(245, 158, 11, 0.2);
		border-bottom-color: #f59e0b;
	}

	:global([data-theme="dark"]) .identical-files-banner {
		background: rgba(59, 130, 246, 0.2);
		border-bottom-color: #3b82f6;
	}

	.warning-icon,
	.info-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.warning-text,
	.info-text {
		color: #92400e;
		font-size: 0.9rem;
	}

	.info-text {
		color: #1e40af;
	}

	:global([data-theme="dark"]) .warning-text {
		color: #fbbf24;
	}

	:global([data-theme="dark"]) .info-text {
		color: #93bbfc;
	}

	/* Diff content area */
	.diff-content {
		flex: 1;
		display: flex;
		overflow: hidden;
		position: relative;
	}



	/* Empty state */
	.empty-state {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #9ca0b0;
		font-size: 1.1rem;
		text-align: center;
		padding: 2rem;
	}

	:global([data-theme="dark"]) .empty-state {
		color: #a5adcb;
	}

	/* Inline diff highlighting */
	:global(.inline-diff-highlight) {
		background-color: rgba(30, 102, 245, 0.3) !important;
		color: #4c4f69;
		padding: 1px 2px !important;
		border-radius: 2px !important;
		font-weight: normal;
		min-height: var(--line-height);
		display: inline-block;
		line-height: var(--line-height);
		vertical-align: top;
		margin: 0 1px;
	}

	:global([data-theme="dark"] .inline-diff-highlight) {
		background-color: rgba(138, 173, 244, 0.3) !important;
		color: #cad3f5;
	}

	/* Full line highlighting for added/removed lines */
	:global(.inline-diff-highlight-full) {
		background-color: rgba(30, 102, 245, 0.3) !important;
		color: #4c4f69;
		padding: 0 2px !important;
		border-radius: 2px !important;
		font-weight: normal;
		min-height: var(--line-height);
		display: inline-block;
		line-height: var(--line-height);
		vertical-align: top;
		width: 100%;
		min-width: 100%;
		box-decoration-break: clone;
		-webkit-box-decoration-break: clone;
	}

	:global([data-theme="dark"] .inline-diff-highlight-full) {
		background-color: rgba(138, 173, 244, 0.3) !important;
		color: #cad3f5;
	}
</style>