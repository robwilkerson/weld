<script lang="ts">
import { createHighlighter } from "shiki";
import { onMount } from "svelte";
import {
	CompareFiles,
	CopyToFile,
	type DiffLine,
	type DiffResult,
	HasUnsavedChanges,
	QuitWithoutSaving,
	RemoveLineFromFile,
	SaveChanges,
	SaveSelectedFilesAndQuit,
	SelectFile,
} from "../wailsjs/go/main/App.js";
import { EventsOn, Quit } from "../wailsjs/runtime/runtime.js";

// Shiki highlighter instance
let highlighter: any = null;

// Cache for highlighted lines to avoid re-processing
const highlightCache: Map<string, string> = new Map();


let leftFilePath: string = "";
let rightFilePath: string = "";
let leftFileName: string = "Select left file...";
let rightFileName: string = "Select right file...";
let diffResult: DiffResult | null = null;
let isComparing: boolean = false;
let errorMessage: string = "";
let leftPane: HTMLElement;
let rightPane: HTMLElement;
let centerGutter: HTMLElement;
let isScrollSyncing: boolean = false;
let isDarkMode: boolean = true;
let hasUnsavedLeftChanges: boolean = false;
let hasUnsavedRightChanges: boolean = false;
let hasHorizontalScrollbar: boolean = false;

// Quit dialog state
let showQuitDialog: boolean = false;
let quitDialogFiles: string[] = [];
let fileSelections: Record<string, boolean> = {};

$: isSameFile = leftFilePath && rightFilePath && leftFilePath === rightFilePath;

// Only show "files are identical" banner if they're identical on disk
$: areFilesIdentical =
	diffResult?.lines &&
	diffResult.lines.length > 0 &&
	diffResult.lines.every((line) => line.type === "same") &&
	leftFilePath !== rightFilePath;

$: lineNumberWidth = getLineNumberWidth();

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

// Process highlighting when diffResult changes
$: if (diffResult && highlighter && !isProcessingHighlight) {
	processHighlighting(diffResult);
} else if (diffResult && !highlighter) {
	// Set result without highlighting for now
	highlightedDiffResult = {
		lines: diffResult.lines.map((line) => ({
			...line,
			leftLineHighlighted: escapeHtml(line.leftLine || ""),
			rightLineHighlighted: escapeHtml(line.rightLine || ""),
		})),
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
			lines: result.lines.map((line) => ({
				...line,
				leftLineHighlighted: escapeHtml(line.leftLine || ""),
				rightLineHighlighted: escapeHtml(line.rightLine || ""),
			})),
		};
		isProcessingHighlight = false;
		return;
	}

	try {
		// For now, disable syntax highlighting to avoid lockups
		// TODO: Implement with web workers or lazy loading
		highlightedDiffResult = {
			lines: result.lines.map((line) => ({
				...line,
				leftLineHighlighted: escapeHtml(line.leftLine || ""),
				rightLineHighlighted: escapeHtml(line.rightLine || ""),
			})),
		};
		
		// After highlighting is done, scroll to first diff
		setTimeout(() => scrollToFirstDiff(), 200);
	} catch (error) {
		console.error("Error processing highlighting:", error);
		// Fallback to non-highlighted version
		highlightedDiffResult = {
			lines: result.lines.map((line) => ({
				...line,
				leftLineHighlighted: escapeHtml(line.leftLine || ""),
				rightLineHighlighted: escapeHtml(line.rightLine || ""),
			})),
		};
		
		// Check for horizontal scrollbar after content is rendered
		setTimeout(() => {
			checkHorizontalScrollbar();
		}, 0);
	} finally {
		isProcessingHighlight = false;
	}
}

// Update unsaved changes status
async function updateUnsavedChangesStatus(): Promise<void> {
	if (leftFilePath) {
		hasUnsavedLeftChanges = await HasUnsavedChanges(leftFilePath);
	}
	if (rightFilePath) {
		hasUnsavedRightChanges = await HasUnsavedChanges(rightFilePath);
	}
}

// Quit dialog functions
function handleQuitDialog(unsavedFiles: string[]): void {
	quitDialogFiles = unsavedFiles;
	showQuitDialog = true;

	// Initialize file selections - dirty files checked by default, clean files unchecked and disabled
	fileSelections = {};
	for (const file of [leftFilePath, rightFilePath]) {
		if (file) {
			fileSelections[file] = unsavedFiles.includes(file);
		}
	}
}

async function handleSaveAndQuit(): Promise<void> {
	const filesToSave = Object.entries(fileSelections)
		.filter(([_, selected]) => selected)
		.map(([filepath, _]) => filepath);

	try {
		await SaveSelectedFilesAndQuit(filesToSave);
	} catch (error) {
		console.error("Error saving files:", error);
		errorMessage = `Error saving files: ${error}`;
	}
}

async function handleQuitWithoutSaving(): Promise<void> {
	try {
		await QuitWithoutSaving();
	} catch (error) {
		console.error("Error quitting:", error);
	}
}

function getDisplayFileName(filepath: string): string {
	return filepath.split("/").pop() || filepath;
}

function escapeHtml(text: string): string {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

function extractHighlightedLines(html: string): string[] {
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

async function selectLeftFile(): Promise<void> {
	try {
		const path = await SelectFile();
		if (path) {
			leftFilePath = path;
			leftFileName = path.split("/").pop() || path;
			await updateUnsavedChangesStatus();
			errorMessage = `Left file selected: ${leftFileName}`;
			diffResult = null; // Clear previous results
		} else {
			errorMessage = "No left file selected";
		}
	} catch (error) {
		console.error("Error selecting left file:", error);
		errorMessage = `Error selecting left file: ${error}`;
	}
}

async function selectRightFile(): Promise<void> {
	try {
		const path = await SelectFile();
		if (path) {
			rightFilePath = path;
			rightFileName = path.split("/").pop() || path;
			await updateUnsavedChangesStatus();
			errorMessage = `Right file selected: ${rightFileName}`;
			diffResult = null; // Clear previous results
		} else {
			errorMessage = "No right file selected";
		}
	} catch (error) {
		console.error("Error selecting right file:", error);
		errorMessage = `Error selecting right file: ${error}`;
	}
}

async function compareBothFiles(): Promise<void> {
	if (!leftFilePath || !rightFilePath) {
		errorMessage = "Please select both files before comparing";
		return;
	}

	try {
		isComparing = true;
		errorMessage = "";

		diffResult = await CompareFiles(leftFilePath, rightFilePath);
		
		if (!diffResult || !diffResult.lines) {
			errorMessage = "No comparison result received";
			diffResult = null;
		} else if (diffResult.lines.length === 0) {
			errorMessage = "Files are identical";
		}
		
		// Check for horizontal scrollbar after diff is loaded
		setTimeout(() => {
			checkHorizontalScrollbar();
		}, 100);
	} catch (error) {
		console.error("Comparison error:", error);
		errorMessage = `Error comparing files: ${error}`;
		diffResult = null;
	} finally {
		isComparing = false;
	}
}

function getLineClass(type: string): string {
	switch (type) {
		case "added":
			return "line-added";
		case "removed":
			return "line-removed";
		case "modified":
			return "line-modified";
		default:
			return "line-same";
	}
}

function syncLeftScroll() {
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

function syncRightScroll() {
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

function syncCenterScroll() {
	if (isScrollSyncing || !leftPane || !rightPane || !centerGutter) return;
	isScrollSyncing = true;
	// Sync center gutter scroll to both content panes
	leftPane.scrollTop = centerGutter.scrollTop;
	rightPane.scrollTop = centerGutter.scrollTop;
	setTimeout(() => (isScrollSyncing = false), 10);
}

function expandTildePath(path: string): string {
	if (path.startsWith("~/")) {
		const home = process.env.HOME || process.env.USERPROFILE || "";
		return path.replace("~", home);
	}
	return path;
}

function getDisplayPath(
	leftPath: string,
	rightPath: string,
	isLeft: boolean,
): string {
	const targetPath = isLeft ? leftPath : rightPath;
	const otherPath = isLeft ? rightPath : leftPath;

	if (!targetPath || !otherPath) return targetPath || "";

	const targetSegments = targetPath.split("/").filter((s) => s !== "");
	const otherSegments = otherPath.split("/").filter((s) => s !== "");

	if (targetSegments.length === 0) return targetPath;

	// Always show exactly 4 segments (3 directories + filename) when possible
	const totalSegmentsToShow = 4;

	// If we have 4 or fewer segments, show them all
	if (targetSegments.length <= totalSegmentsToShow) {
		return targetSegments.join("/");
	}

	// Show the last 4 segments (3 directories + filename)
	const segments = targetSegments.slice(-totalSegmentsToShow);
	return ".../" + segments.join("/");
}

async function initializeDefaultFiles(): Promise<void> {
	// Removed automatic file loading to prevent crashes
	// Users should manually select files to compare
}

function toggleDarkMode(): void {
	isDarkMode = !isDarkMode;
	document.documentElement.setAttribute(
		"data-theme",
		isDarkMode ? "dark" : "light",
	);
	// Clear highlight cache when theme changes since highlighting depends on theme
	highlightCache.clear();
	// Re-process highlighting with new theme if we have content
	if (diffResult) {
		processHighlighting(diffResult);
	}
}

async function copyLineToRight(lineIndex: number): Promise<void> {
	if (!diffResult || !diffResult.lines[lineIndex]) return;

	const line = diffResult.lines[lineIndex];
	if (line.type !== "removed") return;

	try {
		errorMessage = "Copying line to right file...";

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

		errorMessage = "Line copied successfully";
	} catch (error) {
		console.error("Error copying line to right:", error);
		errorMessage = `Error copying line: ${error}`;
	}
}

async function copyLineToLeft(lineIndex: number): Promise<void> {
	if (!diffResult || !diffResult.lines[lineIndex]) return;

	const line = diffResult.lines[lineIndex];
	if (line.type !== "added") return;

	try {
		errorMessage = "Copying line to left file...";

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

		errorMessage = "Line copied successfully";
	} catch (error) {
		console.error("Error copying line to left:", error);
		errorMessage = `Error copying line: ${error}`;
	}
}

async function copyLineFromRight(lineIndex: number): Promise<void> {
	await copyLineToLeft(lineIndex);
}

async function copyLineFromLeft(lineIndex: number): Promise<void> {
	await copyLineToRight(lineIndex);
}

async function copyChunkToRight(chunk: LineChunk): Promise<void> {
	if (!diffResult || !highlightedDiffResult) return;

	try {
		errorMessage = "Copying chunk to right file...";

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
		errorMessage = "Chunk copied successfully";
	} catch (error) {
		console.error("Error copying chunk to right:", error);
		errorMessage = `Error copying chunk: ${error}`;
	}
}

async function copyChunkToLeft(chunk: LineChunk): Promise<void> {
	if (!diffResult || !highlightedDiffResult) return;

	try {
		errorMessage = "Copying chunk to left file...";

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
		errorMessage = "Chunk copied successfully";
	} catch (error) {
		console.error("Error copying chunk to left:", error);
		errorMessage = `Error copying chunk: ${error}`;
	}
}

async function deleteChunkFromRight(chunk: LineChunk): Promise<void> {
	if (!diffResult || !highlightedDiffResult) return;

	try {
		errorMessage = "Deleting chunk from right file...";

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
		errorMessage = "Chunk deleted successfully";
	} catch (error) {
		console.error("Error deleting chunk from right:", error);
		errorMessage = `Error deleting chunk: ${error}`;
	}
}

async function deleteChunkFromLeft(chunk: LineChunk): Promise<void> {
	if (!diffResult || !highlightedDiffResult) return;

	try {
		errorMessage = "Deleting chunk from left file...";

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
		errorMessage = "Chunk deleted successfully";
	} catch (error) {
		console.error("Error deleting chunk from left:", error);
		errorMessage = `Error deleting chunk: ${error}`;
	}
}

async function deleteLineFromRight(lineIndex: number): Promise<void> {
	if (!diffResult || !diffResult.lines[lineIndex]) return;

	const line = diffResult.lines[lineIndex];
	if (line.type !== "added") return;

	try {
		errorMessage = "Deleting line from right file...";

		// Remove the line from the right file using the backend function
		if (line.rightNumber !== null && line.rightNumber > 0) {
			await RemoveLineFromFile(rightFilePath, line.rightNumber);

			// Refresh the diff to show the changes
			await compareBothFiles();
			await updateUnsavedChangesStatus();

			errorMessage = "Line deleted successfully";
		}
	} catch (error) {
		console.error("Error deleting line from right:", error);
		errorMessage = `Error deleting line: ${error}`;
	}
}

async function deleteLineFromLeft(lineIndex: number): Promise<void> {
	if (!diffResult || !diffResult.lines[lineIndex]) return;

	const line = diffResult.lines[lineIndex];
	if (line.type !== "removed") return;

	try {
		errorMessage = "Deleting line from left file...";

		// Remove the line from the left file using the backend function
		if (line.leftNumber !== null && line.leftNumber > 0) {
			await RemoveLineFromFile(leftFilePath, line.leftNumber);

			// Refresh the diff to show the changes
			await compareBothFiles();
			await updateUnsavedChangesStatus();

			errorMessage = "Line deleted successfully";
		}
	} catch (error) {
		console.error("Error deleting line from left:", error);
		errorMessage = `Error deleting line: ${error}`;
	}
}

async function saveLeftFile(): Promise<void> {
	try {
		await SaveChanges(leftFilePath);
		await updateUnsavedChangesStatus();
		errorMessage = "Left file saved successfully";
	} catch (error) {
		console.error("Error saving left file:", error);
		errorMessage = `Error saving left file: ${error}`;
	}
}

async function saveRightFile(): Promise<void> {
	try {
		await SaveChanges(rightFilePath);
		await updateUnsavedChangesStatus();
		errorMessage = "Right file saved successfully";
	} catch (error) {
		console.error("Error saving right file:", error);
		errorMessage = `Error saving right file: ${error}`;
	}
}

function handleKeydown(event: KeyboardEvent): void {
	const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
	const isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

	if (isCtrlOrCmd && event.key === "s") {
		event.preventDefault();

		// Save both files if they have changes
		if (leftFilePath) {
			saveLeftFile();
		}
		if (rightFilePath) {
			saveRightFile();
		}
	}
}

function getLineNumberWidth(): string {
	if (!diffResult || !diffResult.lines.length) return "32px";

	// Find the highest line number
	const maxLineNumber = Math.max(
		...diffResult.lines.map((line) =>
			Math.max(line.leftNumber || 0, line.rightNumber || 0),
		),
	);

	// Calculate width based on number of digits - much tighter calculation
	const digits = Math.max(2, maxLineNumber.toString().length);
	const width = digits * 6 + 8; // ~6px per digit + minimal 8px padding (4px each side)

	return `${width}px`;
}


async function highlightFileContent(
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

async function getHighlightedLine(
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
		console.warn("Error highlighting line:", error, "Line:", line.substring(0, 50));
		return escapeHtml(line);
	}
}

function detectLineChunks(lines: HighlightedDiffLine[]): LineChunk[] {
	const chunks: LineChunk[] = [];
	let currentChunk: LineChunk | null = null;

	lines.forEach((line, index) => {
		// Only create chunks for added/removed lines
		if (line.type === "added" || line.type === "removed") {
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

	console.log('Detected line chunks:', chunks.map(chunk => ({
		type: chunk.type,
		startIndex: chunk.startIndex,
		endIndex: chunk.endIndex,
		lines: chunk.lines,
		lineNumbers: `${chunk.startIndex + 1}-${chunk.endIndex + 1}`
	})));

	return chunks;
}

function isLineInChunk(lineIndex: number, chunk: LineChunk): boolean {
	return lineIndex >= chunk.startIndex && lineIndex <= chunk.endIndex;
}

function isFirstLineOfChunk(lineIndex: number, chunk: LineChunk): boolean {
	return lineIndex === chunk.startIndex;
}

function getChunkForLine(lineIndex: number): LineChunk | null {
	return lineChunks.find((chunk) => isLineInChunk(lineIndex, chunk)) || null;
}

function scrollToFirstDiff(): void {
	try {
		if (!highlightedDiffResult || !leftPane || !rightPane || !centerGutter) {
			return;
		}
		
		// Find the first line that's not "same"
		const firstDiffIndex = highlightedDiffResult.lines.findIndex(
			line => line.type !== 'same'
		);
		
		if (firstDiffIndex === -1) {
			return;
		}
		
		// Calculate the line height from CSS variable
		const computedStyle = window.getComputedStyle(document.documentElement);
		const lineHeightValue = computedStyle.getPropertyValue('--line-height');
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

function getLanguageFromExtension(ext: string): string {
	const languageMap: Record<string, string> = {
		js: "javascript",
		jsx: "jsx",
		ts: "typescript",
		tsx: "tsx",
		py: "python",
		java: "java",
		go: "go",
		php: "php",
		rb: "ruby",
		cs: "csharp",
		css: "css",
		scss: "scss",
		sass: "sass",
		json: "json",
		md: "markdown",
		sh: "bash",
		bash: "bash",
		zsh: "bash",
		c: "c",
		cpp: "cpp",
		h: "c",
		hpp: "cpp",
		rs: "rust",
		kt: "kotlin",
		swift: "swift",
		dart: "dart",
		html: "html",
		xml: "xml",
		yaml: "yaml",
		yml: "yaml",
		toml: "toml",
		sql: "sql",
		r: "r",
		lua: "lua",
		vim: "vim",
		dockerfile: "dockerfile",
	};

	return languageMap[ext] || "text";
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

	// Removed automatic file loading on startup
	document.documentElement.setAttribute("data-theme", "dark");

	// Add event listeners
	document.addEventListener("keydown", handleKeydown);
	EventsOn("show-quit-dialog", handleQuitDialog);

	// Initialize Shiki highlighter with Catppuccin themes
	try {
		highlighter = await createHighlighter({
			themes: ["catppuccin-macchiato", "catppuccin-latte"],
			langs: [
				"python",
				"javascript",
				"typescript",
				"java",
				"go",
				"php",
				"ruby",
				"csharp",
				"css",
				"scss",
				"sass",
				"json",
				"markdown",
				"bash",
				"c",
				"cpp",
				"rust",
				"kotlin",
				"swift",
				"dart",
				"html",
				"xml",
				"yaml",
				"toml",
				"sql",
				"r",
				"lua",
				"vim",
			],
		});
	} catch (error) {
		console.error("Failed to initialize Shiki:", error);
		highlighter = null;
	}

	// Set up ResizeObserver to detect scrollbar changes
	const resizeObserver = new ResizeObserver(() => {
		checkHorizontalScrollbar();
	});
	
	// Wait for next tick to ensure elements are mounted
	setTimeout(() => {
		if (leftPane) resizeObserver.observe(leftPane);
		if (rightPane) resizeObserver.observe(rightPane);
		checkHorizontalScrollbar();
	}, 0);

	// Cleanup on destroy
	return () => {
		document.removeEventListener("keydown", handleKeydown);
		if (highlighter) {
			highlighter.dispose?.();
		}
		resizeObserver.disconnect();
	};
});

function checkHorizontalScrollbar() {
	if (leftPane && rightPane) {
		// Check if either pane has horizontal overflow
		const leftHasScroll = leftPane.scrollWidth > leftPane.clientWidth;
		const rightHasScroll = rightPane.scrollWidth > rightPane.clientWidth;
		hasHorizontalScrollbar = leftHasScroll || rightHasScroll;
	}
}
</script>

<main>
  <div class="header">
    <button class="theme-toggle" on:click={toggleDarkMode} title={isDarkMode ? "Switch to ☀️ mode" : "Switch to 🌜 mode"}>
      {#if isDarkMode}
        🌜
      {:else}
        ☀️
      {/if}
    </button>
    <div class="file-selectors">
      <button class="file-btn" on:click={selectLeftFile}>
        📂 {leftFileName}
      </button>
      <button class="file-btn" on:click={selectRightFile}>
        📂 {rightFileName}
      </button>
      {#if leftFilePath && rightFilePath}
        <button class="compare-btn" on:click={compareBothFiles} disabled={isComparing}>
          {#if isComparing}
            Comparing files...
          {:else}
            Compare
          {/if}
        </button>
      {/if}
    </div>
    
    {#if errorMessage}
      <div class="error">{errorMessage}</div>
    {/if}
  </div>

  <div class="diff-container">
    {#if diffResult}
      <div class="file-header {highlightedDiffResult?.lines?.[0]?.type !== 'same' ? 'first-line-diff' : ''}" style="--line-number-width: {lineNumberWidth}">
        <div class="file-info left">
          <button class="save-btn" disabled={!hasUnsavedLeftChanges} on:click={saveLeftFile} title="Save left file">💾</button>
          <span class="file-path">{getDisplayPath(leftFilePath, rightFilePath, true)}</span>
        </div>
        <div class="action-gutter-header">
          <!-- Empty header space above action gutter -->
        </div>
        <div class="file-info right">
          <button class="save-btn" disabled={!hasUnsavedRightChanges} on:click={saveRightFile} title="Save right file">💾</button>
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
        <div class="left-pane" bind:this={leftPane} on:scroll={syncLeftScroll}>
          <div class="pane-content" style="min-height: calc({(highlightedDiffResult?.lines || []).length} * var(--line-height) + 30px);">
            {#each (highlightedDiffResult?.lines || []) as line, index}
              {@const chunk = getChunkForLine(index)}
              {@const isFirstInChunk = chunk ? isFirstLineOfChunk(index, chunk) : false}
              {@const isLastInChunk = chunk ? index === chunk.endIndex : false}
              <div class="line {getLineClass(line.type)} {chunk && isFirstInChunk ? 'chunk-start' : ''} {chunk && isLastInChunk ? 'chunk-end' : ''}">
                <span class="line-number">{line.leftNumber || ''}</span>
                <span class="line-text">{@html line.leftLineHighlighted || escapeHtml(line.leftLine || ' ')}</span>
              </div>
            {/each}
          </div>
        </div>
        
        <div class="center-gutter" bind:this={centerGutter} on:scroll={syncCenterScroll}>
          <div class="gutter-content" style="min-height: calc({(highlightedDiffResult?.lines || []).length} * var(--line-height) + 30px); padding-bottom: {hasHorizontalScrollbar ? '42px' : '30px'};">
            {#each (highlightedDiffResult?.lines || []) as line, index}
              {@const chunk = getChunkForLine(index)}
              {@const isFirstInChunk = chunk ? isFirstLineOfChunk(index, chunk) : false}
              {@const isLastInChunk = chunk ? index === chunk.endIndex : false}
              
              <div class="gutter-line {chunk && isFirstInChunk ? 'chunk-start' : ''} {chunk && isLastInChunk ? 'chunk-end' : ''}">
              {#if chunk && isFirstInChunk}
                <!-- Show chunk arrows only on the first line of the chunk, but position them in the middle -->
                <div class="chunk-actions" style="--chunk-height: {chunk.lines};">
                  {#if chunk.type === 'added'}
                    <!-- Content exists in RIGHT pane, so put copy arrow on RIGHT side and delete arrow on LEFT side -->
                    <button class="gutter-arrow left-side-arrow chunk-arrow" on:click={() => deleteChunkFromRight(chunk)} title="Delete chunk from right ({chunk.lines} lines)">
                      →
                    </button>
                    <button class="gutter-arrow right-side-arrow chunk-arrow" on:click={() => copyChunkToLeft(chunk)} title="Copy chunk to left ({chunk.lines} lines)">
                      ←
                    </button>
                  {:else if chunk.type === 'removed'}
                    <!-- Content exists in LEFT pane, so put copy arrow on LEFT side and delete arrow on RIGHT side -->
                    <button class="gutter-arrow left-side-arrow chunk-arrow" on:click={() => copyChunkToRight(chunk)} title="Copy chunk to right ({chunk.lines} lines)">
                      →
                    </button>
                    <button class="gutter-arrow right-side-arrow chunk-arrow" on:click={() => deleteChunkFromLeft(chunk)} title="Delete chunk from left ({chunk.lines} lines)">
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
        
        <div class="right-pane" bind:this={rightPane} on:scroll={syncRightScroll}>
          <div class="pane-content" style="min-height: calc({(highlightedDiffResult?.lines || []).length} * var(--line-height) + 30px);">
            {#each (highlightedDiffResult?.lines || []) as line, index}
              {@const chunk = getChunkForLine(index)}
              {@const isFirstInChunk = chunk ? isFirstLineOfChunk(index, chunk) : false}
              {@const isLastInChunk = chunk ? index === chunk.endIndex : false}
              <div class="line {getLineClass(line.type)} {chunk && isFirstInChunk ? 'chunk-start' : ''} {chunk && isLastInChunk ? 'chunk-end' : ''}">
                <span class="line-number">{line.rightNumber || ''}</span>
                <span class="line-text">{@html line.rightLineHighlighted || escapeHtml(line.rightLine || ' ')}</span>
              </div>
            {/each}
          </div>
        </div>
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
  {#if showQuitDialog}
    <div class="modal-overlay" on:click={() => showQuitDialog = false}>
      <div class="quit-dialog" on:click|stopPropagation>
        <h3>Unsaved Changes</h3>
        <p>Select which files to save before quitting:</p>
        
        <div class="file-list">
          {#if leftFilePath}
            <label class="file-item">
              <input 
                type="checkbox" 
                bind:checked={fileSelections[leftFilePath]}
                disabled={!quitDialogFiles.includes(leftFilePath)}
              />
              <span class="file-name">{getDisplayFileName(leftFilePath)}</span>
              {#if !quitDialogFiles.includes(leftFilePath)}
                <span class="file-status">(no changes)</span>
              {/if}
            </label>
          {/if}
          
          {#if rightFilePath}
            <label class="file-item">
              <input 
                type="checkbox" 
                bind:checked={fileSelections[rightFilePath]}
                disabled={!quitDialogFiles.includes(rightFilePath)}
              />
              <span class="file-name">{getDisplayFileName(rightFilePath)}</span>
              {#if !quitDialogFiles.includes(rightFilePath)}
                <span class="file-status">(no changes)</span>
              {/if}
            </label>
          {/if}
        </div>
        
        <div class="dialog-buttons">
          <button class="btn-primary" on:click={handleSaveAndQuit}>
            Save Selected & Quit
          </button>
          <button class="btn-secondary" on:click={handleQuitWithoutSaving}>
            Quit Without Saving
          </button>
          <button class="btn-tertiary" on:click={() => showQuitDialog = false}>
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
    --line-height: 1.5em;
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

  :global([data-theme="dark"]) .theme-toggle {
    color: #a5adcb;
    border-color: rgba(165, 173, 203, 0.3);
  }

  :global([data-theme="dark"]) .theme-toggle:hover {
    background: rgba(202, 211, 245, 0.1);
    border-color: rgba(202, 211, 245, 0.5);
    color: #cad3f5;
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

  :global([data-theme="dark"]) .line-number {
    background: #1e2030;
    border-right-color: #363a4f;
    color: #8087a2;
  }

  :global([data-theme="dark"]) .pane-content::after {
    background: #1e2030;
    border-right-color: #363a4f;
  }

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

  .theme-toggle {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: 1px solid rgba(108, 111, 133, 0.3);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 4px;
    color: #6c6f85;
    transition: all 0.2s ease;
  }

  .theme-toggle:hover {
    background: rgba(76, 79, 105, 0.1);
    border-color: rgba(76, 79, 105, 0.5);
    color: #4c4f69;
  }

  /* Make moon emoji darker in light mode for better contrast */
  .theme-toggle {
    filter: grayscale(0.3) brightness(0.7);
  }

  :global([data-theme="dark"]) .theme-toggle {
    filter: none;
  }

  /* Custom scrollbar styling for light mode (Catppuccin Latte) */
  ::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }

  ::-webkit-scrollbar-track {
    background: #dce0e8;
  }

  ::-webkit-scrollbar-thumb {
    background: #acb0be;
    border-radius: 6px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #9ca0b0;
  }

  ::-webkit-scrollbar-corner {
    background: #dce0e8;
  }

  /* Custom scrollbar styling for dark mode (Catppuccin Macchiato) */
  :global([data-theme="dark"]) ::-webkit-scrollbar-track {
    background: #363a4f;
  }

  :global([data-theme="dark"]) ::-webkit-scrollbar-thumb {
    background: #5b6078;
    border-radius: 6px;
  }

  :global([data-theme="dark"]) ::-webkit-scrollbar-thumb:hover {
    background: #6e738d;
  }

  :global([data-theme="dark"]) ::-webkit-scrollbar-corner {
    background: #363a4f;
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

  .center-gutter {
    width: var(--gutter-width);
    background: #e6e9ef;
    border-left: 1px solid #dce0e8;
    border-right: 1px solid #dce0e8;
    overflow: auto;
    flex-shrink: 0;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
    font-size: var(--font-size);
    line-height: var(--line-height);
    /* Hide vertical scrollbar but keep functionality */
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

  /* Hide vertical scrollbar in gutter but keep track space for alignment */
  .center-gutter::-webkit-scrollbar:vertical {
    width: 0; /* Chrome, Safari, Opera */
  }
  
  .center-gutter::-webkit-scrollbar:horizontal {
    height: 12px; /* Match the main scrollbar height */
  }
  
  /* Ensure panes also have consistent scrollbar sizing */
  .left-pane::-webkit-scrollbar,
  .right-pane::-webkit-scrollbar {
    width: 12px;
    height: 12px;
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
    border-bottom: 1px solid rgba(255, 0, 255, 0.3); /* Magenta border for visibility */
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
    padding-bottom: 30px; /* Add some padding for visual comfort */
    line-height: var(--line-height);
    min-height: 100%; /* Ensure minimum height matches container */
  }

  .pane-content::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: calc(var(--line-number-width, 32px) + 1px);
    height: 100%;
    background: #e6e9ef;
    border-right: 1px solid #dce0e8;
    z-index: 0;
    pointer-events: none;
  }

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
    border-bottom: 1px solid rgba(255, 0, 255, 0.3); /* Magenta border for visibility */
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
    padding: 0 5px 0 5px;
    text-align: right;
    color: #6c6f85;
    background: #e6e9ef;
    border-right: 1px solid #dce0e8;
    user-select: none;
    flex-shrink: 0;
    position: sticky;
    left: 0;
    z-index: 1;
    font-size: 0.75rem;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: 100%;
  }

  .line-text {
    padding: 0 0.5rem;
    color: #4c4f69;
    white-space: pre;
    text-align: left;
    font-family: inherit;
    tab-size: 4;
    background: inherit;
    min-width: max-content;
    position: relative;
  }


  .line-same {
    background: #eff1f5;
  }

  .line-same .line-text {
    color: #4c4f69;
  }

  .line-added {
    background: #dcfce7;
    border-left: 3px solid #22c55e;
  }

  .line-added .line-number {
    background: #bbf7d0;
    color: #166534;
  }

  .line-added .line-text {
    color: #166534;
  }

  .line-removed {
    background: #fef2f2;
    border-left: 3px solid #ef4444;
  }

  .line-removed .line-number {
    background: #fecaca;
    color: #991b1b;
  }

  .line-removed .line-text {
    color: #991b1b;
  }

  .line-modified {
    background: #fef3c7;
    border-left: 3px solid #f59e0b;
  }

  .line-modified .line-number {
    background: #fde68a;
    color: #92400e;
  }

  .line-modified .line-text {
    color: #92400e;
  }

  /* Dark mode line overrides */
  :global([data-theme="dark"]) .line-same {
    background: #24273a;
  }

  :global([data-theme="dark"]) .line-same .line-text {
    color: #cad3f5;
  }

  :global([data-theme="dark"]) .line-added {
    background: #1e3a2e;
    border-left-color: #a6da95;
  }

  :global([data-theme="dark"]) .line-added .line-number {
    background: #2d5016;
    color: #a6da95;
  }

  :global([data-theme="dark"]) .line-added .line-text {
    color: #a6da95;
  }

  :global([data-theme="dark"]) .line-removed {
    background: #3e2723;
    border-left-color: #ed8796;
  }

  :global([data-theme="dark"]) .line-removed .line-number {
    background: #5d1a1d;
    color: #ed8796;
  }

  :global([data-theme="dark"]) .line-removed .line-text {
    color: #ed8796;
  }

  :global([data-theme="dark"]) .line-modified {
    background: #3e3424;
    border-left-color: #eed49f;
  }

  :global([data-theme="dark"]) .line-modified .line-number {
    background: #5d4e1a;
    color: #eed49f;
  }

  :global([data-theme="dark"]) .line-modified .line-text {
    color: #eed49f;
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
    color: #dc2626;
  }

  .left-side-arrow:hover {
    color: #b91c1c;
  }

  .right-side-arrow {
    color: #16a34a;
  }

  .right-side-arrow:hover {
    color: #15803d;
  }

  .gutter-line {
    position: relative;
  }

  /* Dark mode gutter arrows */
  :global([data-theme="dark"]) .center-gutter {
    background: #1e2030;
    border-left-color: #363a4f;
    border-right-color: #363a4f;
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
    color: #ed8796;
  }

  :global([data-theme="dark"]) .left-side-arrow:hover {
    color: #ed8796;
  }

  :global([data-theme="dark"]) .right-side-arrow {
    color: #a6da95;
  }

  :global([data-theme="dark"]) .right-side-arrow:hover {
    color: #a6da95;
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
