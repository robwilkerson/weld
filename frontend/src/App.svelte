<script lang="ts">
import { onMount } from "svelte";
import { get } from "svelte/store";
import {
	BeginOperationGroup,
	CommitOperationGroup,
	CompareFiles,
	CopyToFile,
	DiscardAllChanges,
	GetInitialFiles,
	GetMinimapVisible,
	QuitWithoutSaving,
	RemoveLineFromFile,
	RollbackOperationGroup,
	SaveSelectedFilesAndQuit,
} from "../wailsjs/go/main/App.js";
import { EventsOn } from "../wailsjs/runtime/runtime.js";
// biome-ignore lint/correctness/noUnusedImports: Used in Svelte template
import DiffViewer from "./components/DiffViewer.svelte";
// biome-ignore lint/correctness/noUnusedImports: Used in Svelte template
import FileSelector from "./components/FileSelector.svelte";
// biome-ignore lint/correctness/noUnusedImports: Used in Svelte template
import FlashMessage from "./components/FlashMessage.svelte";
// biome-ignore lint/correctness/noUnusedImports: Used in Svelte template
import Menu from "./components/Menu.svelte";
// biome-ignore lint/correctness/noUnusedImports: Used in Svelte template
import QuitDialog from "./components/QuitDialog.svelte";
// biome-ignore lint/style/useImportType: UndoManager is used as a component, not just a type
import UndoManager from "./components/UndoManager.svelte";
// biome-ignore-start lint/correctness/noUnusedImports: diffNavigation and lineNumberWidth are used via $diffNavigation and $lineNumberWidth
import {
	diffChunks,
	diffNavigation,
	diffStore,
	lineNumberWidth,
} from "./stores/diffStore.js";
// biome-ignore-end lint/correctness/noUnusedImports: diffNavigation and lineNumberWidth are used via $diffNavigation and $lineNumberWidth
// biome-ignore-start lint/correctness/noUnusedImports: Used in Svelte reactive statements with $ prefix
import {
	bothFilesSelected,
	fileStore,
	isSameFile,
} from "./stores/fileStore.js";
// biome-ignore-end lint/correctness/noUnusedImports: Used in Svelte reactive statements with $ prefix
import { navigationStore } from "./stores/navigationStore";
import { uiStore } from "./stores/uiStore";
// biome-ignore-start lint/correctness/noUnusedImports: Used in Svelte reactive statements with $ prefix
import {
	hasAnyUnsavedChanges,
	hasUnsavedLeftChanges,
	hasUnsavedRightChanges,
	unsavedChangesStore,
} from "./stores/unsavedChangesStore.js";
// biome-ignore-end lint/correctness/noUnusedImports: Used in Svelte reactive statements with $ prefix
import type {
	DiffLine,
	DiffResult,
	HighlightedDiffLine,
	HighlightedDiffResult,
	LineChunk,
} from "./types/diff.js";
import { computeInlineDiff, escapeHtml } from "./utils/diff.js";
import * as diffOps from "./utils/diffOperations.js";
import { handleKeydown as handleKeyboardShortcut } from "./utils/keyboard.js";
import { getLanguageFromExtension } from "./utils/language.js";
import { detectLineChunks } from "./utils/lineChunks.js";
import { createScrollSynchronizer } from "./utils/scrollSync.js";

// Shiki highlighter instance
// biome-ignore lint/suspicious/noExplicitAny: Highlighter is disabled and set to null
let highlighter: any = null;

// Cache for highlighted lines to avoid re-processing
const highlightCache: Map<string, string> = new Map();

// Create scroll synchronizer instance (no longer used, will be removed with state management refactor)
const scrollSync = createScrollSynchronizer();

// biome-ignore lint/suspicious/noExplicitAny: Svelte component ref
let diffViewerComponent: any;

// File state is now managed by fileStore
// Diff state is now managed by diffStore
// UI state is now managed by uiStore
// biome-ignore lint/correctness/noUnusedVariables: Keep for backward compatibility during migration
const isScrollSyncing: boolean = false;

// Quit dialog state
let fileSelections: Record<string, boolean> = {};
let _quitDialogFiles: string[] = [];

// Current diff tracking is now managed by diffStore

// Hover tracking for chunks is now managed by uiStore

// UndoManager component instance
let undoManager: UndoManager;

// Create a reactive function for checking if a line is in the current chunk
$: isLineHighlighted = (lineIndex: number) => {
	if (
		$diffStore.currentChunkIndex === -1 ||
		!$diffChunks ||
		!$diffChunks[$diffStore.currentChunkIndex]
	) {
		return false;
	}

	const chunk = $diffChunks[$diffStore.currentChunkIndex];
	const isInChunk =
		lineIndex >= chunk.startIndex && lineIndex <= chunk.endIndex;

	return isInChunk;
};

// Create a reactive function for checking if a line is in the hovered chunk
$: isLineHovered = (lineIndex: number) => {
	const hoveredIndex = $uiStore.hoveredChunkIndex;
	if (hoveredIndex === -1 || !$diffChunks || !$diffChunks[hoveredIndex]) {
		return false;
	}

	const chunk = $diffChunks[hoveredIndex];
	const isInChunk =
		lineIndex >= chunk.startIndex && lineIndex <= chunk.endIndex;

	return isInChunk;
};

// Diff chunks will be computed reactively after highlightedDiffResult is declared

// isSameFile is now a derived store from fileStore

// Line number width is now computed by diffStore as a derived store

// ===========================================
// HIGHLIGHTING TYPES AND STATE
// ===========================================

// Highlighted diff result is now managed by diffStore

// Track if we're currently processing to avoid re-entrancy
let isProcessingHighlight = false;

// Diff chunks are now computed by diffStore as a derived store

// ===========================================
// HIGHLIGHTING CONFIGURATION
// ===========================================

// Feature flags for different highlighting types
const HIGHLIGHTING_CONFIG = {
	chunkHighlighting: true, // Full-width line backgrounds
	inlineHighlighting: true, // Specific content changes within lines
	syntaxHighlighting: false, // Code syntax highlighting
};

// Process highlighting when rawDiff changes
$: if ($diffStore.rawDiff && highlighter && !isProcessingHighlight) {
	processHighlighting($diffStore.rawDiff);
} else if ($diffStore.rawDiff && !highlighter) {
	// Set result without highlighting for now
	setHighlightedDiffWithChunks({
		lines: $diffStore.rawDiff.lines.map((line) =>
			processLineHighlighting(line),
		),
	});
	// Auto-scroll is now handled by DiffViewer component
} else if (!$diffStore.rawDiff) {
	setHighlightedDiffWithChunks(null);
}

// Line chunks are now managed in diffStore
$: lineChunks = $diffStore.lineChunks;

// Helper function to set highlighted diff and update lineChunks
function setHighlightedDiffWithChunks(
	highlightedDiff: HighlightedDiffResult | null,
): void {
	diffStore.setHighlightedDiff(highlightedDiff);
	if (highlightedDiff?.lines) {
		const chunks = detectLineChunks(highlightedDiff.lines);
		diffStore.setLineChunks(chunks);
	} else {
		diffStore.setLineChunks([]);
	}
}

// Viewport tracking for minimap
// biome-ignore lint/correctness/noUnusedVariables: Used in Minimap component
const viewportTop = 0;
// biome-ignore lint/correctness/noUnusedVariables: Used in Minimap component
const viewportHeight = 0;
const _dragStartY = 0;
const _dragStartScrollTop = 0;

// Process chunks when highlightedDiff changes
$: if ($diffStore.highlightedDiff) {
	diffStore.setLineChunks(detectLineChunks($diffStore.highlightedDiff.lines));
}

// Note: Minimap viewport updates are now handled in DiffViewer component

// ===========================================
// HIGHLIGHTING PROCESSING
// ===========================================

/**
 * Clean any existing inline highlight markup from text
 */
function cleanInlineHighlightMarkup(text: string): string {
	return text
		.replace(/<span[^>]*class="[^"]*inline-diff-highlight[^"]*"[^>]*>/g, "")
		.replace(/<\/span>/g, "");
}

/**
 * Process and highlight diff lines based on configuration
 */
async function processHighlighting(result: DiffResult): Promise<void> {
	// Set flag to prevent re-entrancy
	isProcessingHighlight = true;

	if (!result) {
		setHighlightedDiffWithChunks(null);
		isProcessingHighlight = false;
		return;
	}

	if (!highlighter) {
		setHighlightedDiffWithChunks({
			lines: result.lines.map((line) => processLineHighlighting(line)),
		});
		isProcessingHighlight = false;
		return;
	}

	try {
		// For now, disable syntax highlighting to avoid lockups
		// TODO: Implement with web workers or lazy loading
		setHighlightedDiffWithChunks({
			lines: result.lines.map((line) => processLineHighlighting(line)),
		});

		// After highlighting is done, set initial diff chunk
		// Auto-scroll is now handled by DiffViewer component
	} catch (error) {
		console.error("Error processing highlighting:", error);
		// Fallback to non-highlighted version
		setHighlightedDiffWithChunks({
			lines: result.lines.map((line) => processLineHighlighting(line)),
		});

		// Check for horizontal scrollbar after content is rendered
		setTimeout(() => {
			checkHorizontalScrollbar();
		}, 0);
	} finally {
		isProcessingHighlight = false;
	}
}

/**
 * Process highlighting for a single line based on configuration
 */
function processLineHighlighting(line: DiffLine): HighlightedDiffLine {
	// Clean any existing markup
	const leftClean = cleanInlineHighlightMarkup(line.leftLine || "");
	const rightClean = cleanInlineHighlightMarkup(line.rightLine || "");

	if (HIGHLIGHTING_CONFIG.inlineHighlighting) {
		if (line.type === "modified" && line.leftLine && line.rightLine) {
			// Apply inline highlighting for modified lines
			const inlineDiff = computeInlineDiff(leftClean, rightClean, true);
			return {
				...line,
				leftLineHighlighted: inlineDiff.left,
				rightLineHighlighted: inlineDiff.right,
			};
		} else if (line.type === "added") {
			// Apply full-line inline highlighting to added lines
			const rightContent = rightClean.trim() === "" ? " " : rightClean; // Show space for empty lines
			const rightHighlighted = `<span class="inline-diff-highlight-full">${escapeHtml(rightContent)}</span>`;
			return {
				...line,
				leftLineHighlighted: escapeHtml(leftClean),
				rightLineHighlighted: rightHighlighted,
			};
		} else if (line.type === "removed") {
			// Apply full-line inline highlighting to removed lines
			const leftContent = leftClean.trim() === "" ? " " : leftClean; // Show space for empty lines
			const leftHighlighted = `<span class="inline-diff-highlight-full">${escapeHtml(leftContent)}</span>`;
			return {
				...line,
				leftLineHighlighted: leftHighlighted,
				rightLineHighlighted: escapeHtml(rightClean),
			};
		}
	}

	// Just escape HTML without inline highlighting
	return {
		...line,
		leftLineHighlighted: escapeHtml(leftClean),
		rightLineHighlighted: escapeHtml(rightClean),
	};
}

// Update unsaved changes status (delegated to store)
async function updateUnsavedChangesStatus(): Promise<void> {
	await unsavedChangesStore.updateStatus();
}

// Quit dialog functions
function handleQuitDialog(unsavedFiles: string[]): void {
	_quitDialogFiles = unsavedFiles;
	uiStore.showQuitDialog(unsavedFiles);

	// Initialize file selections - dirty files checked by default, clean files unchecked and disabled
	fileSelections = {};
	const { leftFilePath, rightFilePath } = fileStore.getState();
	for (const file of [leftFilePath, rightFilePath]) {
		if (file) {
			fileSelections[file] = unsavedFiles.includes(file);
		}
	}
}

async function _handleSaveAndQuit(): Promise<void> {
	const filesToSave = Object.entries(fileSelections)
		.filter(([_, selected]) => selected)
		.map(([filepath, _]) => filepath);

	try {
		await SaveSelectedFilesAndQuit(filesToSave);
	} catch (error) {
		console.error("Error saving files:", error);
		uiStore.showFlash(`Error saving files: ${error}`, "error");
	}
}

async function _handleQuitWithoutSaving(): Promise<void> {
	try {
		await QuitWithoutSaving();
	} catch (error) {
		console.error("Error quitting:", error);
	}
}

function _extractHighlightedLines(html: string): string[] {
	// Create a temporary div to parse the HTML
	const div = document.createElement("div");
	div.innerHTML = html;

	// Find the code element
	const codeElement = div.querySelector("code");
	if (!codeElement) return [];

	// Split by line breaks and extract the HTML for each line
	const lines: string[] = [];
	const innerHTML = codeElement.innerHTML;

	// Split by <br> or newline characters while preserving the content
	const parts = innerHTML.split(/(?=<br>)|(?=\n)/);
	let currentLine = "";

	for (const part of parts) {
		if (part.startsWith("<br>")) {
			lines.push(currentLine);
			currentLine = part.substring(4); // Skip the <br>
		} else if (part.startsWith("\n")) {
			lines.push(currentLine);
			currentLine = part.substring(1); // Skip the newline
		} else {
			currentLine += part;
		}
	}

	// Don't forget the last line
	if (currentLine) {
		lines.push(currentLine);
	}

	return lines;
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
async function handleLeftFileSelected(event: CustomEvent<{ path: string }>) {
	const path = event.detail.path;
	fileStore.setLeftFile(path);
	await updateUnsavedChangesStatus();
	diffStore.clear(); // Clear previous results
	uiStore.resetComparisonState(); // Reset comparison state
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleError(event: CustomEvent<{ message: string }>) {
	uiStore.showFlash(event.detail.message, "error");
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
async function handleRightFileSelected(event: CustomEvent<{ path: string }>) {
	const path = event.detail.path;
	fileStore.setRightFile(path);
	await updateUnsavedChangesStatus();
	diffStore.clear(); // Clear previous results
	uiStore.resetComparisonState(); // Reset comparison state
}

async function compareBothFiles(
	preserveCurrentDiff: boolean = false,
): Promise<void> {
	const { leftFilePath, rightFilePath } = fileStore.getState();
	if (!leftFilePath || !rightFilePath) {
		uiStore.showFlash("Please select both files before comparing", "warning");
		return;
	}

	try {
		uiStore.setComparing(true);
		uiStore.clearError();
		uiStore.clearFlash(); // Clear any previous messages

		if (!preserveCurrentDiff) {
			diffStore.setCurrentChunkIndex(-1); // Reset current diff tracking only when not preserving
		}

		// Check if comparing the same file
		if (get(isSameFile)) {
			const fileName = fileStore.getState().leftFileName;
			uiStore.showFlash(
				`File "${fileName}" is being compared to itself`,
				"warning",
			);
		}

		const result = await CompareFiles(leftFilePath, rightFilePath);
		diffStore.setRawDiff(result);

		if (!result || !result.lines) {
			uiStore.showFlash("No comparison result received", "error");
			diffStore.setRawDiff(null);
		} else if (result.lines.length === 0) {
			// Files are empty or identical
			if (!get(isSameFile)) {
				uiStore.showFlash("Files are identical", "info");
			}
		} else if (
			result.lines.every((line) => line.type === "same") &&
			!get(isSameFile)
		) {
			// Files have content but no differences
			uiStore.showFlash("Files are identical", "info");
		}

		// Mark comparison as completed
		uiStore.setCompletionState(true);

		// Auto-navigate to first diff if not preserving current diff
		if (
			!preserveCurrentDiff &&
			result &&
			result.lines &&
			result.lines.length > 0
		) {
			// Wait for diffChunks to be calculated
			setTimeout(() => {
				const chunks = get(diffChunks);
				const currentIndex = get(diffStore).currentChunkIndex;
				if (chunks.length > 0 && currentIndex === -1) {
					diffStore.setCurrentChunkIndex(0);
					// Scroll to first diff after a delay
					setTimeout(() => {
						if (diffViewerComponent && chunks[0]) {
							scrollToLine(chunks[0].startIndex, 0);
						}
					}, 100);
				}
			}, 50);
		}

		// Check for horizontal scrollbar after diff is loaded
		setTimeout(() => {
			checkHorizontalScrollbar();
		}, 100);
	} catch (error) {
		console.error("Comparison error:", error);
		uiStore.showFlash(`Error comparing files: ${error}`, "error");
		diffStore.clear();
	} finally {
		uiStore.setComparing(false);
	}
}

// Scroll sync functions moved below onMount

// ===========================================
// MINIMAP FUNCTIONALITY
// ===========================================

function _handleMinimapClick(eventData: {
	chunk?: LineChunk;
	diffChunkIndex?: number;
	clickPercentage?: number;
}): void {
	// TODO: This functionality needs to be moved to DiffViewer component
	// For now, just update the chunk index based on click position
	if (!$diffStore.highlightedDiff) return;

	// If we have a specific chunk, use it directly
	if (eventData.chunk && eventData.diffChunkIndex !== undefined) {
		const { chunk, diffChunkIndex } = eventData;

		if (diffChunkIndex !== -1) {
			diffStore.setCurrentChunkIndex(diffChunkIndex);
			// Scroll to the start of the chunk to match what the tooltip shows
			scrollToLine(chunk.startIndex, diffChunkIndex);
		}
		return;
	}

	// Otherwise, use click percentage
	if (eventData.clickPercentage !== undefined) {
		const { clickPercentage } = eventData;

		// Calculate the corresponding line index in the actual content
		const totalLines = $diffStore.highlightedDiff.lines.length;
		const targetLineIndex = Math.floor(clickPercentage * totalLines);

		// Ensure line index is within bounds
		const boundedLineIndex = Math.max(
			0,
			Math.min(targetLineIndex, totalLines - 1),
		);

		// Find which diff chunk this line belongs to and set it as current
		const clickedChunkIndex = $diffChunks.findIndex(
			(chunk) =>
				boundedLineIndex >= chunk.startIndex &&
				boundedLineIndex <= chunk.endIndex,
		);

		if (clickedChunkIndex !== -1) {
			diffStore.setCurrentChunkIndex(clickedChunkIndex);
		}

		// Scroll to the clicked location
		scrollToLine(boundedLineIndex);
	}
}

function _toggleDarkMode(): void {
	uiStore.toggleDarkMode();
	// Clear highlight cache when theme changes since highlighting depends on theme
	highlightCache.clear();
	// Re-process highlighting with new theme if we have content
	if ($diffStore.rawDiff) {
		processHighlighting($diffStore.rawDiff);
	}

	// Close menu after toggling
	uiStore.setMenuVisible(false);
}

async function _handleDiscardChanges(): Promise<void> {
	try {
		// Clear the cache
		await DiscardAllChanges();

		// Refresh the comparison
		await compareBothFiles();
		await updateUnsavedChangesStatus();

		uiStore.showFlash("All changes discarded", "info");
		uiStore.setMenuVisible(false);
	} catch (error) {
		console.error("Error discarding changes:", error);
		uiStore.showFlash(`Error discarding changes: ${error}`, "error");
	}
}

async function copyLineToRight(lineIndex: number): Promise<void> {
	if (!$diffStore.rawDiff || !$diffStore.rawDiff.lines[lineIndex]) return;

	const line = $diffStore.rawDiff.lines[lineIndex];
	if (line.type !== "removed") return;

	try {
		const context = getDiffOperationContext();
		await diffOps.copyLineToRight(lineIndex, context);
	} catch (error) {
		console.error("Error copying line to right:", error);
		uiStore.showFlash(`Error copying line: ${error}`, "error");
	}
}

async function copyLineToLeft(lineIndex: number): Promise<void> {
	if (!$diffStore.rawDiff || !$diffStore.rawDiff.lines[lineIndex]) return;

	const line = $diffStore.rawDiff.lines[lineIndex];
	if (line.type !== "added") return;

	try {
		const context = getDiffOperationContext();
		await diffOps.copyLineToLeft(lineIndex, context);
	} catch (error) {
		console.error("Error copying line to left:", error);
		uiStore.showFlash(`Error copying line: ${error}`, "error");
	}
}

// Helper to get diff operation context
function getDiffOperationContext(): diffOps.DiffOperationContext {
	const { leftFilePath, rightFilePath } = fileStore.getState();
	return {
		leftFilePath,
		rightFilePath,
		diffResult: $diffStore.rawDiff,
		compareBothFiles,
		updateUnsavedChangesStatus,
		refreshUndoState: async () => {
			if (undoManager) {
				await undoManager.refreshUndoState();
			}
		},
	};
}

async function _copyLineFromRight(lineIndex: number): Promise<void> {
	await copyLineToLeft(lineIndex);
}

async function _copyLineFromLeft(lineIndex: number): Promise<void> {
	await copyLineToRight(lineIndex);
}

async function _copyChunkToRight(chunk: LineChunk): Promise<void> {
	if (!$diffStore.rawDiff || !$diffStore.highlightedDiff) return;

	try {
		const context = getDiffOperationContext();
		await diffOps.copyChunkToRight(chunk, context);
	} catch (error) {
		console.error("Error copying chunk to right:", error);
		uiStore.showFlash(`Error copying chunk: ${error}`, "error");
	}
}

async function _copyChunkToLeft(chunk: LineChunk): Promise<void> {
	if (!$diffStore.rawDiff || !$diffStore.highlightedDiff) return;

	try {
		const context = getDiffOperationContext();
		await diffOps.copyChunkToLeft(chunk, context);
	} catch (error) {
		console.error("Error copying chunk to left:", error);
		uiStore.showFlash(`Error copying chunk: ${error}`, "error");
	}
}

async function _copyModifiedChunkToRight(chunk: LineChunk): Promise<void> {
	if (!$diffStore.rawDiff || !$diffStore.highlightedDiff) return;

	try {
		const context = getDiffOperationContext();
		await diffOps.copyModifiedChunkToRight(chunk, context);
	} catch (error) {
		console.error("Error copying modified chunk to right:", error);
		uiStore.showFlash(`Error copying chunk: ${error}`, "error");
	}
}

async function _copyModifiedChunkToLeft(chunk: LineChunk): Promise<void> {
	if (!$diffStore.rawDiff || !$diffStore.highlightedDiff) return;

	try {
		const context = getDiffOperationContext();
		await diffOps.copyModifiedChunkToLeft(chunk, context);
	} catch (error) {
		console.error("Error copying modified chunk to left:", error);
		uiStore.showFlash(`Error copying chunk: ${error}`, "error");
	}
}

async function _deleteChunkFromRight(chunk: LineChunk): Promise<void> {
	if (!$diffStore.rawDiff || !$diffStore.highlightedDiff) return;

	try {
		const context = getDiffOperationContext();
		await diffOps.deleteChunkFromRight(chunk, context);
	} catch (error) {
		console.error("Error deleting chunk from right:", error);
		uiStore.showFlash(`Error deleting chunk: ${error}`, "error");
	}
}

async function _deleteChunkFromLeft(chunk: LineChunk): Promise<void> {
	if (!$diffStore.rawDiff || !$diffStore.highlightedDiff) return;

	try {
		const context = getDiffOperationContext();
		await diffOps.deleteChunkFromLeft(chunk, context);
	} catch (error) {
		console.error("Error deleting chunk from left:", error);
		uiStore.showFlash(`Error deleting chunk: ${error}`, "error");
	}
}

async function _copyMixedChunkLeftToRight(chunk: LineChunk): Promise<void> {
	if (
		!$diffStore.rawDiff ||
		!$diffStore.highlightedDiff ||
		!$fileStore.leftFilePath ||
		!$fileStore.rightFilePath
	)
		return;

	try {
		// Start a single transaction for all operations
		await BeginOperationGroup("Copy mixed chunk left to right");

		try {
			// First, collect all operations we need to perform
			const deletions: Array<{ file: string; lineNumber: number }> = [];
			const copies: Array<{
				from: string;
				to: string;
				lineNumber: number;
				content: string;
			}> = [];

			// Process each line in the chunk based on its type
			for (let i = chunk.startIndex; i <= chunk.endIndex; i++) {
				const line = $diffStore.highlightedDiff.lines[i];

				if (line.type === "removed" && line.leftNumber !== null) {
					// Copy removed line from left to right
					copies.push({
						from: $fileStore.leftFilePath,
						to: $fileStore.rightFilePath,
						lineNumber: line.leftNumber,
						content: line.leftLine,
					});
				} else if (
					line.type === "modified" &&
					line.leftNumber !== null &&
					line.rightNumber !== null
				) {
					// For modified lines, delete the right version and copy the left version
					deletions.push({
						file: $fileStore.rightFilePath,
						lineNumber: line.rightNumber,
					});
					copies.push({
						from: $fileStore.leftFilePath,
						to: $fileStore.rightFilePath,
						lineNumber: line.rightNumber,
						content: line.leftLine,
					});
				} else if (line.type === "added" && line.rightNumber !== null) {
					// Delete added lines from right (copying "nothing" from left)
					deletions.push({
						file: $fileStore.rightFilePath,
						lineNumber: line.rightNumber,
					});
				}
			}

			// Sort deletions in descending order to avoid index shifting
			deletions.sort((a, b) => b.lineNumber - a.lineNumber);

			// Execute deletions first (from bottom to top)
			for (const deletion of deletions) {
				await RemoveLineFromFile(deletion.file, deletion.lineNumber);
			}

			// Then execute copies
			for (const copy of copies) {
				await CopyToFile(copy.from, copy.to, copy.lineNumber, copy.content);
			}

			// Commit the transaction
			await CommitOperationGroup();

			// Refresh the diff
			await compareBothFiles(true);
			await updateUnsavedChangesStatus();
		} catch (error) {
			// Rollback on error
			await RollbackOperationGroup();
			throw error;
		}
	} catch (error) {
		console.error("Error copying mixed chunk:", error);
		uiStore.showFlash(`Error copying chunk: ${error}`, "error");
	}
}

async function _copyMixedChunkRightToLeft(chunk: LineChunk): Promise<void> {
	if (
		!$diffStore.rawDiff ||
		!$diffStore.highlightedDiff ||
		!$fileStore.leftFilePath ||
		!$fileStore.rightFilePath
	)
		return;

	try {
		// Start a single transaction for all operations
		await BeginOperationGroup("Copy mixed chunk right to left");

		try {
			// First, collect all operations we need to perform
			const deletions: Array<{ file: string; lineNumber: number }> = [];
			const copies: Array<{
				from: string;
				to: string;
				lineNumber: number;
				content: string;
			}> = [];

			// Process each line in the chunk based on its type
			for (let i = chunk.startIndex; i <= chunk.endIndex; i++) {
				const line = $diffStore.highlightedDiff.lines[i];

				if (line.type === "added" && line.rightNumber !== null) {
					// Copy added line from right to left
					copies.push({
						from: $fileStore.rightFilePath,
						to: $fileStore.leftFilePath,
						lineNumber: line.rightNumber,
						content: line.rightLine,
					});
				} else if (
					line.type === "modified" &&
					line.leftNumber !== null &&
					line.rightNumber !== null
				) {
					// For modified lines, delete the left version and copy the right version
					deletions.push({
						file: $fileStore.leftFilePath,
						lineNumber: line.leftNumber,
					});
					copies.push({
						from: $fileStore.rightFilePath,
						to: $fileStore.leftFilePath,
						lineNumber: line.leftNumber,
						content: line.rightLine,
					});
				} else if (line.type === "removed" && line.leftNumber !== null) {
					// Delete removed lines from left (copying "nothing" from right)
					deletions.push({
						file: $fileStore.leftFilePath,
						lineNumber: line.leftNumber,
					});
				}
			}

			// Sort deletions in descending order to avoid index shifting
			deletions.sort((a, b) => b.lineNumber - a.lineNumber);

			// Execute deletions first (from bottom to top)
			for (const deletion of deletions) {
				await RemoveLineFromFile(deletion.file, deletion.lineNumber);
			}

			// Then execute copies
			for (const copy of copies) {
				await CopyToFile(copy.from, copy.to, copy.lineNumber, copy.content);
			}

			// Commit the transaction
			await CommitOperationGroup();

			// Refresh the diff
			await compareBothFiles(true);
			await updateUnsavedChangesStatus();
		} catch (error) {
			// Rollback on error
			await RollbackOperationGroup();
			throw error;
		}
	} catch (error) {
		console.error("Error copying mixed chunk:", error);
		uiStore.showFlash(`Error copying chunk: ${error}`, "error");
	}
}

async function _deleteLineFromRight(lineIndex: number): Promise<void> {
	if (!$diffStore.rawDiff || !$diffStore.rawDiff.lines[lineIndex]) return;

	const line = $diffStore.rawDiff.lines[lineIndex];
	if (line.type !== "added") return;

	try {
		const context = getDiffOperationContext();
		await diffOps.deleteLineFromRight(lineIndex, context);
	} catch (error) {
		console.error("Error deleting line from right:", error);
		uiStore.showFlash(`Error deleting line: ${error}`, "error");
	}
}

async function _deleteLineFromLeft(lineIndex: number): Promise<void> {
	if (!$diffStore.rawDiff || !$diffStore.rawDiff.lines[lineIndex]) return;

	const line = $diffStore.rawDiff.lines[lineIndex];
	if (line.type !== "removed") return;

	try {
		const context = getDiffOperationContext();
		await diffOps.deleteLineFromLeft(lineIndex, context);
	} catch (error) {
		console.error("Error deleting line from left:", error);
		uiStore.showFlash(`Error deleting line: ${error}`, "error");
	}
}

async function saveLeftFile(): Promise<void> {
	try {
		await unsavedChangesStore.saveLeft();
		uiStore.showFlash("Left file saved successfully", "info");
	} catch (error) {
		console.error("Error saving left file:", error);
		uiStore.showFlash(`Error saving left file: ${error}`, "error");
	}
}

async function saveRightFile(): Promise<void> {
	try {
		await unsavedChangesStore.saveRight();
		uiStore.showFlash("Right file saved successfully", "info");
	} catch (error) {
		console.error("Error saving right file:", error);
		uiStore.showFlash(`Error saving right file: ${error}`, "error");
	}
}

function handleKeydown(event: KeyboardEvent): void {
	const { leftFilePath, rightFilePath } = fileStore.getState();
	const { isComparing, hasCompletedComparison, showMenu } = uiStore.getState();

	handleKeyboardShortcut(
		event,
		{
			saveLeftFile,
			saveRightFile,
			jumpToNextDiff,
			jumpToPrevDiff,
			jumpToFirstDiff,
			jumpToLastDiff,
			copyCurrentDiffLeftToRight,
			copyCurrentDiffRightToLeft,
			undoLastChange,
			compareFiles: compareBothFiles,
			closeMenu: () => uiStore.setMenuVisible(false),
		},
		{
			leftFilePath,
			rightFilePath,
			isComparing,
			hasCompletedComparison,
			showMenu,
		},
	);
}

async function undoLastChange(): Promise<void> {
	if (undoManager) {
		await undoManager.undo();
	}
}

async function _highlightFileContent(
	content: string,
	filename: string,
): Promise<string[]> {
	if (!content.trim()) return [];
	if (!highlighter) return content.split("\n").map(escapeHtml);

	try {
		const ext = filename.split(".").pop()?.toLowerCase();
		const language = getLanguageFromExtension(ext || "");

		const highlighted = await highlighter.codeToHtml(content, {
			lang: language,
			theme: $uiStore.isDarkMode ? "catppuccin-macchiato" : "catppuccin-latte",
		});

		// Extract lines from the highlighted content
		const match = highlighted.match(
			/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/s,
		);
		if (match) {
			// Split by line breaks and clean up
			const lines = match[1].split("\n");
			return lines;
		}

		return content.split("\n").map(escapeHtml);
	} catch (error) {
		console.warn("Error highlighting content:", error);
		return content.split("\n").map(escapeHtml);
	}
}

async function _getHighlightedLine(
	line: string,
	filename: string,
): Promise<string> {
	if (!line.trim()) return line;
	if (!highlighter) return escapeHtml(line);

	try {
		const ext = filename.split(".").pop()?.toLowerCase();
		const language = getLanguageFromExtension(ext || "");

		// Create a timeout promise
		const timeoutPromise = new Promise<string>((_, reject) => {
			setTimeout(() => reject(new Error("Highlighting timeout")), 1000);
		});

		// Race between highlighting and timeout
		const highlightPromise = highlighter.codeToHtml(line, {
			lang: language,
			theme: $uiStore.isDarkMode ? "catppuccin-macchiato" : "catppuccin-latte",
		});

		const highlighted = await Promise.race([highlightPromise, timeoutPromise]);

		// Extract just the content from the <pre><code> wrapper
		const match = highlighted.match(
			/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/s,
		);
		return match ? match[1] : highlighted;
	} catch (error) {
		console.warn(
			"Error highlighting line:",
			error,
			"Line:",
			line.substring(0, 50),
		);
		return escapeHtml(line);
	}
}

function isLineInChunk(lineIndex: number, chunk: LineChunk): boolean {
	return lineIndex >= chunk.startIndex && lineIndex <= chunk.endIndex;
}

function _isFirstLineOfChunk(lineIndex: number, chunk: LineChunk): boolean {
	return lineIndex === chunk.startIndex;
}

function _getChunkForLine(lineIndex: number): LineChunk | null {
	return lineChunks.find((chunk) => isLineInChunk(lineIndex, chunk)) || null;
}

function _isFirstOfConsecutiveModified(lineIndex: number): boolean {
	if (
		!$diffStore.highlightedDiff ||
		lineIndex >= $diffStore.highlightedDiff.lines.length
	)
		return false;

	const currentLine = $diffStore.highlightedDiff.lines[lineIndex];
	if (currentLine.type !== "modified") return false;

	// Check if previous line is not modified
	if (lineIndex === 0) return true;
	const prevLine = $diffStore.highlightedDiff.lines[lineIndex - 1];
	return prevLine.type !== "modified";
}

async function copyCurrentDiffLeftToRight(): Promise<void> {
	if (
		$diffStore.currentChunkIndex === -1 ||
		!$diffChunks ||
		!$diffChunks[$diffStore.currentChunkIndex]
	) {
		return;
	}

	const chunk = $diffChunks[$diffStore.currentChunkIndex];

	// Find ALL non-same lineChunks that overlap with the diffChunk
	const overlappingLineChunks = lineChunks.filter(
		(lc) =>
			lc.type !== "same" &&
			lc.startIndex <= chunk.endIndex &&
			lc.endIndex >= chunk.startIndex,
	);

	if (overlappingLineChunks.length === 0) {
		return;
	}

	// Store the current position before copying
	const oldChunkIndex = $diffStore.currentChunkIndex;
	const totalChunks = $diffChunks.length;

	// For mixed chunks, we need to handle them as a single operation
	// Create a synthetic chunk that covers the entire diff chunk
	const syntheticChunk: LineChunk = {
		type: "mixed", // This is a special type for our handling
		startIndex: chunk.startIndex,
		endIndex: chunk.endIndex,
	};

	// Process the entire chunk as one operation
	await _copyMixedChunkLeftToRight(syntheticChunk);

	// Wait a bit for the diff to be recalculated before navigating
	setTimeout(() => {
		navigateAfterCopy(oldChunkIndex, totalChunks);
	}, 100);
}

async function copyCurrentDiffRightToLeft(): Promise<void> {
	if (
		$diffStore.currentChunkIndex === -1 ||
		!$diffChunks ||
		!$diffChunks[$diffStore.currentChunkIndex]
	) {
		return;
	}

	const chunk = $diffChunks[$diffStore.currentChunkIndex];

	// Find ALL non-same lineChunks that overlap with the diffChunk
	const overlappingLineChunks = lineChunks.filter(
		(lc) =>
			lc.type !== "same" &&
			lc.startIndex <= chunk.endIndex &&
			lc.endIndex >= chunk.startIndex,
	);

	if (overlappingLineChunks.length === 0) {
		return;
	}

	// Store the current position before copying
	const oldChunkIndex = $diffStore.currentChunkIndex;
	const totalChunks = $diffChunks.length;

	// For mixed chunks, we need to handle them as a single operation
	// Create a synthetic chunk that covers the entire diff chunk
	const syntheticChunk: LineChunk = {
		type: "mixed", // This is a special type for our handling
		startIndex: chunk.startIndex,
		endIndex: chunk.endIndex,
	};

	// Process the entire chunk as one operation
	await _copyMixedChunkRightToLeft(syntheticChunk);

	// Wait a bit for the diff to be recalculated before navigating
	setTimeout(() => {
		navigateAfterCopy(oldChunkIndex, totalChunks);
	}, 100);
}

function navigateAfterCopy(
	oldChunkIndex: number,
	oldTotalChunks: number,
): void {
	navigationStore.navigateAfterCopy(oldChunkIndex, oldTotalChunks);
}

// ===========================================
// MINIMAP VIEWPORT DRAGGING
// ===========================================

function _handleViewportMouseDown(event: MouseEvent): void {
	// TODO: This functionality needs to be moved to DiffViewer component
	// For now, just prevent default behavior
	event.preventDefault();
}

function _handleViewportDrag(event: MouseEvent): void {
	// TODO: This functionality needs to be moved to DiffViewer component
	event.preventDefault();
}

function _handleViewportMouseUp(): void {
	// TODO: This functionality needs to be moved to DiffViewer component
	uiStore.setDraggingViewport(false);
}

function playInvalidSound(): void {
	// Create a simple beep sound
	const audioContext =
		new // biome-ignore lint/suspicious/noExplicitAny: webkitAudioContext is for browser compatibility
		(window.AudioContext || (window as any).webkitAudioContext)();
	const oscillator = audioContext.createOscillator();
	const gainNode = audioContext.createGain();

	oscillator.connect(gainNode);
	gainNode.connect(audioContext.destination);

	oscillator.frequency.value = 200; // Low frequency for error sound
	oscillator.type = "sine";
	gainNode.gain.value = 0.1; // Low volume

	oscillator.start();
	oscillator.stop(audioContext.currentTime + 0.1); // 100ms beep
}

function jumpToNextDiff(): void {
	navigationStore.jumpToNextDiff();
}

function jumpToPrevDiff(): void {
	navigationStore.jumpToPrevDiff();
}

function jumpToFirstDiff(): void {
	navigationStore.jumpToFirstDiff();
}

function jumpToLastDiff(): void {
	navigationStore.jumpToLastDiff();
}

function scrollToLine(lineIndex: number, chunkIndex?: number): void {
	if (diffViewerComponent?.scrollToLine) {
		diffViewerComponent.scrollToLine(lineIndex, chunkIndex);
	}
}

function _handleChunkClick(event: {
	chunkIndex: number;
	lineIndex: number;
}): void {
	const { chunkIndex } = event;

	// Update the current diff chunk index
	diffStore.setCurrentChunkIndex(chunkIndex);
	// Don't scroll - just highlight the chunk where it is
}

function _handleChunkMouseEnter(lineIndex: number): void {
	// Find which chunk this line belongs to
	const chunkIndex = $diffChunks.findIndex(
		(chunk) => lineIndex >= chunk.startIndex && lineIndex <= chunk.endIndex,
	);

	if (chunkIndex !== -1) {
		uiStore.setHoveredChunkIndex(chunkIndex);
	}
}

function _handleChunkMouseLeave(): void {
	uiStore.setHoveredChunkIndex(-1);
}

// Handler functions for arrow button clicks that include navigation
// biome-ignore lint/correctness/noUnusedVariables: Used in template
async function handleCopyChunkToRight(
	event: CustomEvent<LineChunk>,
): Promise<void> {
	const chunk = event.detail;
	// Find which chunk index this is for navigation
	const chunkIndex = $diffChunks.findIndex(
		(c) => c.startIndex === chunk.startIndex && c.endIndex === chunk.endIndex,
	);

	// Store the current state for navigation
	const oldChunkIndex = chunkIndex;
	const totalChunks = $diffChunks.length;

	// Update current chunk index
	if (chunkIndex !== -1) {
		diffStore.setCurrentChunkIndex(chunkIndex);
	}

	// Perform the copy operation
	await _copyChunkToRight(chunk);

	// Navigate after copy
	setTimeout(() => {
		navigateAfterCopy(oldChunkIndex, totalChunks);
	}, 100);
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
async function handleCopyChunkToLeft(
	event: CustomEvent<LineChunk>,
): Promise<void> {
	const chunk = event.detail;
	// Find which chunk index this is for navigation
	const chunkIndex = $diffChunks.findIndex(
		(c) => c.startIndex === chunk.startIndex && c.endIndex === chunk.endIndex,
	);

	// Store the current state for navigation
	const oldChunkIndex = chunkIndex;
	const totalChunks = $diffChunks.length;

	// Update current chunk index
	if (chunkIndex !== -1) {
		diffStore.setCurrentChunkIndex(chunkIndex);
	}

	// Perform the copy operation
	await _copyChunkToLeft(chunk);

	// Navigate after copy
	setTimeout(() => {
		navigateAfterCopy(oldChunkIndex, totalChunks);
	}, 100);
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
async function handleCopyModifiedChunkToRight(
	event: CustomEvent<LineChunk>,
): Promise<void> {
	const chunk = event.detail;
	// Find which chunk index this is for navigation
	const chunkIndex = $diffChunks.findIndex(
		(c) => c.startIndex === chunk.startIndex && c.endIndex === chunk.endIndex,
	);

	// Store the current state for navigation
	const oldChunkIndex = chunkIndex;
	const totalChunks = $diffChunks.length;

	// Update current chunk index
	if (chunkIndex !== -1) {
		diffStore.setCurrentChunkIndex(chunkIndex);
	}

	// Perform the copy operation
	await _copyModifiedChunkToRight(chunk);

	// Navigate after copy
	setTimeout(() => {
		navigateAfterCopy(oldChunkIndex, totalChunks);
	}, 100);
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
async function handleCopyModifiedChunkToLeft(
	event: CustomEvent<LineChunk>,
): Promise<void> {
	const chunk = event.detail;
	// Find which chunk index this is for navigation
	const chunkIndex = $diffChunks.findIndex(
		(c) => c.startIndex === chunk.startIndex && c.endIndex === chunk.endIndex,
	);

	// Store the current state for navigation
	const oldChunkIndex = chunkIndex;
	const totalChunks = $diffChunks.length;

	// Update current chunk index
	if (chunkIndex !== -1) {
		diffStore.setCurrentChunkIndex(chunkIndex);
	}

	// Perform the copy operation
	await _copyModifiedChunkToLeft(chunk);

	// Navigate after copy
	setTimeout(() => {
		navigateAfterCopy(oldChunkIndex, totalChunks);
	}, 100);
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
async function handleDeleteChunkFromRight(
	event: CustomEvent<LineChunk>,
): Promise<void> {
	const chunk = event.detail;
	// Find which chunk index this is for navigation
	const chunkIndex = $diffChunks.findIndex(
		(c) => c.startIndex === chunk.startIndex && c.endIndex === chunk.endIndex,
	);

	// Store the current state for navigation
	const oldChunkIndex = chunkIndex;
	const totalChunks = $diffChunks.length;

	// Update current chunk index
	if (chunkIndex !== -1) {
		diffStore.setCurrentChunkIndex(chunkIndex);
	}

	// Perform the delete operation
	await _deleteChunkFromRight(chunk);

	// Navigate after copy
	setTimeout(() => {
		navigateAfterCopy(oldChunkIndex, totalChunks);
	}, 100);
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
async function handleDeleteChunkFromLeft(
	event: CustomEvent<LineChunk>,
): Promise<void> {
	const chunk = event.detail;
	// Find which chunk index this is for navigation
	const chunkIndex = $diffChunks.findIndex(
		(c) => c.startIndex === chunk.startIndex && c.endIndex === chunk.endIndex,
	);

	// Store the current state for navigation
	const oldChunkIndex = chunkIndex;
	const totalChunks = $diffChunks.length;

	// Update current chunk index
	if (chunkIndex !== -1) {
		diffStore.setCurrentChunkIndex(chunkIndex);
	}

	// Perform the delete operation
	await _deleteChunkFromLeft(chunk);

	// Navigate after copy
	setTimeout(() => {
		navigateAfterCopy(oldChunkIndex, totalChunks);
	}, 100);
}

// Set initial diff chunk when diff result loads
$: if (
	$diffStore.highlightedDiff &&
	$diffChunks.length > 0 &&
	$diffStore.currentChunkIndex === -1
) {
	const firstDiffIndex = $diffStore.highlightedDiff.lines.findIndex(
		(line) => line.type !== "same",
	);

	if (firstDiffIndex !== -1) {
		// Set to the first diff chunk
		diffStore.setCurrentChunkIndex(0);
		// Trigger initial scroll after a small delay to ensure DOM is ready
		setTimeout(() => {
			if ($diffChunks[0]) {
				scrollToLine($diffChunks[0].startIndex, 0);
			}
		}, 150);
	}
}

// Scroll sync handlers
function _syncLeftScroll(): void {
	scrollSync.syncFromLeft({
		onSyncComplete: () => {
			updateMinimapViewport();
		},
	});
}

function _syncRightScroll(): void {
	scrollSync.syncFromRight({
		onSyncComplete: () => {
			updateMinimapViewport();
		},
	});
}

function _syncCenterScroll(): void {
	scrollSync.syncFromCenter({
		onSyncComplete: () => {
			updateMinimapViewport();
		},
	});
}

onMount(async () => {
	// Set up navigation callbacks
	navigationStore.setCallbacks({
		scrollToLine,
		playInvalidSound,
	});

	// Clear any corrupted cache
	highlightCache.clear();
	setHighlightedDiffWithChunks(null); // Force refresh of highlighted content

	// Also clear cache when theme changes
	document.addEventListener("themeChange", () => {
		highlightCache.clear();
		setHighlightedDiffWithChunks(null);
	});

	// Initialize theme from localStorage or default to dark
	// Theme is already initialized in uiStore

	// Add event listeners
	document.addEventListener("keydown", handleKeydown);
	EventsOn("show-quit-dialog", handleQuitDialog);

	// Menu event handlers
	EventsOn("menu-save-left", saveLeftFile);
	EventsOn("menu-save-right", saveRightFile);
	EventsOn("menu-save-all", async () => {
		// Save both files if they have unsaved changes
		await unsavedChangesStore.saveAll();
	});
	EventsOn("menu-discard-all", _handleDiscardChanges);
	EventsOn("menu-prev-diff", jumpToPrevDiff);
	EventsOn("menu-next-diff", jumpToNextDiff);
	EventsOn("menu-first-diff", jumpToFirstDiff);
	EventsOn("menu-last-diff", jumpToLastDiff);

	// Check for initial files from command line
	try {
		const initialFiles = await GetInitialFiles();
		if (initialFiles && initialFiles.leftFile && initialFiles.rightFile) {
			fileStore.setBothFiles(initialFiles.leftFile, initialFiles.rightFile);

			// Automatically compare the files
			await compareBothFiles();
			// Update menu state
			await updateUnsavedChangesStatus();
		}
	} catch (error) {
		console.error("Error getting initial files:", error);
	}

	// Syntax highlighting disabled for performance
	// TODO: Re-enable when we can make it performant (web workers, etc.)
	highlighter = null;

	// Set up ResizeObserver to detect scrollbar changes with debouncing
	let resizeTimeout: number;
	const resizeObserver = new ResizeObserver(() => {
		clearTimeout(resizeTimeout);
		resizeTimeout = setTimeout(() => {
			checkHorizontalScrollbar();
		}, 100);
	});

	// TODO: ResizeObserver functionality needs to be moved to DiffViewer component
	// For now, just call checkHorizontalScrollbar
	setTimeout(() => {
		checkHorizontalScrollbar();
	}, 0);

	// Click outside handler for menu
	function handleClickOutside(event: MouseEvent): void {
		const target = event.target as HTMLElement;
		const menuContainer = document.querySelector(".menu-container");
		if (menuContainer && !menuContainer.contains(target)) {
			uiStore.setMenuVisible(false);
		}
	}
	document.addEventListener("click", handleClickOutside);

	// Listen for minimap toggle event from menu
	EventsOn("toggle-minimap", (visible: boolean) => {
		uiStore.setMinimapVisible(visible);
	});

	// Get initial minimap visibility state
	GetMinimapVisible().then((visible) => {
		uiStore.setMinimapVisible(visible);
	});

	// Initialize menu state
	updateUnsavedChangesStatus();

	// Cleanup on destroy
	return () => {
		document.removeEventListener("keydown", handleKeydown);
		document.removeEventListener("click", handleClickOutside);
		if (highlighter) {
			highlighter.dispose?.();
		}
		clearTimeout(resizeTimeout);
		resizeObserver.disconnect();
	};
});

function checkHorizontalScrollbar() {
	// TODO: This functionality needs to be moved to DiffViewer component
	// For now, just set to false
	uiStore.setHorizontalScrollbar(false);
}
</script>

<main>
  <div class="header">
    <FileSelector
      leftFilePath={$fileStore.leftFilePath}
      rightFilePath={$fileStore.rightFilePath}
      leftFileName={$fileStore.leftFileName}
      rightFileName={$fileStore.rightFileName}
      isDarkMode={$uiStore.isDarkMode}
      isComparing={$uiStore.isComparing}
      hasCompletedComparison={$uiStore.hasCompletedComparison}
      on:leftFileSelected={handleLeftFileSelected}
      on:rightFileSelected={handleRightFileSelected}
      on:compare={compareBothFiles}
      on:error={handleError}
    >
      <Menu 
        slot="menu"
        hasAnyUnsavedChanges={$hasAnyUnsavedChanges}
        onDiscardChanges={_handleDiscardChanges}
        onToggleDarkMode={_toggleDarkMode}
      />
    </FileSelector>
    
    {#if $uiStore.flashMessage}
      <FlashMessage 
        message={$uiStore.flashMessage.message}
        type={$uiStore.flashMessage.type}
      />
    {/if}
  </div>

  <DiffViewer
    bind:this={diffViewerComponent}
    leftFilePath={$fileStore.leftFilePath}
    rightFilePath={$fileStore.rightFilePath}
    diffResult={$diffStore.highlightedDiff}
    hasUnsavedLeftChanges={$hasUnsavedLeftChanges}
    hasUnsavedRightChanges={$hasUnsavedRightChanges}
    currentDiffChunkIndex={$diffStore.currentChunkIndex}
    hoveredChunkIndex={$uiStore.hoveredChunkIndex}
    showMinimap={$uiStore.showMinimap}
    isComparing={$uiStore.isComparing}
    hasCompletedComparison={$uiStore.hasCompletedComparison}
    lineNumberWidth={$lineNumberWidth}
    diffChunks={$diffChunks}
    on:saveLeft={saveLeftFile}
    on:saveRight={saveRightFile}
    on:copyLineToLeft={(e) => copyLineToLeft(e.detail)}
    on:copyLineToRight={(e) => copyLineToRight(e.detail)}
    on:copyChunkToLeft={handleCopyChunkToLeft}
    on:copyChunkToRight={handleCopyChunkToRight}
    on:copyModifiedChunkToLeft={handleCopyModifiedChunkToLeft}
    on:copyModifiedChunkToRight={handleCopyModifiedChunkToRight}
    on:deleteChunkFromLeft={handleDeleteChunkFromLeft}
    on:deleteChunkFromRight={handleDeleteChunkFromRight}
    on:chunkClick={(e) => _handleChunkClick(e.detail)}
    on:chunkHover={(e) => _handleChunkMouseEnter(e.detail)}
    on:chunkLeave={_handleChunkMouseLeave}
    on:minimapClick={(e) => _handleMinimapClick(e.detail)}
    on:viewportMouseDown={(e) => _handleViewportMouseDown(e.detail)}
  />

  <!-- UndoManager (headless component) -->
  <UndoManager
    bind:this={undoManager}
    on:statusUpdate={(e) => e.detail.message}
    on:undoStateChanged={async () => {
      // Re-fetch diff after undo
      if ($bothFilesSelected) {
        await compareBothFiles(true);
        await updateUnsavedChangesStatus();
      }
    }}
  />

  <!-- Quit Dialog Modal -->
  <QuitDialog
    show={$uiStore.showQuitDialog}
    quitDialogFiles={$uiStore.quitDialogFiles}
    leftFilePath={$fileStore.leftFilePath}
    rightFilePath={$fileStore.rightFilePath}
    bind:fileSelections
    on:saveAndQuit={_handleSaveAndQuit}
    on:quitWithoutSaving={_handleQuitWithoutSaving}
    on:cancel={() => uiStore.hideQuitDialog()}
  />
</main>

<style>
  :global(html) {
    transition: background-color 0.3s ease, color 0.3s ease;
  }

  *, *::before, *::after {
  }
  
  main {
    height: 100vh;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.3s ease;
    background: #eff1f5;
    color: #4c4f69;
  }

  /* Catppuccin Macchiato (Dark Mode) */
  :global([data-theme="dark"]) main {
    background: #24273a;
    color: #cad3f5;
  }

  :global([data-theme="dark"]) .header {
    background: #1e2030;
    border-bottom-color: #363a4f;
  }








  .header {
    padding: 1rem;
    border-bottom: 1px solid #9ca0b0;
    background: #e6e9ef;
    position: relative;
  }

  /* Custom scrollbar styling for light mode (Catppuccin Latte) */
  ::-webkit-scrollbar {
    width: 5px;
    height: 5px;
  }

  ::-webkit-scrollbar-track {
    background: rgba(220, 224, 232, 0.15);
  }

  ::-webkit-scrollbar-thumb {
    background: #acb0be;
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #6c6f85;
  }

  ::-webkit-scrollbar-corner {
    background: #dce0e8;
  }

  /* Custom scrollbar styling for dark mode (Catppuccin Macchiato) */
  :global([data-theme="dark"]) ::-webkit-scrollbar-track {
    background: rgba(54, 58, 79, 0.15);
  }

  :global([data-theme="dark"]) ::-webkit-scrollbar-thumb {
    background: #363a4f;
    border-radius: 3px;
  }

  :global([data-theme="dark"]) ::-webkit-scrollbar-thumb:hover {
    background: #5b6078;
  }

  :global([data-theme="dark"]) ::-webkit-scrollbar-corner {
    background: rgba(54, 58, 79, 0.15);
  }


  /* ===========================================
   * MINIMAP STYLES
   * =========================================== */


</style>
