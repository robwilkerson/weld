<script lang="ts">
import { onMount } from "svelte";
import {
	CompareFiles,
	CopyToFile,
	type DiffLine,
	type DiffResult,
	DiscardAllChanges,
	GetInitialFiles,
	HasUnsavedChanges,
	QuitWithoutSaving,
	RemoveLineFromFile,
	SaveChanges,
	SaveSelectedFilesAndQuit,
	SelectFile,
} from "../wailsjs/go/main/App.js";
import { EventsOn } from "../wailsjs/runtime/runtime.js";
import {
	computeInlineDiff,
	escapeHtml,
	getLineClass,
	getLineNumberWidth,
} from "./utils/diff.js";
import { handleKeydown as handleKeyboardShortcut } from "./utils/keyboard.js";
import { getLanguageFromExtension } from "./utils/language.js";
import { getDisplayPath, getDisplayFileName } from "./utils/path.js";

// Shiki highlighter instance
let highlighter: any = null;

// Cache for highlighted lines to avoid re-processing
const highlightCache: Map<string, string> = new Map();

let leftFilePath: string = "";
let rightFilePath: string = "";
let leftFileName: string = "Select left file...";
let rightFileName: string = "Select right file...";
let diffResult: DiffResult | null = null;
let _isComparing: boolean = false;
let _errorMessage: string = "";
let leftPane: HTMLElement;
let rightPane: HTMLElement;
let centerGutter: HTMLElement;
let isScrollSyncing: boolean = false;
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

// Extended type for highlighted diff lines
type HighlightedDiffLine = DiffLine & {
	leftLineHighlighted?: string;
	rightLineHighlighted?: string;
};

type HighlightedDiffResult = {
	lines: HighlightedDiffLine[];
};

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
} else if (!diffResult) {
	highlightedDiffResult = null;
}

// Chunk information for grouping consecutive lines
interface LineChunk {
	startIndex: number;
	endIndex: number;
	type: string;
	lines: number;
}

let lineChunks: LineChunk[] = [];

// Process chunks when highlightedDiffResult changes
$: if (highlightedDiffResult) {
	lineChunks = detectLineChunks(highlightedDiffResult.lines);
}

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

		// After highlighting is done, scroll to first diff
		setTimeout(() => scrollToFirstDiff(), 200);
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

async function _selectLeftFile(): Promise<void> {
	try {
		const path = await SelectFile();
		if (path) {
			leftFilePath = path;
			leftFileName = path.split("/").pop() || path;
			await updateUnsavedChangesStatus();
			_errorMessage = `Left file selected: ${leftFileName}`;
			diffResult = null; // Clear previous results
			_hasCompletedComparison = false; // Reset comparison state
		} else {
			_errorMessage = "No left file selected";
		}
	} catch (error) {
		console.error("Error selecting left file:", error);
		_errorMessage = `Error selecting left file: ${error}`;
	}
}

async function _selectRightFile(): Promise<void> {
	try {
		const path = await SelectFile();
		if (path) {
			rightFilePath = path;
			rightFileName = path.split("/").pop() || path;
			await updateUnsavedChangesStatus();
			_errorMessage = `Right file selected: ${rightFileName}`;
			diffResult = null; // Clear previous results
			_hasCompletedComparison = false; // Reset comparison state
		} else {
			_errorMessage = "No right file selected";
		}
	} catch (error) {
		console.error("Error selecting right file:", error);
		_errorMessage = `Error selecting right file: ${error}`;
	}
}

async function compareBothFiles(): Promise<void> {
	if (!leftFilePath || !rightFilePath) {
		_errorMessage = "Please select both files before comparing";
		return;
	}

	try {
		_isComparing = true;
		_errorMessage = "";

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

function _syncLeftScroll() {
	if (isScrollSyncing || !leftPane || !rightPane || !centerGutter) return;
	isScrollSyncing = true;
	// Sync vertical scrolling to all panes
	const scrollTop = leftPane.scrollTop;
	rightPane.scrollTop = scrollTop;
	centerGutter.scrollTop = scrollTop;
	// Only sync horizontal scroll between content panes
	rightPane.scrollLeft = leftPane.scrollLeft;
	requestAnimationFrame(() => {
		isScrollSyncing = false;
	});
}

function _syncRightScroll() {
	if (isScrollSyncing || !leftPane || !rightPane || !centerGutter) return;
	isScrollSyncing = true;

	// Sync vertical scrolling to all panes
	const scrollTop = rightPane.scrollTop;
	leftPane.scrollTop = scrollTop;
	centerGutter.scrollTop = scrollTop;
	// Only sync horizontal scroll between content panes
	leftPane.scrollLeft = rightPane.scrollLeft;
	requestAnimationFrame(() => {
		isScrollSyncing = false;
	});
}

function _syncCenterScroll() {
	if (isScrollSyncing || !leftPane || !rightPane || !centerGutter) return;
	isScrollSyncing = true;
	// Sync center gutter scroll to both content panes
	leftPane.scrollTop = centerGutter.scrollTop;
	rightPane.scrollTop = centerGutter.scrollTop;
	setTimeout(() => {
		isScrollSyncing = false;
	}, 10);
}

// ===========================================
// MINIMAP FUNCTIONALITY
// ===========================================

function _handleMinimapClick(event: MouseEvent): void {
	if (!highlightedDiffResult || !leftPane || !rightPane || !centerGutter)
		return;

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

	// Calculate scroll position to show the target line
	const lineHeightPx = 19.5; // Approximate line height in pixels (1.5em * 13px font)
	const targetScrollTop = boundedLineIndex * lineHeightPx;

	// Get viewport height to center the target
	const viewportHeight = leftPane.clientHeight;
	const scrollTo = Math.max(0, targetScrollTop - viewportHeight / 2);

	// Sync scroll across all panes
	isScrollSyncing = true;
	leftPane.scrollTop = scrollTo;
	rightPane.scrollTop = scrollTo;
	centerGutter.scrollTop = scrollTo;

	requestAnimationFrame(() => {
		isScrollSyncing = false;
	});
}

async function _initializeDefaultFiles(): Promise<void> {
	// Removed automatic file loading to prevent crashes
	// Users should manually select files to compare
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

		// Copy the line from left to right file at the appropriate position
		await CopyToFile(
			leftFilePath,
			rightFilePath,
			line.leftNumber,
			line.leftLine,
		);

		// Refresh the diff to show the changes
		await compareBothFiles();
		await updateUnsavedChangesStatus();

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

		// Copy the line from right to left file at the appropriate position
		await CopyToFile(
			rightFilePath,
			leftFilePath,
			line.rightNumber,
			line.rightLine,
		);

		// Refresh the diff to show the changes
		await compareBothFiles();
		await updateUnsavedChangesStatus();

		_errorMessage = "Line copied successfully";
	} catch (error) {
		console.error("Error copying line to left:", error);
		_errorMessage = `Error copying line: ${error}`;
	}
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

		// Copy all lines in the chunk from left to right
		for (let i = chunk.startIndex; i <= chunk.endIndex; i++) {
			const line = diffResult.lines[i];
			if (line.type === "removed" && line.leftNumber !== null) {
				await CopyToFile(
					leftFilePath,
					rightFilePath,
					line.leftNumber,
					line.leftLine,
				);
			}
		}

		// Refresh the diff
		await compareBothFiles();
		await updateUnsavedChangesStatus();
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

		// Copy all lines in the chunk from right to left
		for (let i = chunk.startIndex; i <= chunk.endIndex; i++) {
			const line = diffResult.lines[i];
			if (line.type === "added" && line.rightNumber !== null) {
				await CopyToFile(
					rightFilePath,
					leftFilePath,
					line.rightNumber,
					line.rightLine,
				);
			}
		}

		// Refresh the diff
		await compareBothFiles();
		await updateUnsavedChangesStatus();
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

		// For modified chunks, we need to replace the content in the right file
		// with the content from the left file
		for (let i = chunk.startIndex; i <= chunk.endIndex; i++) {
			const line = diffResult.lines[i];
			if (
				line.type === "modified" &&
				line.leftNumber !== null &&
				line.rightNumber !== null
			) {
				// First remove the old line from right
				await RemoveLineFromFile(rightFilePath, line.rightNumber);
				// Then insert the left content at that position
				await CopyToFile(
					leftFilePath,
					rightFilePath,
					line.rightNumber,
					line.leftLine,
				);
			}
		}

		// Refresh the diff
		await compareBothFiles();
		await updateUnsavedChangesStatus();
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

		// For modified chunks, we need to replace the content in the left file
		// with the content from the right file
		for (let i = chunk.startIndex; i <= chunk.endIndex; i++) {
			const line = diffResult.lines[i];
			if (
				line.type === "modified" &&
				line.leftNumber !== null &&
				line.rightNumber !== null
			) {
				// First remove the old line from left
				await RemoveLineFromFile(leftFilePath, line.leftNumber);
				// Then insert the right content at that position
				await CopyToFile(
					rightFilePath,
					leftFilePath,
					line.leftNumber,
					line.rightLine,
				);
			}
		}

		// Refresh the diff
		await compareBothFiles();
		await updateUnsavedChangesStatus();
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

		// Delete all lines in the chunk from right file (in reverse order to maintain line numbers)
		for (let i = chunk.endIndex; i >= chunk.startIndex; i--) {
			const line = diffResult.lines[i];
			if (
				line.type === "added" &&
				line.rightNumber !== null &&
				line.rightNumber > 0
			) {
				await RemoveLineFromFile(rightFilePath, line.rightNumber);
			}
		}

		// Refresh the diff
		await compareBothFiles();
		await updateUnsavedChangesStatus();
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

		// Delete all lines in the chunk from left file (in reverse order to maintain line numbers)
		for (let i = chunk.endIndex; i >= chunk.startIndex; i--) {
			const line = diffResult.lines[i];
			if (
				line.type === "removed" &&
				line.leftNumber !== null &&
				line.leftNumber > 0
			) {
				await RemoveLineFromFile(leftFilePath, line.leftNumber);
			}
		}

		// Refresh the diff
		await compareBothFiles();
		await updateUnsavedChangesStatus();
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

		// Remove the line from the right file using the backend function
		if (line.rightNumber !== null && line.rightNumber > 0) {
			await RemoveLineFromFile(rightFilePath, line.rightNumber);

			// Refresh the diff to show the changes
			await compareBothFiles();
			await updateUnsavedChangesStatus();

			_errorMessage = "Line deleted successfully";
		}
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

		// Remove the line from the left file using the backend function
		if (line.leftNumber !== null && line.leftNumber > 0) {
			await RemoveLineFromFile(leftFilePath, line.leftNumber);

			// Refresh the diff to show the changes
			await compareBothFiles();
			await updateUnsavedChangesStatus();

			_errorMessage = "Line deleted successfully";
		}
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
	handleKeyboardShortcut(
		event,
		saveLeftFile,
		saveRightFile,
		leftFilePath,
		rightFilePath,
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

function scrollToFirstDiff(): void {
	try {
		if (!highlightedDiffResult || !leftPane || !rightPane || !centerGutter) {
			return;
		}

		// Find the first line that's not "same"
		const firstDiffIndex = highlightedDiffResult.lines.findIndex(
			(line) => line.type !== "same",
		);

		if (firstDiffIndex === -1) {
			return;
		}

		// Calculate the line height from CSS variable
		const computedStyle = window.getComputedStyle(document.documentElement);
		const lineHeightValue = computedStyle.getPropertyValue("--line-height");
		const fontSize = 13; // Approximate px value
		// Parse the em value and convert to px
		const lineHeight = parseFloat(lineHeightValue) || 1.5;
		const lineHeightPx = lineHeight * fontSize;

		// Calculate the position of the first diff
		const firstDiffPosition = firstDiffIndex * lineHeightPx;

		// Get the viewport height
		const viewportHeight = leftPane.clientHeight;
		const middleOfViewport = viewportHeight / 2;

		// Always scroll to center the first diff in the viewport
		// Calculate scroll position to center the first diff
		const scrollTo = Math.max(0, firstDiffPosition - middleOfViewport);

		// Ensure all panes are ready and synced
		requestAnimationFrame(() => {
			// Set scroll position on all panes simultaneously
			isScrollSyncing = true;
			leftPane.scrollTop = scrollTo;
			rightPane.scrollTop = scrollTo;
			centerGutter.scrollTop = scrollTo;
			// Allow sync to resume after a frame
			requestAnimationFrame(() => {
				isScrollSyncing = false;
			});
		});
	} catch (error) {
		console.error("Error in scrollToFirstDiff:", error);
	}
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
	console.log("Theme initialized:", theme, "isDarkMode:", isDarkMode);

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

	// Wait for next tick to ensure elements are mounted
	setTimeout(() => {
		if (leftPane) resizeObserver.observe(leftPane);
		if (rightPane) resizeObserver.observe(rightPane);
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
	if (leftPane && rightPane) {
		// Check if either pane has horizontal overflow
		const leftHasScroll = leftPane.scrollWidth > leftPane.clientWidth;
		const rightHasScroll = rightPane.scrollWidth > rightPane.clientWidth;
		_hasHorizontalScrollbar = leftHasScroll || rightHasScroll;
	}
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
    <div class="file-selectors">
      <button class="file-btn" on:click={_selectLeftFile}>
        📂 {leftFileName}
      </button>
      <button class="file-btn" on:click={_selectRightFile}>
        📂 {rightFileName}
      </button>
      <button class="compare-btn" on:click={compareBothFiles} disabled={!leftFilePath || !rightFilePath || _isComparing || _hasCompletedComparison}>
        {#if _isComparing}
          Comparing files...
        {:else}
          Compare Files
        {/if}
      </button>
    </div>
    
    {#if _errorMessage}
      <div class="error">{_errorMessage}</div>
    {/if}
  </div>

  <div class="diff-container">
    {#if diffResult}
      <div class="file-header {highlightedDiffResult?.lines?.[0]?.type !== 'same' ? 'first-line-diff' : ''}" style="--line-number-width: {lineNumberWidth}">
        <div class="file-info left">
          <button class="save-btn" disabled={!_hasUnsavedLeftChanges} on:click={saveLeftFile} title="Save left file">💾</button>
          <span class="file-path">{getDisplayPath(leftFilePath, rightFilePath, true)}</span>
        </div>
        <div class="action-gutter-header">
          <!-- Empty header space above action gutter -->
        </div>
        <div class="file-info right">
          <button class="save-btn" disabled={!_hasUnsavedRightChanges} on:click={saveRightFile} title="Save right file">💾</button>
          <span class="file-path">{getDisplayPath(leftFilePath, rightFilePath, false)}</span>
        </div>
      </div>
      
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
        <div class="left-pane" bind:this={leftPane} on:scroll={_syncLeftScroll}>
          <div class="pane-content" style="min-height: calc({(highlightedDiffResult?.lines || []).length} * var(--line-height));">
            {#each (highlightedDiffResult?.lines || []) as line, index}
              {@const chunk = _getChunkForLine(index)}
              {@const isFirstInChunk = chunk ? _isFirstLineOfChunk(index, chunk) : false}
              {@const isLastInChunk = chunk ? index === chunk.endIndex : false}
              <div class="line {getLineClass(line.type)} {chunk && isFirstInChunk ? 'chunk-start' : ''} {chunk && isLastInChunk ? 'chunk-end' : ''}" data-line-type={line.type}>
                <span class="line-number">{line.leftNumber || ' '}</span>
                <span class="line-text">{@html line.leftLineHighlighted || escapeHtml(line.leftLine || ' ')}</span>
              </div>
            {/each}
          </div>
        </div>
        
        <div class="center-gutter" bind:this={centerGutter} on:scroll={_syncCenterScroll}>
          <div class="gutter-content" style="height: calc({(highlightedDiffResult?.lines || []).length} * var(--line-height));">
            {#each (highlightedDiffResult?.lines || []) as line, index}
              {@const chunk = _getChunkForLine(index)}
              {@const isFirstInChunk = chunk ? _isFirstLineOfChunk(index, chunk) : false}
              {@const isLastInChunk = chunk ? index === chunk.endIndex : false}
              
              <div class="gutter-line {chunk && isFirstInChunk ? 'chunk-start' : ''} {chunk && isLastInChunk ? 'chunk-end' : ''}">
              {#if chunk && isFirstInChunk}
                <!-- Show chunk arrows only on the first line of the chunk, but position them in the middle -->
                <div class="chunk-actions" style="--chunk-height: {chunk.lines};">
                  {#if chunk.type === 'added'}
                    <!-- Content exists in RIGHT pane, so put copy arrow on RIGHT side and delete arrow on LEFT side -->
                    <button class="gutter-arrow left-side-arrow chunk-arrow" on:click={() => _deleteChunkFromRight(chunk)} title="Delete chunk from right ({chunk.lines} lines)">
                      →
                    </button>
                    <button class="gutter-arrow right-side-arrow chunk-arrow" on:click={() => _copyChunkToLeft(chunk)} title="Copy chunk to left ({chunk.lines} lines)">
                      ←
                    </button>
                  {:else if chunk.type === 'removed'}
                    <!-- Content exists in LEFT pane, so put copy arrow on LEFT side and delete arrow on RIGHT side -->
                    <button class="gutter-arrow left-side-arrow chunk-arrow" on:click={() => _copyChunkToRight(chunk)} title="Copy chunk to right ({chunk.lines} lines)">
                      →
                    </button>
                    <button class="gutter-arrow right-side-arrow chunk-arrow" on:click={() => _deleteChunkFromLeft(chunk)} title="Delete chunk from left ({chunk.lines} lines)">
                      ←
                    </button>
                  {:else if chunk.type === 'modified'}
                    <!-- Content exists in BOTH panes but is different, allow copying either direction -->
                    <button class="gutter-arrow left-side-arrow chunk-arrow modified-arrow" on:click={() => _copyModifiedChunkToRight(chunk)} title="Copy left version to right ({chunk.lines} lines)">
                      →
                    </button>
                    <button class="gutter-arrow right-side-arrow chunk-arrow modified-arrow" on:click={() => _copyModifiedChunkToLeft(chunk)} title="Copy right version to left ({chunk.lines} lines)">
                      ←
                    </button>
                  {/if}
                </div>
              {:else if line.type === 'modified'}
                <!-- Modified lines stay as single-line operations -->
                <button class="gutter-arrow left-side-arrow" on:click={() => copyLineToRight(index)} title="Copy left to right">
                  →
                </button>
                <button class="gutter-arrow right-side-arrow" on:click={() => copyLineToLeft(index)} title="Copy right to left">
                  ←
                </button>
              {:else if !chunk && line.type === 'same' && line.leftLine && line.rightLine && line.leftLine !== line.rightLine}
                <!-- Backend marked as 'same' but content actually differs - treat as modified -->
                <button class="gutter-arrow left-side-arrow" on:click={() => copyLineToRight(index)} title="Copy left to right">
                  →
                </button>
                <button class="gutter-arrow right-side-arrow" on:click={() => copyLineToLeft(index)} title="Copy right to left">
                  ←
                </button>
              {/if}
              <!-- Invisible content to match line structure -->
              <span style="visibility: hidden; font-size: var(--font-size);">​</span>
            </div>
          {/each}
          </div>
        </div>
        
        <div class="right-pane" bind:this={rightPane} on:scroll={_syncRightScroll}>
          <div class="pane-content" style="min-height: calc({(highlightedDiffResult?.lines || []).length} * var(--line-height));">
            {#each (highlightedDiffResult?.lines || []) as line, index}
              {@const chunk = _getChunkForLine(index)}
              {@const isFirstInChunk = chunk ? _isFirstLineOfChunk(index, chunk) : false}
              {@const isLastInChunk = chunk ? index === chunk.endIndex : false}
              <div class="line {getLineClass(line.type)} {chunk && isFirstInChunk ? 'chunk-start' : ''} {chunk && isLastInChunk ? 'chunk-end' : ''}" data-line-type={line.type}>
                <span class="line-number">{line.rightNumber || ' '}</span>
                <span class="line-text">{@html line.rightLineHighlighted || escapeHtml(line.rightLine || ' ')}</span>
              </div>
            {/each}
          </div>
        </div>
        
        <!-- Minimap Pane -->
        {#if highlightedDiffResult && highlightedDiffResult.lines.length > 0}
          <div class="minimap-pane">
            <div class="minimap" on:click={_handleMinimapClick}>
              {#each lineChunks as chunk}
                {#if chunk.type !== 'same'}
                  <div 
                    class="minimap-chunk minimap-{chunk.type}" 
                    style="top: {(chunk.startIndex / highlightedDiffResult.lines.length) * 100}%; 
                           height: {(chunk.lines / highlightedDiffResult.lines.length) * 100}%;"
                    data-chunk-start={chunk.startIndex}
                    data-chunk-lines={chunk.lines}
                  ></div>
                {/if}
              {/each}
            </div>
          </div>
        {/if}
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

  <!-- Quit Dialog Modal -->
  {#if _showQuitDialog}
    <div class="modal-overlay" on:click={() => _showQuitDialog = false}>
      <div class="quit-dialog" on:click|stopPropagation>
        <h3>Unsaved Changes</h3>
        <p>Select which files to save before quitting:</p>
        
        <div class="file-list">
          {#if leftFilePath}
            <label class="file-item">
              <input 
                type="checkbox" 
                bind:checked={fileSelections[leftFilePath]}
                disabled={!_quitDialogFiles.includes(leftFilePath)}
              />
              <span class="file-name">{getDisplayFileName(leftFilePath)}</span>
              {#if !_quitDialogFiles.includes(leftFilePath)}
                <span class="file-status">(no changes)</span>
              {/if}
            </label>
          {/if}
          
          {#if rightFilePath}
            <label class="file-item">
              <input 
                type="checkbox" 
                bind:checked={fileSelections[rightFilePath]}
                disabled={!_quitDialogFiles.includes(rightFilePath)}
              />
              <span class="file-name">{getDisplayFileName(rightFilePath)}</span>
              {#if !_quitDialogFiles.includes(rightFilePath)}
                <span class="file-status">(no changes)</span>
              {/if}
            </label>
          {/if}
        </div>
        
        <div class="dialog-buttons">
          <button class="btn-primary" on:click={_handleSaveAndQuit}>
            Save Selected & Quit
          </button>
          <button class="btn-secondary" on:click={_handleQuitWithoutSaving}>
            Quit Without Saving
          </button>
          <button class="btn-tertiary" on:click={() => _showQuitDialog = false}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  {/if}
</main>

<style>
  :global(html) {
    transition: background-color 0.3s ease, color 0.3s ease;
  }

  *, *::before, *::after {
  }
  
  :root {
    --line-height: 19.2px;
    --font-size: 0.8rem;
    --gutter-width: 72px;
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

  :global([data-theme="dark"]) .file-btn {
    background: #363a4f;
    border-color: #5b6078;
    color: #cad3f5;
  }

  :global([data-theme="dark"]) .file-btn:hover {
    background: #414559;
  }

  :global([data-theme="dark"]) .compare-btn {
    background: #8aadf4;
    border-color: #8aadf4;
    color: #24273a;
  }

  :global([data-theme="dark"]) .compare-btn:hover:not(:disabled) {
    background: #7dc4e4;
  }

  :global([data-theme="dark"]) .compare-btn:disabled {
    background: #5b6078;
    border-color: #5b6078;
    color: #a5adcb;
    opacity: 0.7;
  }

  :global([data-theme="dark"]) .file-header {
    background: #1e2030;
    border-bottom-color: #363a4f;
  }

  :global([data-theme="dark"]) .file-info {
    border-right-color: #363a4f;
    color: #cad3f5;
  }

  :global([data-theme="dark"]) .save-btn {
    background: #494d64;
    border-color: #5b6078;
  }

  :global([data-theme="dark"]) .save-btn:disabled {
    background: #3c4043;
    border-color: #494d64;
    opacity: 0.5;
  }

  :global([data-theme="dark"]) .save-btn:not(:disabled):hover {
    background: #5b6078;
    border-color: #6e738d;
  }

  :global([data-theme="dark"]) .action-gutter-header {
    background: #1e2030;
    border-left-color: #363a4f;
    border-right-color: #363a4f;
  }

  :global([data-theme="dark"]) .left-pane,
  :global([data-theme="dark"]) .right-pane {
    background: #24273a;
    border-right-color: #363a4f;
  }

  /* Dark mode line number gutter background */
  :global([data-theme="dark"]) .left-pane::before, 
  :global([data-theme="dark"]) .right-pane::before {
    background: #1e2030;
  }

  :global([data-theme="dark"]) .line-number {
    background: #1e2030;
    border: none; /* Explicitly remove all borders */
    color: #8087a2;
    z-index: 100;
  }

  /* Old approach - dark mode version
  :global([data-theme="dark"]) .pane-content::after {
    background: #1e2030;
  } */

  :global([data-theme="dark"]) .line-text {
    color: #cad3f5; /* Removed !important to allow syntax highlighting */
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
    border-bottom: 1px solid #dce0e8;
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
    border: 1px solid #dce0e8;
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
    border-bottom: 1px solid #dce0e8;
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

  .file-selectors {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .file-btn {
    padding: 0.5rem 1rem;
    border: 1px solid #acb0be;
    border-radius: 4px;
    background: #dce0e8;
    cursor: pointer;
    font-size: 0.9rem;
    min-width: 200px;
    text-align: left;
    color: #4c4f69;
  }

  .file-btn:hover {
    background: #ccd0da;
  }

  .compare-btn {
    padding: 0.5rem 1rem;
    border: 1px solid #1e66f5;
    border-radius: 4px;
    background: #1e66f5;
    color: #eff1f5;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    min-width: 150px;
    height: auto;
  }

  .compare-btn:hover:not(:disabled) {
    background: #04a5e5;
  }

  .compare-btn:disabled {
    background: #94a3b8;
    cursor: not-allowed;
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

  .file-header {
    display: grid;
    grid-template-columns: 1fr 72px 1fr;
    border-bottom: 1px solid #dce0e8;
    background: #e6e9ef;
  }
  
  .file-header.first-line-diff {
    padding-bottom: 8px;
  }

  .action-gutter-header {
    background: #e6e9ef;
    border-right: 1px solid #dce0e8; /* Match the gutter border below */
  }

  .file-info {
    display: flex;
    align-items: center;
    padding: 0.5rem 0.5rem 0.5rem calc(var(--line-number-width, 32px) + 24px);
    font-weight: 400;
    color: #4c4f69;
    text-align: left;
    position: relative;
  }

  .file-info:first-child {
    border-right: none;
  }

  .file-info:last-child {
    border-left: none;
  }

  .save-btn {
    width: 24px;
    height: 24px;
    background: #bcc0cc;
    border: 1px solid #acb0be;
    border-radius: 4px;
    cursor: pointer;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.2s ease;
    margin-right: 16px;
    position: absolute;
    left: 1rem;
  }

  .file-path {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .save-btn:disabled {
    background: #e0e4ea;
    border-color: #ccd0da;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .save-btn:not(:disabled):hover {
    background: #a6adc8;
    border-color: #9ca0b0;
  }

  .file-path {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }


  .diff-content {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .left-pane, .right-pane {
    flex: 1;
    min-width: 0;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
    font-size: var(--font-size);
    line-height: var(--line-height);
    overflow: auto;
    background: #eff1f5;
    position: relative;
  }

  /* Line number gutter background that extends full height */
  .left-pane::before, .right-pane::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: calc(var(--line-number-width, 32px) + 1px);
    bottom: 0;
    background: #e6e9ef;
    pointer-events: none;
    z-index: 1;
  }

  .center-gutter {
    width: var(--gutter-width);
    background: #e6e9ef;
    /* border-left: 1px solid #dce0e8; */ /* Removed to match content panes */
    border-right: 1px solid #dce0e8; /* Visual separator from right pane */
    overflow: auto;
    flex-shrink: 0;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
    font-size: var(--font-size);
    line-height: var(--line-height);
    /* Hide scrollbar - users should scroll via content panes */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
  }

  .gutter-content {
    display: inline-block;
    min-width: 100%;
    width: fit-content;
    position: relative;
    /* padding-bottom handled dynamically based on horizontal scrollbar */
    line-height: var(--line-height);
    min-height: 100%; /* Ensure minimum height matches container */
  }

  .gutter-content::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: calc(100% + 30px); /* Match the pane-content height calculation */
    background: transparent;
    z-index: -1;
    pointer-events: none;
  }

  /* Hide vertical scrollbar in gutter - users should scroll via content panes */
  .center-gutter::-webkit-scrollbar:vertical {
    width: 0; /* Hide scrollbar */
  }
  
  .center-gutter::-webkit-scrollbar:horizontal {
    height: 5px; /* Match the main scrollbar height */
  }
  
  /* Ensure panes also have consistent scrollbar sizing */
  .left-pane::-webkit-scrollbar,
  .right-pane::-webkit-scrollbar {
    width: 5px;
    height: 5px;
  }
  
  .left-pane::-webkit-scrollbar-track,
  .right-pane::-webkit-scrollbar-track,
  .center-gutter::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .left-pane::-webkit-scrollbar-thumb,
  .right-pane::-webkit-scrollbar-thumb,
  .center-gutter::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 6px;
  }
  
  .left-pane::-webkit-scrollbar-thumb:hover,
  .right-pane::-webkit-scrollbar-thumb:hover,
  .center-gutter::-webkit-scrollbar-thumb:hover {
    background: #555;
  }

  /* ===========================================
   * MINIMAP STYLES
   * =========================================== */

  .minimap-pane {
    width: 18px;
    background: #e6e9ef;
    border-left: 1px solid #dce0e8;
    flex-shrink: 0;
    overflow: hidden;
    position: relative;
  }

  .minimap {
    width: 100%;
    height: calc(100% - 5px); /* Leave space for horizontal scrollbar */
    cursor: pointer;
    position: relative;
    min-height: 300px; /* Fixed height for the minimap */
  }

  .minimap-chunk {
    position: absolute;
    width: 100%;
    left: 0;
    border-radius: 1px;
  }

  .minimap-same {
    background: #eff1f5;
  }

  .minimap-added {
    background: rgba(33, 150, 243, 0.7);
  }

  .minimap-removed {
    background: rgba(33, 150, 243, 0.7);
  }

  .minimap-modified {
    background: rgba(255, 193, 7, 0.8);
  }

  .minimap-chunk:hover {
    opacity: 0.5;
  }

  /* Dark mode minimap */
  :global([data-theme="dark"]) .minimap-pane {
    background: #1e2030;
    border-left-color: #363a4f;
  }

  :global([data-theme="dark"]) .minimap-same {
    background: #24273a;
  }

  :global([data-theme="dark"]) .minimap-added {
    background: rgba(100, 181, 246, 0.7);
  }

  :global([data-theme="dark"]) .minimap-removed {
    background: rgba(100, 181, 246, 0.7);
  }

  :global([data-theme="dark"]) .minimap-modified {
    background: rgba(255, 183, 77, 0.8);
  }

  .gutter-line {
    display: flex;
    height: var(--line-height);
    min-height: var(--line-height);
    align-items: stretch;
    justify-content: center;
    position: relative;
    margin: 0;
    padding: 0;
    white-space: pre;
    width: 100%;
    font-size: var(--font-size); /* Ensure same font size */
    line-height: var(--line-height); /* Ensure same line height */
    /* border-bottom: 1px solid rgba(255, 0, 255, 0.3); */ /* Magenta border for visibility - uncomment for debugging */
  }

  /* Special styling for chunk start lines */
  .gutter-line.chunk-start {
    position: relative;
  }
  
  /* Chunk-based arrow styling */
  .chunk-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    position: absolute;
    /* Dynamic positioning based on chunk size */
    top: calc((var(--chunk-height) - 1) * var(--line-height) / 2);
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    height: var(--line-height);
  }
  
  .chunk-arrow {
    width: 24px !important;
    height: 24px !important;
    font-size: 14px !important;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .chunk-arrow:hover {
    transform: scale(1.15);
  }

  .pane-content {
    display: inline-block;
    min-width: 100%;
    width: fit-content;
    position: relative;
    /* padding-bottom: 30px; */ /* Removed - unnecessary dead space */
    line-height: var(--line-height);
    min-height: 100%; /* Ensure minimum height matches container */
  }

  /* Old approach - replaced with full-height gutter on panes
  .pane-content::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: calc(var(--line-number-width, 32px) + 1px);
    height: calc(100% + 30px);
    background: #e6e9ef;
    z-index: -1;
    pointer-events: none;
  } */

  .line {
    display: flex;
    height: var(--line-height);
    min-height: var(--line-height);
    white-space: pre;
    align-items: stretch;
    width: 100%;
    position: relative;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    border: none; /* Explicitly remove all borders from line elements */
    /* border-bottom: 1px solid rgba(255, 0, 255, 0.3); */ /* Magenta border for visibility - uncomment for debugging */
  }

  /* Ensure no gaps between line elements */
  .line + .line {
    /* margin-top: -1px; */ /* Removed - was affecting arrow positioning */
  }
  
  
  /* Spacer line for breathing room */
  .line-spacer {
    height: 1.3em;
    min-height: 1.3em;
    background: transparent;
  }
  
  .line-spacer .line-number {
    background: transparent !important;
    border-right: 1px solid #dce0e8;
  }
  

  .pane-action {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 20px;
    font-size: 8px;
  }

  .line-number {
    width: var(--line-number-width, 32px);
    padding: 0 5px 0 15px;
    text-align: right;
    color: #6c6f85;
    background: #e6e9ef;
    border: none; /* Explicitly remove all borders */
    user-select: none;
    flex-shrink: 0;
    position: sticky;
    left: 0;
    z-index: 100;
    font-size: 0.75rem;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: var(--line-height);
    min-height: var(--line-height);
    line-height: var(--line-height);
    box-sizing: border-box;
  }

  /* Empty line numbers should show nothing */
  .line-number:empty::before {
    content: ''; /* No content for empty line numbers */
  }

  .line-text {
    padding: 0 0.5rem;
    color: #4c4f69;
    white-space: pre;
    text-align: left;
    font-family: inherit;
    tab-size: 4;
    background: transparent;
    min-width: max-content;
    position: relative;
    overflow: hidden;
  }

  /* Add borders to content area only, not line numbers */
  .line-same .line-text {
    border-left: 3px solid #eff1f5;
  }

  .line-added .line-text,
  .line-removed .line-text,
  .line-modified .line-text {
    border-left: 3px solid #1e66f5;
  }


  /* ===========================================
   * CHUNK HIGHLIGHTING - Full-width line backgrounds
   * =========================================== */

  /* Default line (no changes) */
  .line-same {
    background: #eff1f5;
    /* border-left: 3px solid #eff1f5; */ /* Removed for consistency */
  }

  .line-same .line-text {
    color: #4c4f69;
  }

  /* Base styles for diff lines (chunk highlighting) */
  .line-added,
  .line-removed,
  .line-modified {
    /* background: rgba(30, 102, 245, 0.1); */ /* Temporarily removed to test borders */
    /* border-left: 3px solid #1e66f5; */ /* Removed blue accent border */
  }

  .line-added .line-number,
  .line-removed .line-number,
  .line-modified .line-number {
    background: #e6e9ef; /* Keep line numbers opaque */
    color: #1e66f5; /* Blue text for diff line numbers */
  }

  .line-added .line-text,
  .line-removed .line-text,
  .line-modified .line-text {
    color: #4c4f69; /* Standard text color */
  }

  /* ===========================================
   * INLINE HIGHLIGHTING - Specific content changes
   * =========================================== */

  /* Inline diff highlighting within modified lines */
  :global(.inline-diff-highlight) {
    background-color: rgba(30, 102, 245, 0.3) !important;
    color: #4c4f69;
    padding: 0 2px !important;
    border-radius: 2px !important;
    font-weight: normal;
    min-height: var(--line-height);
    display: inline-block;
    line-height: var(--line-height);
    vertical-align: top;
  }

  /* Full-line inline highlighting for added/removed lines */
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
  }

  /* ===========================================
   * DARK MODE OVERRIDES
   * =========================================== */

  /* Dark mode chunk highlighting */
  :global([data-theme="dark"]) .line-same {
    background: #24273a;
    /* border-left: 3px solid #24273a; */ /* Removed for consistency */
  }

  :global([data-theme="dark"]) .line-same .line-text {
    color: #cad3f5;
    border-left: 3px solid #24273a;
  }

  :global([data-theme="dark"]) .line-added,
  :global([data-theme="dark"]) .line-removed,
  :global([data-theme="dark"]) .line-modified {
    background: rgba(138, 173, 244, 0.15); /* Darker blue chunk background */
    /* border-left-color: #8aadf4; */ /* Removed lighter blue accent */
  }

  :global([data-theme="dark"]) .line-added .line-number,
  :global([data-theme="dark"]) .line-removed .line-number,
  :global([data-theme="dark"]) .line-modified .line-number {
    background: #1e2030; /* Dark line number background */
    color: #8aadf4; /* Light blue text */
  }

  :global([data-theme="dark"]) .line-added .line-text,
  :global([data-theme="dark"]) .line-removed .line-text,
  :global([data-theme="dark"]) .line-modified .line-text {
    color: #cad3f5; /* Light text for dark mode */
    border-left: 3px solid #8aadf4;
  }

  /* Dark mode inline highlighting */
  :global([data-theme="dark"]) :global(.inline-diff-highlight) {
    background-color: rgba(138, 173, 244, 0.3) !important;
    color: #cad3f5;
    font-weight: normal;
  }

  :global([data-theme="dark"]) :global(.inline-diff-highlight-full) {
    background-color: rgba(138, 173, 244, 0.3) !important;
    color: #cad3f5;
    font-weight: normal;
  }

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

  .gutter-arrow {
    background: transparent;
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
  }

  .gutter-arrow:hover {
    transform: scale(1.1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    background: rgba(0, 0, 0, 0.05);
  }

  .left-arrow {
    color: #16a34a;
  }

  .left-arrow:hover {
    color: #15803d;
  }

  .right-arrow {
    color: #dc2626;
  }

  .right-arrow:hover {
    color: #b91c1c;
  }

  .delete-arrow {
    color: #dc2626;
  }

  .delete-arrow:hover {
    color: #b91c1c;
  }

  .left-side-arrow {
    color: #1e66f5;
  }

  .left-side-arrow:hover {
    color: #1756c9;
  }

  .right-side-arrow {
    color: #1e66f5;
  }

  .right-side-arrow:hover {
    color: #1756c9;
  }

  /* Modified arrows - same color for both directions */
  .modified-arrow {
    color: #1e66f5 !important;
  }

  .modified-arrow:hover {
    color: #1756c9 !important;
  }

  .gutter-line {
    position: relative;
  }

  /* Dark mode gutter arrows */
  :global([data-theme="dark"]) .center-gutter {
    background: #1e2030;
    /* border-left-color: #363a4f; */ /* Removed - no borders */
    border-right-color: #363a4f; /* Dark mode border color */
  }

  :global([data-theme="dark"]) .gutter-arrow {
    background: transparent;
    color: #cad3f5;
  }

  :global([data-theme="dark"]) .gutter-arrow:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  :global([data-theme="dark"]) .left-arrow {
    color: #a6da95;
  }

  :global([data-theme="dark"]) .left-arrow:hover {
    color: #a6da95;
  }

  :global([data-theme="dark"]) .right-arrow {
    color: #ed8796;
  }

  :global([data-theme="dark"]) .right-arrow:hover {
    color: #ed8796;
  }

  :global([data-theme="dark"]) .delete-arrow {
    color: #ed8796;
  }

  :global([data-theme="dark"]) .delete-arrow:hover {
    color: #ed8796;
  }

  :global([data-theme="dark"]) .left-side-arrow {
    color: #8aadf4;
  }

  :global([data-theme="dark"]) .left-side-arrow:hover {
    color: #7dc4e4;
  }

  :global([data-theme="dark"]) .right-side-arrow {
    color: #8aadf4;
  }

  :global([data-theme="dark"]) .right-side-arrow:hover {
    color: #7dc4e4;
  }

  /* Dark mode modified arrows */
  :global([data-theme="dark"]) .modified-arrow {
    color: #8aadf4 !important;
  }

  :global([data-theme="dark"]) .modified-arrow:hover {
    color: #7dc4e4 !important;
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
