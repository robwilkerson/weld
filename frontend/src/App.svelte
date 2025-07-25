<script lang="ts">
import { onMount } from "svelte";
import {
	CompareFiles,
	DiscardAllChanges,
	GetInitialFiles,
	GetMinimapVisible,
	HasUnsavedChanges,
	QuitWithoutSaving,
	SaveChanges,
	SaveSelectedFilesAndQuit,
} from "../wailsjs/go/main/App.js";
import { EventsOn } from "../wailsjs/runtime/runtime.js";
// biome-ignore lint/correctness/noUnusedImports: Used in Svelte template
import DiffViewer from "./components/DiffViewer.svelte";
// biome-ignore lint/correctness/noUnusedImports: Used in Svelte template
import FileSelector from "./components/FileSelector.svelte";
// biome-ignore lint/correctness/noUnusedImports: Used in Svelte template
import QuitDialog from "./components/QuitDialog.svelte";
import type {
	DiffLine,
	DiffResult,
	HighlightedDiffLine,
	HighlightedDiffResult,
	LineChunk,
} from "./types/diff.js";
import {
	computeInlineDiff,
	escapeHtml,
	getLineNumberWidth,
} from "./utils/diff.js";
import * as diffOps from "./utils/diffOperations.js";
// biome-ignore lint/correctness/noUnusedImports: Used in Svelte template
import { getFileIcon, getFileTypeName } from "./utils/fileIcons.js";
import { handleKeydown as handleKeyboardShortcut } from "./utils/keyboard.js";
import { getLanguageFromExtension } from "./utils/language.js";
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

let leftFilePath: string = "";
let rightFilePath: string = "";
let leftFileName: string = "Select left file...";
let rightFileName: string = "Select right file...";
let diffResult: DiffResult | null = null;
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

// Current diff tracking
let currentDiffChunkIndex: number = -1;

// Hover tracking for chunks
let hoveredChunkIndex: number = -1;

// Create a reactive function for checking if a line is in the current chunk
$: isLineHighlighted = (lineIndex: number) => {
	if (
		currentDiffChunkIndex === -1 ||
		!diffChunks ||
		!diffChunks[currentDiffChunkIndex]
	) {
		return false;
	}

	const chunk = diffChunks[currentDiffChunkIndex];
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

// Compute diff chunks (groups of consecutive non-"same" lines)
$: diffChunks = (() => {
	if (!highlightedDiffResult) return [];

	const chunks: { startIndex: number; endIndex: number }[] = [];
	let inDiff = false;
	let startIndex = -1;

	highlightedDiffResult.lines.forEach((line, index) => {
		if (line.type !== "same") {
			if (!inDiff) {
				// Start of a new diff chunk
				inDiff = true;
				startIndex = index;
			}
		} else {
			if (inDiff) {
				// End of diff chunk
				chunks.push({ startIndex, endIndex: index - 1 });
				inDiff = false;
			}
		}
	});

	// Handle case where file ends with a diff
	if (inDiff && startIndex !== -1) {
		chunks.push({
			startIndex,
			endIndex: highlightedDiffResult.lines.length - 1,
		});
	}

	return chunks;
})();

$: isSameFile = leftFilePath && rightFilePath && leftFilePath === rightFilePath;

// Only show "files are identical" banner if they're identical on disk
$: areFilesIdentical =
	diffResult?.lines &&
	diffResult.lines.length > 0 &&
	diffResult.lines.every((line) => line.type === "same") &&
	leftFilePath !== rightFilePath;

$: lineNumberWidth = getLineNumberWidth(diffResult);

// ===========================================
// HIGHLIGHTING TYPES AND STATE
// ===========================================

// Highlighted diff result for template rendering
let highlightedDiffResult: HighlightedDiffResult | null = null;

// Track if we're currently processing to avoid re-entrancy
let isProcessingHighlight = false;

// ===========================================
// HIGHLIGHTING CONFIGURATION
// ===========================================

// Feature flags for different highlighting types
const HIGHLIGHTING_CONFIG = {
	chunkHighlighting: true, // Full-width line backgrounds
	inlineHighlighting: true, // Specific content changes within lines
	syntaxHighlighting: false, // Code syntax highlighting
};

// Process highlighting when diffResult changes
$: if (diffResult && highlighter && !isProcessingHighlight) {
	processHighlighting(diffResult);
} else if (diffResult && !highlighter) {
	// Set result without highlighting for now
	highlightedDiffResult = {
		lines: diffResult.lines.map((line) => processLineHighlighting(line)),
	};
	// Auto-scroll is now handled by DiffViewer component
} else if (!diffResult) {
	highlightedDiffResult = null;
}

let lineChunks: LineChunk[] = [];

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

// Process chunks when highlightedDiffResult changes
$: if (highlightedDiffResult) {
	lineChunks = detectLineChunks(highlightedDiffResult.lines);
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
		highlightedDiffResult = result;
		isProcessingHighlight = false;
		return;
	}

	if (!highlighter) {
		highlightedDiffResult = {
			lines: result.lines.map((line) => processLineHighlighting(line)),
		};
		isProcessingHighlight = false;
		return;
	}

	try {
		// For now, disable syntax highlighting to avoid lockups
		// TODO: Implement with web workers or lazy loading
		highlightedDiffResult = {
			lines: result.lines.map((line) => processLineHighlighting(line)),
		};

		// After highlighting is done, set initial diff chunk
		// Auto-scroll is now handled by DiffViewer component
	} catch (error) {
		console.error("Error processing highlighting:", error);
		// Fallback to non-highlighted version
		highlightedDiffResult = {
			lines: result.lines.map((line) => processLineHighlighting(line)),
		};

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
	if (leftFilePath) {
		_hasUnsavedLeftChanges = await HasUnsavedChanges(leftFilePath);
	}
	if (rightFilePath) {
		_hasUnsavedRightChanges = await HasUnsavedChanges(rightFilePath);
	}
}

// Quit dialog functions
function handleQuitDialog(unsavedFiles: string[]): void {
	_quitDialogFiles = unsavedFiles;
	_showQuitDialog = true;

	// Initialize file selections - dirty files checked by default, clean files unchecked and disabled
	fileSelections = {};
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
	leftFilePath = path;
	leftFileName = path.split("/").pop() || path;
	await updateUnsavedChangesStatus();
	_errorMessage = `Left file selected: ${leftFileName}`;
	diffResult = null; // Clear previous results
	_hasCompletedComparison = false; // Reset comparison state
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
function handleError(event: CustomEvent<{ message: string }>) {
	_errorMessage = event.detail.message;
}

// biome-ignore lint/correctness/noUnusedVariables: Used in template
async function handleRightFileSelected(event: CustomEvent<{ path: string }>) {
	const path = event.detail.path;
	rightFilePath = path;
	rightFileName = path.split("/").pop() || path;
	await updateUnsavedChangesStatus();
	_errorMessage = `Right file selected: ${rightFileName}`;
	diffResult = null; // Clear previous results
	_hasCompletedComparison = false; // Reset comparison state
}

async function compareBothFiles(
	preserveCurrentDiff: boolean = false,
): Promise<void> {
	if (!leftFilePath || !rightFilePath) {
		_errorMessage = "Please select both files before comparing";
		return;
	}

	try {
		_isComparing = true;
		_errorMessage = "";
		if (!preserveCurrentDiff) {
			currentDiffChunkIndex = -1; // Reset current diff tracking only when not preserving
		}

		diffResult = await CompareFiles(leftFilePath, rightFilePath);

		if (!diffResult || !diffResult.lines) {
			_errorMessage = "No comparison result received";
			diffResult = null;
		} else if (diffResult.lines.length === 0) {
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
		diffResult = null;
	} finally {
		_isComparing = false;
	}
}

// Scroll sync functions moved below onMount

// ===========================================
// MINIMAP FUNCTIONALITY
// ===========================================

function _handleMinimapClick(event: MouseEvent): void {
	// TODO: This functionality needs to be moved to DiffViewer component
	// For now, just update the chunk index based on click position
	if (!highlightedDiffResult) return;

	const minimap = event.currentTarget as HTMLElement;
	const minimapRect = minimap.getBoundingClientRect();
	const clickY = event.clientY - minimapRect.top;

	// Calculate the percentage of the minimap that was clicked
	const clickPercentage = clickY / minimapRect.height;

	// Calculate the corresponding line index in the actual content
	const totalLines = highlightedDiffResult.lines.length;
	const targetLineIndex = Math.floor(clickPercentage * totalLines);

	// Ensure line index is within bounds
	const boundedLineIndex = Math.max(
		0,
		Math.min(targetLineIndex, totalLines - 1),
	);

	// Find which diff chunk this line belongs to and set it as current
	const clickedChunkIndex = diffChunks.findIndex(
		(chunk) =>
			boundedLineIndex >= chunk.startIndex &&
			boundedLineIndex <= chunk.endIndex,
	);

	if (clickedChunkIndex !== -1) {
		currentDiffChunkIndex = clickedChunkIndex;
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
	if (diffResult) {
		processHighlighting(diffResult);
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
	if (!diffResult || !diffResult.lines[lineIndex]) return;

	const line = diffResult.lines[lineIndex];
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
	if (!diffResult || !diffResult.lines[lineIndex]) return;

	const line = diffResult.lines[lineIndex];
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
	return {
		leftFilePath,
		rightFilePath,
		diffResult,
		compareBothFiles,
		updateUnsavedChangesStatus,
	};
}

async function _copyLineFromRight(lineIndex: number): Promise<void> {
	await copyLineToLeft(lineIndex);
}

async function _copyLineFromLeft(lineIndex: number): Promise<void> {
	await copyLineToRight(lineIndex);
}

async function _copyChunkToRight(chunk: LineChunk): Promise<void> {
	if (!diffResult || !highlightedDiffResult) return;

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
	if (!diffResult || !highlightedDiffResult) return;

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
	if (!diffResult || !highlightedDiffResult) return;

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
	if (!diffResult || !highlightedDiffResult) return;

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
	if (!diffResult || !highlightedDiffResult) return;

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
	if (!diffResult || !highlightedDiffResult) return;

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

async function _deleteLineFromRight(lineIndex: number): Promise<void> {
	if (!diffResult || !diffResult.lines[lineIndex]) return;

	const line = diffResult.lines[lineIndex];
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
	if (!diffResult || !diffResult.lines[lineIndex]) return;

	const line = diffResult.lines[lineIndex];
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
		await SaveChanges(rightFilePath);
		await updateUnsavedChangesStatus();
		_errorMessage = "Right file saved successfully";
	} catch (error) {
		console.error("Error saving right file:", error);
		_errorMessage = `Error saving right file: ${error}`;
	}
}

function handleKeydown(event: KeyboardEvent): void {
	// Handle Shift+L and Shift+H for copying current diff
	if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
		if (event.key === "L") {
			event.preventDefault();
			copyCurrentDiffLeftToRight();
			return;
		} else if (event.key === "H") {
			event.preventDefault();
			copyCurrentDiffRightToLeft();
			return;
		}
	}

	handleKeyboardShortcut(
		event,
		saveLeftFile,
		saveRightFile,
		leftFilePath,
		rightFilePath,
		jumpToNextDiff,
		jumpToPrevDiff,
	);
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

function detectLineChunks(lines: HighlightedDiffLine[]): LineChunk[] {
	const chunks: LineChunk[] = [];
	let currentChunk: LineChunk | null = null;

	lines.forEach((line, index) => {
		// Create chunks for added/removed/modified lines
		if (
			line.type === "added" ||
			line.type === "removed" ||
			line.type === "modified"
		) {
			if (currentChunk && currentChunk.type === line.type) {
				// Extend current chunk
				currentChunk.endIndex = index;
				currentChunk.lines++;
			} else {
				// Start new chunk
				if (currentChunk) {
					chunks.push(currentChunk);
				}
				currentChunk = {
					startIndex: index,
					endIndex: index,
					type: line.type,
					lines: 1,
				};
			}
		} else {
			// End current chunk if any
			if (currentChunk) {
				chunks.push(currentChunk);
				currentChunk = null;
			}
		}
	});

	// Don't forget the last chunk
	if (currentChunk) {
		chunks.push(currentChunk);
	}

	return chunks;
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
	if (!highlightedDiffResult || lineIndex >= highlightedDiffResult.lines.length)
		return false;

	const currentLine = highlightedDiffResult.lines[lineIndex];
	if (currentLine.type !== "modified") return false;

	// Check if previous line is not modified
	if (lineIndex === 0) return true;
	const prevLine = highlightedDiffResult.lines[lineIndex - 1];
	return prevLine.type !== "modified";
}

async function copyCurrentDiffLeftToRight(): Promise<void> {
	if (
		currentDiffChunkIndex === -1 ||
		!diffChunks ||
		!diffChunks[currentDiffChunkIndex]
	) {
		console.log("No current diff chunk to copy");
		return;
	}

	const chunk = diffChunks[currentDiffChunkIndex];
	const lineChunk = lineChunks.find(
		(lc) =>
			lc.startIndex === chunk.startIndex && lc.endIndex === chunk.endIndex,
	);

	if (!lineChunk) {
		console.log("No matching lineChunk found");
		return;
	}

	console.log("Copying left to right, chunk type:", lineChunk.type);

	// Store the current position before copying
	const oldChunkIndex = currentDiffChunkIndex;
	const totalChunks = diffChunks.length;

	// Determine the action based on chunk type
	if (lineChunk.type === "removed") {
		await _copyChunkToRight(lineChunk);
	} else if (lineChunk.type === "modified") {
		await _copyModifiedChunkToRight(lineChunk);
	} else if (lineChunk.type === "added") {
		// When copying "nothing" from left to right, delete the added lines from right
		await _deleteChunkFromRight(lineChunk);
	}

	// After refresh, navigate to the next appropriate chunk
	navigateAfterCopy(oldChunkIndex, totalChunks);
}

async function copyCurrentDiffRightToLeft(): Promise<void> {
	if (
		currentDiffChunkIndex === -1 ||
		!diffChunks ||
		!diffChunks[currentDiffChunkIndex]
	) {
		console.log("No current diff chunk to copy");
		return;
	}

	const chunk = diffChunks[currentDiffChunkIndex];
	const lineChunk = lineChunks.find(
		(lc) =>
			lc.startIndex === chunk.startIndex && lc.endIndex === chunk.endIndex,
	);

	if (!lineChunk) {
		console.log("No matching lineChunk found");
		return;
	}

	console.log("Copying right to left, chunk type:", lineChunk.type);

	// Store the current position before copying
	const oldChunkIndex = currentDiffChunkIndex;
	const totalChunks = diffChunks.length;

	// Determine the action based on chunk type
	if (lineChunk.type === "added") {
		await _copyChunkToLeft(lineChunk);
	} else if (lineChunk.type === "modified") {
		await _copyModifiedChunkToLeft(lineChunk);
	} else if (lineChunk.type === "removed") {
		// When copying "nothing" from right to left, delete the removed lines from left
		await _deleteChunkFromLeft(lineChunk);
	}

	// After refresh, navigate to the next appropriate chunk
	navigateAfterCopy(oldChunkIndex, totalChunks);
}

function navigateAfterCopy(
	oldChunkIndex: number,
	oldTotalChunks: number,
): void {
	// After copying and refreshing, we need to determine where to navigate

	// If there are no more diff chunks, nothing to do
	if (!diffChunks || diffChunks.length === 0) {
		currentDiffChunkIndex = -1;
		return;
	}

	// Check if the number of chunks decreased (chunk was removed)
	const chunksRemoved = oldTotalChunks - diffChunks.length;

	if (chunksRemoved > 0) {
		// Chunk was removed, stay at same index (which moves us forward)
		// unless we're now past the end
		if (oldChunkIndex >= diffChunks.length) {
			// We were at or past the last chunk, wrap to first
			currentDiffChunkIndex = 0;
		} else {
			// Stay at same index (effectively moving forward)
			currentDiffChunkIndex = oldChunkIndex;
		}
	} else {
		// No chunks removed (e.g., modified chunk was copied)
		// Move to next chunk
		if (oldChunkIndex >= diffChunks.length - 1) {
			// We were at the last chunk, wrap to first
			currentDiffChunkIndex = 0;
		} else {
			// Move to next chunk
			currentDiffChunkIndex = oldChunkIndex + 1;
		}
	}

	// Scroll to the selected chunk
	if (diffChunks[currentDiffChunkIndex]) {
		scrollToLine(diffChunks[currentDiffChunkIndex].startIndex);
	}
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
	if (!diffChunks.length) {
		return;
	}

	// Check if we're at the last chunk
	if (currentDiffChunkIndex >= diffChunks.length - 1) {
		// Already at the last diff, play sound and do nothing
		playInvalidSound();
		return;
	}

	// Find the next chunk
	let nextChunkIndex = -1;
	if (currentDiffChunkIndex === -1) {
		// No current chunk, jump to first
		nextChunkIndex = 0;
	} else {
		// Go to next chunk
		nextChunkIndex = currentDiffChunkIndex + 1;
	}

	currentDiffChunkIndex = nextChunkIndex;
	const chunk = diffChunks[nextChunkIndex];
	scrollToLine(chunk.startIndex);
}

function jumpToPrevDiff(): void {
	if (!diffChunks.length) {
		return;
	}

	// Check if we're at the first chunk
	if (currentDiffChunkIndex === 0) {
		// Already at the first diff, play sound and do nothing
		playInvalidSound();
		return;
	}

	// Find the previous chunk
	let prevChunkIndex = -1;
	if (currentDiffChunkIndex === -1) {
		// No current chunk, jump to last
		prevChunkIndex = diffChunks.length - 1;
	} else {
		// Go to previous chunk
		prevChunkIndex = currentDiffChunkIndex - 1;
	}

	currentDiffChunkIndex = prevChunkIndex;
	const chunk = diffChunks[prevChunkIndex];
	scrollToLine(chunk.startIndex);
}

// biome-ignore lint/suspicious/noExplicitAny: Svelte component ref
let diffViewerComponent: any;

function scrollToLine(lineIndex: number): void {
	if (diffViewerComponent?.scrollToLine) {
		diffViewerComponent.scrollToLine(lineIndex);
	}
}

function _handleChunkClick(event: {
	chunkIndex: number;
	lineIndex: number;
}): void {
	const { chunkIndex, lineIndex } = event;

	// Update the current diff chunk index
	currentDiffChunkIndex = chunkIndex;
	// Scroll to the line that was clicked
	scrollToLine(lineIndex);
}

function _handleChunkMouseEnter(lineIndex: number): void {
	// Find which chunk this line belongs to
	const chunkIndex = diffChunks.findIndex(
		(chunk) => lineIndex >= chunk.startIndex && lineIndex <= chunk.endIndex,
	);

	if (chunkIndex !== -1) {
		hoveredChunkIndex = chunkIndex;
	}
}

function _handleChunkMouseLeave(): void {
	hoveredChunkIndex = -1;
}

// Set initial diff chunk when diff result loads
$: if (
	highlightedDiffResult &&
	diffChunks.length > 0 &&
	currentDiffChunkIndex === -1
) {
	const firstDiffIndex = highlightedDiffResult.lines.findIndex(
		(line) => line.type !== "same",
	);

	if (firstDiffIndex !== -1) {
		// Set to the first diff chunk
		currentDiffChunkIndex = 0;
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
	highlightedDiffResult = null; // Force refresh of highlighted content

	// Also clear cache when theme changes
	document.addEventListener("themeChange", () => {
		highlightCache.clear();
		highlightedDiffResult = null;
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

	// Check for initial files from command line
	try {
		const [initialLeft, initialRight] = await GetInitialFiles();
		if (initialLeft && initialRight) {
			leftFilePath = initialLeft;
			rightFilePath = initialRight;
			leftFileName = initialLeft.split("/").pop() || "Select left file...";
			rightFileName = initialRight.split("/").pop() || "Select right file...";

			// Automatically compare the files
			await compareBothFiles();
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
      {leftFilePath}
      {rightFilePath}
      {leftFileName}
      {rightFileName}
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
    {leftFilePath}
    {rightFilePath}
    diffResult={highlightedDiffResult}
    hasUnsavedLeftChanges={_hasUnsavedLeftChanges}
    hasUnsavedRightChanges={_hasUnsavedRightChanges}
    {currentDiffChunkIndex}
    {hoveredChunkIndex}
    showMinimap={_showMinimap}
    {isDarkMode}
    isComparing={_isComparing}
    hasCompletedComparison={_hasCompletedComparison}
    {areFilesIdentical}
    {isSameFile}
    {lineNumberWidth}
    on:saveLeft={saveLeftFile}
    on:saveRight={saveRightFile}
    on:copyLineToLeft={(e) => copyLineToLeft(e.detail)}
    on:copyLineToRight={(e) => copyLineToRight(e.detail)}
    on:copyChunkToLeft={(e) => _copyChunkToLeft(e.detail)}
    on:copyChunkToRight={(e) => _copyChunkToRight(e.detail)}
    on:copyModifiedChunkToLeft={(e) => _copyModifiedChunkToLeft(e.detail)}
    on:copyModifiedChunkToRight={(e) => _copyModifiedChunkToRight(e.detail)}
    on:deleteChunkFromLeft={(e) => _deleteChunkFromLeft(e.detail)}
    on:deleteChunkFromRight={(e) => _deleteChunkFromRight(e.detail)}
    on:chunkClick={(e) => handleChunkClick(e.detail)}
    on:chunkHover={(e) => _handleChunkMouseEnter(e.detail)}
    on:chunkLeave={_handleChunkMouseLeave}
    on:minimapClick={(e) => _handleMinimapClick(e.detail)}
    on:viewportMouseDown={(e) => _handleViewportMouseDown(e.detail)}
  />

  <!-- Quit Dialog Modal -->
  <QuitDialog
    show={_showQuitDialog}
    quitDialogFiles={_quitDialogFiles}
    {leftFilePath}
    {rightFilePath}
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

  h1 {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
    color: #333;
  }



  .error {
    color: #d20f39;
    font-size: 0.9rem;
    padding: 0.5rem;
    background: #eff1f5;
    border-radius: 4px;
    margin-top: 0.5rem;
  }

  .loading {
    color: #0366d6;
    font-size: 0.9rem;
    padding: 0.5rem;
  }

  .diff-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
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
