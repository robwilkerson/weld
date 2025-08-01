<script lang="ts">
import { onMount } from "svelte";
import {
	BeginOperationGroup,
	CommitOperationGroup,
	CompareFiles,
	CopyToFile,
	DiscardAllChanges,
	GetInitialFiles,
	GetMinimapVisible,
	HasUnsavedChanges,
	QuitWithoutSaving,
	RemoveLineFromFile,
	RollbackOperationGroup,
	SaveChanges,
	SaveSelectedFilesAndQuit,
	UpdateDiffNavigationMenuItems,
	UpdateSaveMenuItems,
} from "../wailsjs/go/main/App.js";
import { EventsOn } from "../wailsjs/runtime/runtime.js";
// biome-ignore lint/correctness/noUnusedImports: Used in Svelte template
import DiffViewer from "./components/DiffViewer.svelte";
// biome-ignore lint/correctness/noUnusedImports: Used in Svelte template
import FileSelector from "./components/FileSelector.svelte";
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
import type {
	DiffLine,
	DiffResult,
	HighlightedDiffLine,
	HighlightedDiffResult,
	LineChunk,
} from "./types/diff.js";
import { computeInlineDiff, escapeHtml } from "./utils/diff.js";
import * as diffOps from "./utils/diffOperations.js";
// biome-ignore lint/correctness/noUnusedImports: Used in Svelte template
import { getFileIcon, getFileTypeName } from "./utils/fileIcons.js";
import { handleKeydown as handleKeyboardShortcut } from "./utils/keyboard.js";
import { getLanguageFromExtension } from "./utils/language.js";
import { detectLineChunks } from "./utils/lineChunks.js";
// biome-ignore lint/correctness/noUnusedImports: Used in Svelte template
import { getDisplayPath } from "./utils/path.js";
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
let _isComparing: boolean = false;
let _errorMessage: string = "";
// biome-ignore lint/correctness/noUnusedVariables: Keep for backward compatibility during migration
const isScrollSyncing: boolean = false;
// Initialize theme immediately to prevent flash
let isDarkMode: boolean = (() => {
	if (typeof localStorage !== "undefined") {
		const savedTheme = localStorage.getItem("theme");
		return savedTheme ? savedTheme === "dark" : true;
	}
	return true; // Default to dark mode
})();

// Set theme immediately
if (typeof document !== "undefined") {
	document.documentElement.setAttribute(
		"data-theme",
		isDarkMode ? "dark" : "light",
	);
}
let _hasUnsavedLeftChanges: boolean = false;
let _hasUnsavedRightChanges: boolean = false;
let _hasHorizontalScrollbar: boolean = false;
let _hasCompletedComparison: boolean = false;

// Quit dialog state
let _showQuitDialog: boolean = false;
let _quitDialogFiles: string[] = [];
let fileSelections: Record<string, boolean> = {};

// Menu state
let _showMenu: boolean = false;

// Current diff tracking is now managed by diffStore

// Hover tracking for chunks
let hoveredChunkIndex: number = -1;

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
	if (
		hoveredChunkIndex === -1 ||
		!diffChunks ||
		!diffChunks[hoveredChunkIndex]
	) {
		return false;
	}

	const chunk = diffChunks[hoveredChunkIndex];
	const isInChunk =
		lineIndex >= chunk.startIndex && lineIndex <= chunk.endIndex;

	return isInChunk;
};

// Diff chunks will be computed reactively after highlightedDiffResult is declared

// Update diff navigation menu items whenever diff state changes
$: {
	UpdateDiffNavigationMenuItems(
		$diffNavigation.hasPrevDiff,
		$diffNavigation.hasNextDiff,
	);
}

// isSameFile is now a derived store from fileStore

// Only show "files are identical" banner if they're identical on disk
$: areFilesIdentical =
	$diffStore.rawDiff?.lines &&
	$diffStore.rawDiff.lines.length > 0 &&
	$diffStore.rawDiff.lines.every((line) => line.type === "same") &&
	!$isSameFile;

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
let _isDraggingViewport = false;
const _dragStartY = 0;
const _dragStartScrollTop = 0;

// Minimap visibility state
let _showMinimap = true;

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

// Update unsaved changes status
async function updateUnsavedChangesStatus(): Promise<void> {
	const { leftFilePath, rightFilePath } = fileStore.getState();
	if (leftFilePath) {
		_hasUnsavedLeftChanges = await HasUnsavedChanges(leftFilePath);
	}
	if (rightFilePath) {
		_hasUnsavedRightChanges = await HasUnsavedChanges(rightFilePath);
	}

	// Update menu items in the backend
	await UpdateSaveMenuItems(_hasUnsavedLeftChanges, _hasUnsavedRightChanges);
}

// Quit dialog functions
function handleQuitDialog(unsavedFiles: string[]): void {
	_quitDialogFiles = unsavedFiles;
	_showQuitDialog = true;

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
		_errorMessage = `Error saving files: ${error}`;
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
	_errorMessage = `Left file selected: ${fileStore.getState().leftFileName}`;
	diffStore.clear(); // Clear previous results
	_hasCompletedComparison = false; // Reset comparison state
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleError(event: CustomEvent<{ message: string }>) {
	_errorMessage = event.detail.message;
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
async function handleRightFileSelected(event: CustomEvent<{ path: string }>) {
	const path = event.detail.path;
	fileStore.setRightFile(path);
	await updateUnsavedChangesStatus();
	_errorMessage = `Right file selected: ${fileStore.getState().rightFileName}`;
	diffStore.clear(); // Clear previous results
	_hasCompletedComparison = false; // Reset comparison state
}

async function compareBothFiles(
	preserveCurrentDiff: boolean = false,
): Promise<void> {
	const { leftFilePath, rightFilePath } = fileStore.getState();
	if (!leftFilePath || !rightFilePath) {
		_errorMessage = "Please select both files before comparing";
		return;
	}

	try {
		_isComparing = true;
		_errorMessage = "";
		if (!preserveCurrentDiff) {
			diffStore.setCurrentChunkIndex(-1); // Reset current diff tracking only when not preserving
		}

		const result = await CompareFiles(leftFilePath, rightFilePath);
		diffStore.setRawDiff(result);

		if (!result || !result.lines) {
			_errorMessage = "No comparison result received";
			diffStore.setRawDiff(null);
		} else if (result.lines.length === 0) {
			_errorMessage = "Files are identical";
		}

		// Mark comparison as completed
		_hasCompletedComparison = true;

		// Check for horizontal scrollbar after diff is loaded
		setTimeout(() => {
			checkHorizontalScrollbar();
		}, 100);
	} catch (error) {
		console.error("Comparison error:", error);
		_errorMessage = `Error comparing files: ${error}`;
		diffStore.clear();
	} finally {
		_isComparing = false;
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
	isDarkMode = !isDarkMode;
	const theme = isDarkMode ? "dark" : "light";
	document.documentElement.setAttribute("data-theme", theme);
	localStorage.setItem("theme", theme);
	// Clear highlight cache when theme changes since highlighting depends on theme
	highlightCache.clear();
	// Re-process highlighting with new theme if we have content
	if ($diffStore.rawDiff) {
		processHighlighting($diffStore.rawDiff);
	}

	// Close menu after toggling
	_showMenu = false;
}

async function _handleDiscardChanges(): Promise<void> {
	try {
		_errorMessage = "Discarding all changes...";

		// Clear the cache
		await DiscardAllChanges();

		// Refresh the comparison
		await compareBothFiles();
		await updateUnsavedChangesStatus();

		_errorMessage = "All changes discarded";
		_showMenu = false;
	} catch (error) {
		console.error("Error discarding changes:", error);
		_errorMessage = `Error discarding changes: ${error}`;
	}
}

async function copyLineToRight(lineIndex: number): Promise<void> {
	if (!$diffStore.rawDiff || !$diffStore.rawDiff.lines[lineIndex]) return;

	const line = $diffStore.rawDiff.lines[lineIndex];
	if (line.type !== "removed") return;

	try {
		_errorMessage = "Copying line to right file...";
		const context = getDiffOperationContext();
		await diffOps.copyLineToRight(lineIndex, context);
		_errorMessage = "Line copied successfully";
	} catch (error) {
		console.error("Error copying line to right:", error);
		_errorMessage = `Error copying line: ${error}`;
	}
}

async function copyLineToLeft(lineIndex: number): Promise<void> {
	if (!$diffStore.rawDiff || !$diffStore.rawDiff.lines[lineIndex]) return;

	const line = $diffStore.rawDiff.lines[lineIndex];
	if (line.type !== "added") return;

	try {
		_errorMessage = "Copying line to left file...";
		const context = getDiffOperationContext();
		await diffOps.copyLineToLeft(lineIndex, context);
		_errorMessage = "Line copied successfully";
	} catch (error) {
		console.error("Error copying line to left:", error);
		_errorMessage = `Error copying line: ${error}`;
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
		_errorMessage = "Copying chunk to right file...";
		const context = getDiffOperationContext();
		await diffOps.copyChunkToRight(chunk, context);
		_errorMessage = "Chunk copied successfully";
	} catch (error) {
		console.error("Error copying chunk to right:", error);
		_errorMessage = `Error copying chunk: ${error}`;
	}
}

async function _copyChunkToLeft(chunk: LineChunk): Promise<void> {
	if (!$diffStore.rawDiff || !$diffStore.highlightedDiff) return;

	try {
		_errorMessage = "Copying chunk to left file...";
		const context = getDiffOperationContext();
		await diffOps.copyChunkToLeft(chunk, context);
		_errorMessage = "Chunk copied successfully";
	} catch (error) {
		console.error("Error copying chunk to left:", error);
		_errorMessage = `Error copying chunk: ${error}`;
	}
}

async function _copyModifiedChunkToRight(chunk: LineChunk): Promise<void> {
	if (!$diffStore.rawDiff || !$diffStore.highlightedDiff) return;

	try {
		_errorMessage = "Copying modified chunk to right file...";
		const context = getDiffOperationContext();
		await diffOps.copyModifiedChunkToRight(chunk, context);
		_errorMessage = "Modified chunk copied to right successfully";
	} catch (error) {
		console.error("Error copying modified chunk to right:", error);
		_errorMessage = `Error copying chunk: ${error}`;
	}
}

async function _copyModifiedChunkToLeft(chunk: LineChunk): Promise<void> {
	if (!$diffStore.rawDiff || !$diffStore.highlightedDiff) return;

	try {
		_errorMessage = "Copying modified chunk to left file...";
		const context = getDiffOperationContext();
		await diffOps.copyModifiedChunkToLeft(chunk, context);
		_errorMessage = "Modified chunk copied to left successfully";
	} catch (error) {
		console.error("Error copying modified chunk to left:", error);
		_errorMessage = `Error copying chunk: ${error}`;
	}
}

async function _deleteChunkFromRight(chunk: LineChunk): Promise<void> {
	if (!$diffStore.rawDiff || !$diffStore.highlightedDiff) return;

	try {
		_errorMessage = "Deleting chunk from right file...";
		const context = getDiffOperationContext();
		await diffOps.deleteChunkFromRight(chunk, context);
		_errorMessage = "Chunk deleted successfully";
	} catch (error) {
		console.error("Error deleting chunk from right:", error);
		_errorMessage = `Error deleting chunk: ${error}`;
	}
}

async function _deleteChunkFromLeft(chunk: LineChunk): Promise<void> {
	if (!$diffStore.rawDiff || !$diffStore.highlightedDiff) return;

	try {
		_errorMessage = "Deleting chunk from left file...";
		const context = getDiffOperationContext();
		await diffOps.deleteChunkFromLeft(chunk, context);
		_errorMessage = "Chunk deleted successfully";
	} catch (error) {
		console.error("Error deleting chunk from left:", error);
		_errorMessage = `Error deleting chunk: ${error}`;
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
		_errorMessage = "Copying mixed chunk from left to right...";

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
						lineNumber: line.leftNumber,
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

			_errorMessage = "Mixed chunk copied successfully";
		} catch (error) {
			// Rollback on error
			await RollbackOperationGroup();
			throw error;
		}
	} catch (error) {
		console.error("Error copying mixed chunk:", error);
		_errorMessage = `Error copying chunk: ${error}`;
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
		_errorMessage = "Copying mixed chunk from right to left...";

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
						lineNumber: line.rightNumber,
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

			_errorMessage = "Mixed chunk copied successfully";
		} catch (error) {
			// Rollback on error
			await RollbackOperationGroup();
			throw error;
		}
	} catch (error) {
		console.error("Error copying mixed chunk:", error);
		_errorMessage = `Error copying chunk: ${error}`;
	}
}

async function _deleteLineFromRight(lineIndex: number): Promise<void> {
	if (!$diffStore.rawDiff || !$diffStore.rawDiff.lines[lineIndex]) return;

	const line = $diffStore.rawDiff.lines[lineIndex];
	if (line.type !== "added") return;

	try {
		_errorMessage = "Deleting line from right file...";
		const context = getDiffOperationContext();
		await diffOps.deleteLineFromRight(lineIndex, context);
		_errorMessage = "Line deleted successfully";
	} catch (error) {
		console.error("Error deleting line from right:", error);
		_errorMessage = `Error deleting line: ${error}`;
	}
}

async function _deleteLineFromLeft(lineIndex: number): Promise<void> {
	if (!$diffStore.rawDiff || !$diffStore.rawDiff.lines[lineIndex]) return;

	const line = $diffStore.rawDiff.lines[lineIndex];
	if (line.type !== "removed") return;

	try {
		_errorMessage = "Deleting line from left file...";
		const context = getDiffOperationContext();
		await diffOps.deleteLineFromLeft(lineIndex, context);
		_errorMessage = "Line deleted successfully";
	} catch (error) {
		console.error("Error deleting line from left:", error);
		_errorMessage = `Error deleting line: ${error}`;
	}
}

async function saveLeftFile(): Promise<void> {
	try {
		const { leftFilePath } = fileStore.getState();
		await SaveChanges(leftFilePath);
		await updateUnsavedChangesStatus();
		_errorMessage = "Left file saved successfully";
	} catch (error) {
		console.error("Error saving left file:", error);
		_errorMessage = `Error saving left file: ${error}`;
	}
}

async function saveRightFile(): Promise<void> {
	try {
		const { rightFilePath } = fileStore.getState();
		await SaveChanges(rightFilePath);
		await updateUnsavedChangesStatus();
		_errorMessage = "Right file saved successfully";
	} catch (error) {
		console.error("Error saving right file:", error);
		_errorMessage = `Error saving right file: ${error}`;
	}
}

function handleKeydown(event: KeyboardEvent): void {
	// Handle Escape key to close menu
	if (event.key === "Escape" && _showMenu) {
		event.preventDefault();
		_showMenu = false;
		return;
	}

	handleKeyboardShortcut(
		event,
		{
			saveLeftFile,
			saveRightFile,
			jumpToNextDiff,
			jumpToPrevDiff,
			copyCurrentDiffLeftToRight,
			copyCurrentDiffRightToLeft,
			undoLastChange,
		},
		fileStore.getState().leftFilePath,
		fileStore.getState().rightFilePath,
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
			theme: isDarkMode ? "catppuccin-macchiato" : "catppuccin-latte",
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
			theme: isDarkMode ? "catppuccin-macchiato" : "catppuccin-latte",
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
	// After copying and refreshing, we need to determine where to navigate

	// If there are no more diff chunks, nothing to do
	if (!$diffChunks || $diffChunks.length === 0) {
		diffStore.setCurrentChunkIndex(-1);
		return;
	}

	// Check if the number of chunks decreased (chunk was removed)
	const chunksRemoved = oldTotalChunks - $diffChunks.length;

	if (chunksRemoved > 0) {
		// Chunk was removed, stay at same index (which moves us forward)
		// unless we're now past the end
		if (oldChunkIndex >= $diffChunks.length) {
			// We were at or past the last chunk, wrap to first
			diffStore.setCurrentChunkIndex(0);
		} else {
			// Stay at same index (effectively moving forward)
			diffStore.setCurrentChunkIndex(oldChunkIndex);
		}
	} else {
		// No chunks removed (e.g., modified chunk was copied)
		// Move to next chunk
		if (oldChunkIndex >= $diffChunks.length - 1) {
			// We were at the last chunk, wrap to first
			diffStore.setCurrentChunkIndex(0);
		} else {
			// Move to next chunk
			diffStore.setCurrentChunkIndex(oldChunkIndex + 1);
		}
	}

	// Scroll to the selected chunk after a delay to ensure DOM updates
	setTimeout(() => {
		if ($diffChunks[$diffStore.currentChunkIndex]) {
			scrollToLine(
				$diffChunks[$diffStore.currentChunkIndex].startIndex,
				$diffStore.currentChunkIndex,
			);
		}
	}, 150);
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
	_isDraggingViewport = false;
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
	if (!$diffChunks.length) {
		return;
	}

	// Check if we're at the last chunk
	if ($diffStore.currentChunkIndex >= $diffChunks.length - 1) {
		// Already at the last diff, play sound and do nothing
		playInvalidSound();
		return;
	}

	// Find the next chunk
	let nextChunkIndex = -1;
	if ($diffStore.currentChunkIndex === -1) {
		// No current chunk, jump to first
		nextChunkIndex = 0;
	} else {
		// Go to next chunk
		nextChunkIndex = $diffStore.currentChunkIndex + 1;
	}

	diffStore.setCurrentChunkIndex(nextChunkIndex);
	const chunk = $diffChunks[nextChunkIndex];
	scrollToLine(chunk.startIndex, nextChunkIndex);
}

function jumpToPrevDiff(): void {
	if (!$diffChunks.length) {
		return;
	}

	// Check if we're at the first chunk
	if ($diffStore.currentChunkIndex === 0) {
		// Already at the first diff, play sound and do nothing
		playInvalidSound();
		return;
	}

	// Find the previous chunk
	let prevChunkIndex = -1;
	if ($diffStore.currentChunkIndex === -1) {
		// No current chunk, jump to last
		prevChunkIndex = $diffChunks.length - 1;
	} else {
		// Go to previous chunk
		prevChunkIndex = $diffStore.currentChunkIndex - 1;
	}

	diffStore.setCurrentChunkIndex(prevChunkIndex);
	const chunk = $diffChunks[prevChunkIndex];
	scrollToLine(chunk.startIndex, prevChunkIndex);
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
		hoveredChunkIndex = chunkIndex;
	}
}

function _handleChunkMouseLeave(): void {
	hoveredChunkIndex = -1;
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
		}, 100);
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
	// Clear any corrupted cache
	highlightCache.clear();
	setHighlightedDiffWithChunks(null); // Force refresh of highlighted content

	// Also clear cache when theme changes
	document.addEventListener("themeChange", () => {
		highlightCache.clear();
		setHighlightedDiffWithChunks(null);
	});

	// Initialize theme from localStorage or default to dark
	const savedTheme = localStorage.getItem("theme");
	if (savedTheme) {
		isDarkMode = savedTheme === "dark";
	} else {
		// Default to dark mode and save it
		isDarkMode = true;
		localStorage.setItem("theme", "dark");
	}
	const theme = isDarkMode ? "dark" : "light";
	document.documentElement.setAttribute("data-theme", theme);

	// Add event listeners
	document.addEventListener("keydown", handleKeydown);
	EventsOn("show-quit-dialog", handleQuitDialog);

	// Menu event handlers
	EventsOn("menu-save-left", saveLeftFile);
	EventsOn("menu-save-right", saveRightFile);
	EventsOn("menu-save-all", async () => {
		// Save both files if they have unsaved changes
		if (_hasUnsavedLeftChanges) {
			await saveLeftFile();
		}
		if (_hasUnsavedRightChanges) {
			await saveRightFile();
		}
	});
	EventsOn("menu-discard-all", _handleDiscardChanges);
	EventsOn("menu-prev-diff", jumpToPrevDiff);
	EventsOn("menu-next-diff", jumpToNextDiff);

	// Check for initial files from command line
	try {
		const [initialLeft, initialRight] = await GetInitialFiles();
		if (initialLeft && initialRight) {
			fileStore.setBothFiles(initialLeft, initialRight);

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
			_showMenu = false;
		}
	}
	document.addEventListener("click", handleClickOutside);

	// Listen for minimap toggle event from menu
	EventsOn("toggle-minimap", (visible: boolean) => {
		_showMinimap = visible;
	});

	// Get initial minimap visibility state
	GetMinimapVisible().then((visible) => {
		_showMinimap = visible;
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
	_hasHorizontalScrollbar = false;
}
</script>

<main>
  <div class="header">
    <div class="menu-container">
      <button class="menu-toggle" on:click={() => _showMenu = !_showMenu} title="Menu">
        ☰
      </button>
      {#if _showMenu}
        <div class="dropdown-menu">
          <button class="menu-item" on:click={_toggleDarkMode}>
            {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
          <button 
            class="menu-item" 
            on:click={_handleDiscardChanges}
            disabled={!_hasUnsavedLeftChanges && !_hasUnsavedRightChanges}
          >
            🗑️ Discard Changes
          </button>
        </div>
      {/if}
    </div>
    <FileSelector
      leftFilePath={$fileStore.leftFilePath}
      rightFilePath={$fileStore.rightFilePath}
      leftFileName={$fileStore.leftFileName}
      rightFileName={$fileStore.rightFileName}
      {isDarkMode}
      isComparing={_isComparing}
      hasCompletedComparison={_hasCompletedComparison}
      on:leftFileSelected={handleLeftFileSelected}
      on:rightFileSelected={handleRightFileSelected}
      on:compare={compareBothFiles}
      on:error={handleError}
    />
    
    {#if _errorMessage}
      <div class="error">{_errorMessage}</div>
    {/if}
  </div>

  <DiffViewer
    bind:this={diffViewerComponent}
    leftFilePath={$fileStore.leftFilePath}
    rightFilePath={$fileStore.rightFilePath}
    diffResult={$diffStore.highlightedDiff}
    hasUnsavedLeftChanges={_hasUnsavedLeftChanges}
    hasUnsavedRightChanges={_hasUnsavedRightChanges}
    currentDiffChunkIndex={$diffStore.currentChunkIndex}
    {hoveredChunkIndex}
    showMinimap={_showMinimap}
    isComparing={_isComparing}
    hasCompletedComparison={_hasCompletedComparison}
    {areFilesIdentical}
    isSameFile={$isSameFile}
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
    show={_showQuitDialog}
    quitDialogFiles={_quitDialogFiles}
    leftFilePath={$fileStore.leftFilePath}
    rightFilePath={$fileStore.rightFilePath}
    bind:fileSelections
    on:saveAndQuit={_handleSaveAndQuit}
    on:quitWithoutSaving={_handleQuitWithoutSaving}
    on:cancel={() => _showQuitDialog = false}
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

  :global([data-theme="dark"]) .menu-toggle {
    color: #a5adcb;
    border-color: rgba(165, 173, 203, 0.3);
  }

  :global([data-theme="dark"]) .menu-toggle:hover {
    background: rgba(202, 211, 245, 0.1);
    border-color: rgba(202, 211, 245, 0.5);
    color: #cad3f5;
  }

  :global([data-theme="dark"]) .dropdown-menu {
    background: #24273a;
    border-color: #363a4f;
  }

  :global([data-theme="dark"]) .menu-item {
    color: #cad3f5;
  }

  :global([data-theme="dark"]) .menu-item:hover:not(:disabled) {
    background: rgba(202, 211, 245, 0.1);
  }

  :global([data-theme="dark"]) .menu-item:not(:last-child) {
    border-bottom-color: #363a4f;
  }

  :global([data-theme="dark"]) .file-header {
    background: #1e2030;
  }

  :global([data-theme="dark"]) .file-info {
    border-right-color: #363a4f;
    color: #cad3f5;
  }

  /* Dark mode bottom borders for file info sections */
  :global([data-theme="dark"]) .file-info.left,
  :global([data-theme="dark"]) .file-info.right {
    border-bottom-color: #363a4f;
  }

  :global([data-theme="dark"]) .save-btn {
    background: #494d64;
    border: 1px solid #5b6078;
  }

  :global([data-theme="dark"]) .save-btn:disabled {
    background: #363a4f;
    border: 1px solid #5b6078;
    opacity: 0.4;
  }

  :global([data-theme="dark"]) .save-btn:not(:disabled):hover {
    background: #5b6078;
    border-color: #6e738d;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }




  :global([data-theme="dark"]) .error {
    background: #ed8796;
    color: #24273a;
  }

  :global([data-theme="dark"]) .empty-state {
    color: #a5adcb;
  }

  .header {
    padding: 1rem;
    border-bottom: 1px solid #9ca0b0;
    background: #e6e9ef;
    position: relative;
  }

  .menu-container {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 1000;
  }

  .menu-toggle {
    background: none;
    border: 1px solid rgba(108, 111, 133, 0.3);
    cursor: pointer;
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    color: #6c6f85;
    transition: all 0.2s ease;
    font-size: 1.2rem;
    line-height: 1;
  }

  .menu-toggle:hover {
    background: rgba(76, 79, 105, 0.1);
    border-color: rgba(76, 79, 105, 0.5);
    color: #4c4f69;
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.5rem;
    background: #eff1f5;
    border: 1px solid #9ca0b0;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    min-width: 150px;
  }

  .menu-item {
    display: block;
    width: 100%;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s ease;
    color: #4c4f69;
  }

  .menu-item:hover:not(:disabled) {
    background: rgba(76, 79, 105, 0.1);
  }

  .menu-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .menu-item:not(:last-child) {
    border-bottom: 1px solid #9ca0b0;
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


  .error {
    color: #d20f39;
    font-size: 0.9rem;
    padding: 0.5rem;
    background: #eff1f5;
    border-radius: 4px;
    margin-top: 0.5rem;
  }


  /* ===========================================
   * MINIMAP STYLES
   * =========================================== */





  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6c6f85;
    font-size: 1.1rem;
  }

  .same-file-banner {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #fdf6e3;
    color: #d20f39;
    border-top: 1px solid #df8e1d;
    border-left: 4px solid #df8e1d;
    border-right: 4px solid #df8e1d;
    border-bottom: 1px solid #df8e1d;
    font-size: 0.9rem;
    gap: 0.5rem;
  }

  .warning-icon {
    font-size: 1.1rem;
    color: #df8e1d;
  }

  .warning-text {
    flex: 1;
    color: #4c4f69;
  }

  .warning-text strong {
    font-weight: 600;
    color: #d20f39;
  }

  /* Dark mode banner styling */
  :global([data-theme="dark"]) .same-file-banner {
    background: #363a4f;
    color: #cad3f5;
    border-top-color: #f5a97f;
    border-left-color: #f5a97f;
    border-right-color: #f5a97f;
    border-bottom-color: #f5a97f;
  }

  :global([data-theme="dark"]) .warning-icon {
    color: #f5a97f;
  }

  :global([data-theme="dark"]) .warning-text {
    color: #cad3f5;
  }

  :global([data-theme="dark"]) .warning-text strong {
    color: #f5a97f;
  }

  .identical-files-banner {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #f0f9ff;
    color: #0369a1;
    border-top: 1px solid #0ea5e9;
    border-left: 4px solid #0ea5e9;
    border-right: 4px solid #0ea5e9;
    border-bottom: 1px solid #0ea5e9;
    font-size: 0.9rem;
    gap: 0.5rem;
  }

  .info-icon {
    font-size: 1.1rem;
    color: #0ea5e9;
  }

  .info-text {
    flex: 1;
    color: #0369a1;
    font-weight: 500;
  }

  /* Dark mode identical files banner styling */
  :global([data-theme="dark"]) .identical-files-banner {
    background: #363a4f;
    color: #7dc4e4;
    border-top-color: #7dc4e4;
    border-left-color: #7dc4e4;
    border-right-color: #7dc4e4;
    border-bottom-color: #7dc4e4;
  }

  :global([data-theme="dark"]) .info-icon {
    color: #7dc4e4;
  }

  :global([data-theme="dark"]) .info-text {
    color: #7dc4e4;
  }



  /* Quit Dialog Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .quit-dialog {
    background: #ffffff;
    border-radius: 8px;
    padding: 24px;
    min-width: 400px;
    max-width: 500px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  :global([data-theme="dark"]) .quit-dialog {
    background: #363a4f;
    color: #cad3f5;
  }

  .quit-dialog h3 {
    margin: 0 0 16px 0;
    font-size: 18px;
    font-weight: 600;
  }

  .quit-dialog p {
    margin: 0 0 20px 0;
    color: #6c7086;
  }

  :global([data-theme="dark"]) .quit-dialog p {
    color: #a5adcb;
  }

  .file-list {
    margin-bottom: 24px;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    cursor: pointer;
  }

  .file-item input[type="checkbox"] {
    margin: 0;
  }

  .file-item input[type="checkbox"]:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .file-item:has(input[type="checkbox"]:disabled) {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .file-name {
    font-weight: 500;
  }

  .file-status {
    color: #6c7086;
    font-size: 14px;
    font-style: italic;
  }

  :global([data-theme="dark"]) .file-status {
    color: #a5adcb;
  }

  .dialog-buttons {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .btn-primary, .btn-secondary, .btn-tertiary {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary {
    background: #8aadf4;
    color: white;
  }

  .btn-primary:hover {
    background: #7da3f0;
  }

  .btn-secondary {
    background: #ed8796;
    color: white;
  }

  .btn-secondary:hover {
    background: #ea7183;
  }

  .btn-tertiary {
    background: #eff1f5;
    color: #4c4f69;
    border: 1px solid #ddd;
  }

  .btn-tertiary:hover {
    background: #e4e6ea;
  }

  :global([data-theme="dark"]) .btn-tertiary {
    background: #494d64;
    color: #cad3f5;
    border-color: #5b6078;
  }

  :global([data-theme="dark"]) .btn-tertiary:hover {
    background: #5b6078;
  }


</style>
