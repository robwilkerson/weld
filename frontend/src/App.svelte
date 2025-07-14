<script lang="ts">
import Prism from "prismjs";
import { onMount } from "svelte";
import {
	CompareFiles,
	CopyToFile,
	type DiffLine,
	type DiffResult,
	SaveChanges,
	SelectFile,
} from "../wailsjs/go/main/App.js";

// Import core languages
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-java";
import "prismjs/components/prism-go";
import "prismjs/components/prism-python";
import "prismjs/components/prism-php";
import "prismjs/components/prism-ruby";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-css";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-bash";

// Import Prism CSS theme - try different approach
import "prismjs/themes/prism-tomorrow.css";

let leftFilePath: string = "";
let rightFilePath: string = "";
let leftFileName: string = "Select left file...";
let rightFileName: string = "Select right file...";
let diffResult: DiffResult | null = null;
let isComparing: boolean = false;
let errorMessage: string = "";
let leftPane: HTMLElement;
let rightPane: HTMLElement;
let isScrollSyncing: boolean = false;
let isDarkMode: boolean = true;
let hasUnsavedLeftChanges: boolean = false;
let hasUnsavedRightChanges: boolean = false;

$: isSameFile = leftFilePath && rightFilePath && leftFilePath === rightFilePath;

// Only show "files are identical" banner if they're identical on disk (no unsaved changes)
$: areFilesIdentical =
	diffResult &&
	diffResult.lines &&
	diffResult.lines.length > 0 &&
	diffResult.lines.every((line) => line.type === "same") &&
	leftFilePath !== rightFilePath &&
	!hasUnsavedLeftChanges &&
	!hasUnsavedRightChanges;

$: lineNumberWidth = getLineNumberWidth();

async function selectLeftFile(): Promise<void> {
	try {
		console.log("Selecting left file...");
		const path = await SelectFile();
		console.log("Left file selected:", path);
		if (path) {
			leftFilePath = path;
			leftFileName = path.split("/").pop() || path;
			hasUnsavedLeftChanges = false; // Reset unsaved changes when selecting new files
			hasUnsavedRightChanges = false;
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
		console.log("Selecting right file...");
		const path = await SelectFile();
		console.log("Right file selected:", path);
		if (path) {
			rightFilePath = path;
			rightFileName = path.split("/").pop() || path;
			hasUnsavedLeftChanges = false; // Reset unsaved changes when selecting new files
			hasUnsavedRightChanges = false;
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
		console.log("Starting comparison of:", leftFilePath, "vs", rightFilePath);

		diffResult = await CompareFiles(leftFilePath, rightFilePath);
		console.log("Comparison result:", diffResult);
		if (diffResult && diffResult.lines && diffResult.lines.length > 0) {
			console.log("First line sample:", diffResult.lines[0]);
		}

		if (!diffResult || !diffResult.lines) {
			errorMessage = "No comparison result received";
			diffResult = null;
		} else if (diffResult.lines.length === 0) {
			errorMessage = "Files are identical";
		}
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
	if (isScrollSyncing || !leftPane || !rightPane) return;
	isScrollSyncing = true;
	// Sync both vertical and horizontal scrolling from left to right pane
	rightPane.scrollTop = leftPane.scrollTop;
	rightPane.scrollLeft = leftPane.scrollLeft;
	setTimeout(() => (isScrollSyncing = false), 10);
}

function syncRightScroll() {
	if (isScrollSyncing || !leftPane || !rightPane) return;
	isScrollSyncing = true;
	// Sync both vertical and horizontal scrolling from right to left pane
	leftPane.scrollTop = rightPane.scrollTop;
	leftPane.scrollLeft = rightPane.scrollLeft;
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
	try {
		const leftPath =
			"/Users/54695/Development/lookout-software/weld/tests/sample-files/same-1.js";
		const rightPath =
			"/Users/54695/Development/lookout-software/weld/tests/sample-files/same-2.js";

		leftFilePath = leftPath;
		leftFileName = leftPath.split("/").pop() || leftPath;

		rightFilePath = rightPath;
		rightFileName = rightPath.split("/").pop() || rightPath;

		errorMessage = `Default files loaded: ${leftFileName} and ${rightFileName}`;
	} catch (error) {
		console.error("Error initializing default files:", error);
		errorMessage = `Error loading default files: ${error}`;
	}
}

function toggleDarkMode(): void {
	isDarkMode = !isDarkMode;
	document.documentElement.setAttribute(
		"data-theme",
		isDarkMode ? "dark" : "light",
	);
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

		// Mark as having unsaved changes
		hasUnsavedRightChanges = true;

		// Refresh the diff to show the changes
		await compareBothFiles();

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

		// Mark as having unsaved changes
		hasUnsavedLeftChanges = true;

		// Refresh the diff to show the changes
		await compareBothFiles();

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

async function deleteLineFromRight(lineIndex: number): Promise<void> {
	if (!diffResult || !diffResult.lines[lineIndex]) return;

	const line = diffResult.lines[lineIndex];
	if (line.type !== "added") return;

	try {
		// Remove the line from the right file content
		const rightLines = rightFileContent.split("\n");
		if (line.rightLineNumber !== null && line.rightLineNumber > 0) {
			rightLines.splice(line.rightLineNumber - 1, 1);
			rightFileContent = rightLines.join("\n");

			// Mark as having unsaved changes
			hasUnsavedRightChanges = true;
		}

		// Refresh the diff to show the changes
		await compareBothFiles();

		errorMessage = "Line deleted successfully";
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
		// Remove the line from the left file content
		const leftLines = leftFileContent.split("\n");
		if (line.leftLineNumber !== null && line.leftLineNumber > 0) {
			leftLines.splice(line.leftLineNumber - 1, 1);
			leftFileContent = leftLines.join("\n");

			// Mark as having unsaved changes
			hasUnsavedLeftChanges = true;
		}

		// Refresh the diff to show the changes
		await compareBothFiles();

		errorMessage = "Line deleted successfully";
	} catch (error) {
		console.error("Error deleting line from left:", error);
		errorMessage = `Error deleting line: ${error}`;
	}
}

async function saveLeftFile(): Promise<void> {
	try {
		await SaveChanges(leftFilePath);
		hasUnsavedLeftChanges = false;
		errorMessage = "Left file saved successfully";
	} catch (error) {
		console.error("Error saving left file:", error);
		errorMessage = `Error saving left file: ${error}`;
	}
}

async function saveRightFile(): Promise<void> {
	try {
		await SaveChanges(rightFilePath);
		hasUnsavedRightChanges = false;
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

function getLanguageFromFilename(filename: string): string {
	if (!filename) return "markup";

	const ext = filename.split(".").pop()?.toLowerCase();
	console.log("Language detection:", filename, "extension:", ext);

	const languageMap: Record<string, string> = {
		js: "javascript",
		jsx: "javascript",
		ts: "typescript",
		tsx: "typescript",
		java: "java",
		go: "go",
		py: "python",
		php: "php",
		rb: "ruby",
		cs: "csharp",
		css: "css",
		scss: "css",
		sass: "css",
		json: "json",
		md: "markdown",
		sh: "bash",
		bash: "bash",
		zsh: "bash",
		c: "c",
		cpp: "cpp",
		h: "c",
		hpp: "cpp",
	};

	const language = languageMap[ext] || "markup";
	console.log("Detected language:", language);
	return language;
}

function highlightCode(code: string, language: string): string {
	if (!code.trim()) return code;

	console.log(
		"Highlighting code:",
		code.substring(0, 50),
		"with language:",
		language,
	);
	console.log("Available languages:", Object.keys(Prism.languages));

	try {
		const grammar = Prism.languages[language];
		console.log("Grammar found for", language, ":", !!grammar);

		if (grammar) {
			const highlighted = Prism.highlight(code, grammar, language);
			console.log("Original:", code.substring(0, 30));
			console.log("Highlighted:", highlighted.substring(0, 50));
			return highlighted;
		} else {
			console.warn("No grammar found for language:", language);
		}
	} catch (error) {
		console.warn("Syntax highlighting error:", error);
	}

	return code;
}

function getHighlightedLine(line: string, filename: string): string {
	if (!line.trim()) return line;

	let highlighted = line;

	// Store original positions to avoid double-highlighting
	const protectedRanges: Array<{ start: number; end: number }> = [];

	function addProtection(match: RegExpMatchArray) {
		if (match.index !== undefined) {
			protectedRanges.push({
				start: match.index,
				end: match.index + match[0].length,
			});
		}
	}

	function isProtected(start: number, end: number): boolean {
		return protectedRanges.some(
			(range) =>
				(start >= range.start && start < range.end) ||
				(end > range.start && end <= range.end) ||
				(start <= range.start && end >= range.end),
		);
	}

	// 1. Comments first
	highlighted = highlighted.replace(/(\/\/.*$)/g, (match, ...args) => {
		const fullMatch = args[args.length - 1] as RegExpMatchArray;
		addProtection(fullMatch);
		return `<span class="syntax-comment">${match}</span>`;
	});

	// 2. Strings
	highlighted = highlighted.replace(
		/(["'`])([^"'`]*?)\1/g,
		(match, ...args) => {
			const fullMatch = args[args.length - 1] as RegExpMatchArray;
			addProtection(fullMatch);
			return `<span class="syntax-string">${match}</span>`;
		},
	);

	// 3. Keywords (simpler approach)
	const keywords = [
		"function",
		"const",
		"let",
		"var",
		"return",
		"if",
		"else",
		"for",
		"while",
		"class",
		"export",
		"import",
		"new",
		"this",
		"true",
		"false",
		"null",
		"undefined",
	];
	keywords.forEach((keyword) => {
		const regex = new RegExp(`\\b${keyword}\\b`, "g");
		let match;
		while ((match = regex.exec(line)) !== null) {
			if (!isProtected(match.index, match.index + match[0].length)) {
				highlighted = highlighted.replace(
					match[0],
					`<span class="syntax-keyword">${match[0]}</span>`,
				);
			}
		}
	});

	// 4. Numbers
	highlighted = highlighted.replace(
		/\b(\d+\.?\d*)\b/g,
		'<span class="syntax-number">$1</span>',
	);

	// 5. Function calls
	highlighted = highlighted.replace(
		/\b([a-zA-Z_$]\w*)\s*(?=\()/g,
		'<span class="syntax-function">$1</span>',
	);

	return highlighted;
}

onMount(() => {
	initializeDefaultFiles();
	document.documentElement.setAttribute("data-theme", "dark");

	// Add keyboard event listener
	document.addEventListener("keydown", handleKeydown);

	// Test Prism.js
	console.log("Testing Prism.js...");
	console.log("Prism object:", Prism);
	console.log("Available languages:", Object.keys(Prism.languages));

	// Test basic JavaScript highlighting
	const testCode = 'function test() { return "hello"; }';
	const testResult = Prism.highlight(
		testCode,
		Prism.languages.javascript,
		"javascript",
	);
	console.log("Test highlighting result:", testResult);

	// Cleanup on destroy
	return () => {
		document.removeEventListener("keydown", handleKeydown);
	};
});
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
      <div class="file-header" style="--line-number-width: {lineNumberWidth}">
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
          <div class="pane-content">
            {#each diffResult.lines as line, index}
              <div class="line {getLineClass(line.type)}">
                <span class="line-number">{line.leftNumber || ''}</span>
                <span class="line-text">{@html getHighlightedLine(line.leftLine || ' ', leftFilePath)}</span>
              </div>
            {/each}
          </div>
        </div>
        
        <div class="center-gutter">
          {#each diffResult.lines as line, index}
            <div class="gutter-line">
              {#if line.type === 'added'}
                <!-- Content exists in RIGHT pane, so put copy arrow on RIGHT side and delete arrow on LEFT side -->
                <button class="gutter-arrow left-side-arrow" on:click={() => deleteLineFromRight(index)} title="Delete from right to align">
                  →
                </button>
                <button class="gutter-arrow right-side-arrow" on:click={() => copyLineToLeft(index)} title="Copy to left">
                  ←
                </button>
              {:else if line.type === 'removed'}
                <!-- Content exists in LEFT pane, so put copy arrow on LEFT side and delete arrow on RIGHT side -->
                <button class="gutter-arrow left-side-arrow" on:click={() => copyLineToRight(index)} title="Copy to right">
                  →
                </button>
                <button class="gutter-arrow right-side-arrow" on:click={() => deleteLineFromLeft(index)} title="Delete from left to align">
                  ←
                </button>
              {/if}
            </div>
          {/each}
        </div>
        
        <div class="right-pane" bind:this={rightPane} on:scroll={syncRightScroll}>
          <div class="pane-content">
            {#each diffResult.lines as line, index}
              <div class="line {getLineClass(line.type)}">
                <span class="line-number">{line.rightNumber || ''}</span>
                <span class="line-text">{@html getHighlightedLine(line.rightLine || ' ', rightFilePath)}</span>
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
</main>

<style>
  :global(html) {
    transition: background-color 0.3s ease, color 0.3s ease;
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
    color: #cad3f5 !important;
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
    font-size: 0.8rem;
    line-height: 1.3;
    overflow: auto;
    background: #eff1f5;
    position: relative;
  }

  .center-gutter {
    width: 72px;
    background: #e6e9ef;
    border-left: 1px solid #dce0e8;
    border-right: 1px solid #dce0e8;
    overflow: hidden;
    flex-shrink: 0;
  }

  .gutter-line {
    min-height: 1.4em;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .pane-content {
    display: inline-block;
    min-width: 100%;
    width: fit-content;
    position: relative;
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
    min-height: 1.3em;
    white-space: pre;
    align-items: flex-start;
    width: 100%;
    position: relative;
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
  }

  .line-text {
    padding: 0 0.5rem;
    color: #4c4f69 !important;
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
    color: #4c4f69 !important;
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
    color: #166534 !important;
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
    color: #991b1b !important;
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
    color: #92400e !important;
  }

  /* Dark mode line overrides */
  :global([data-theme="dark"]) .line-same {
    background: #24273a;
  }

  :global([data-theme="dark"]) .line-same .line-text {
    color: #cad3f5 !important;
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
    color: #a6da95 !important;
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
    color: #ed8796 !important;
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
    color: #eed49f !important;
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
    width: 24px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .gutter-arrow:hover {
    transform: scale(1.1);
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
    position: absolute;
    left: 4px;
    color: #dc2626;
  }

  .left-side-arrow:hover {
    color: #b91c1c;
  }

  .right-side-arrow {
    position: absolute;
    right: 4px;
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
    /* No background/border changes in dark mode either */
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

  /* Custom syntax highlighting for our theme */
  .line-text :global(.syntax-keyword) {
    color: #8839ef;
    font-weight: 600;
  }

  .line-text :global(.syntax-string) {
    color: #40a02b;
  }

  .line-text :global(.syntax-comment) {
    color: #6c6f85;
    font-style: italic;
  }

  .line-text :global(.syntax-number) {
    color: #d20f39;
  }

  .line-text :global(.syntax-function) {
    color: #1e66f5;
    font-weight: 500;
  }

  /* Dark mode syntax highlighting */
  :global([data-theme="dark"]) .line-text :global(.syntax-keyword) {
    color: #c6a0f6;
    font-weight: 600;
  }

  :global([data-theme="dark"]) .line-text :global(.syntax-string) {
    color: #a6da95;
  }

  :global([data-theme="dark"]) .line-text :global(.syntax-comment) {
    color: #6e738d;
    font-style: italic;
  }

  :global([data-theme="dark"]) .line-text :global(.syntax-number) {
    color: #ed8796;
  }

  :global([data-theme="dark"]) .line-text :global(.syntax-function) {
    color: #8aadf4;
    font-weight: 500;
  }

  /* Syntax highlighting overrides */
  .line-text :global(.token.comment),
  .line-text :global(.token.prolog),
  .line-text :global(.token.doctype),
  .line-text :global(.token.cdata) {
    color: #6a737d !important;
  }

  .line-text :global(.token.punctuation) {
    color: #586069 !important;
  }

  .line-text :global(.token.property),
  .line-text :global(.token.tag),
  .line-text :global(.token.boolean),
  .line-text :global(.token.number),
  .line-text :global(.token.constant),
  .line-text :global(.token.symbol),
  .line-text :global(.token.deleted) {
    color: #d73a49 !important;
  }

  .line-text :global(.token.selector),
  .line-text :global(.token.attr-name),
  .line-text :global(.token.string),
  .line-text :global(.token.char),
  .line-text :global(.token.builtin),
  .line-text :global(.token.inserted) {
    color: #032f62 !important;
  }

  .line-text :global(.token.operator),
  .line-text :global(.token.entity),
  .line-text :global(.token.url),
  .line-text :global(.language-css .token.string),
  .line-text :global(.style .token.string) {
    color: #24292e !important;
  }

  .line-text :global(.token.atrule),
  .line-text :global(.token.attr-value),
  .line-text :global(.token.keyword) {
    color: #d73a49 !important;
  }

  .line-text :global(.token.function),
  .line-text :global(.token.class-name) {
    color: #6f42c1 !important;
  }

  /* Dark mode syntax highlighting */
  :global([data-theme="dark"]) .line-text :global(.token.comment),
  :global([data-theme="dark"]) .line-text :global(.token.prolog),
  :global([data-theme="dark"]) .line-text :global(.token.doctype),
  :global([data-theme="dark"]) .line-text :global(.token.cdata) {
    color: #6e738d !important;
  }

  :global([data-theme="dark"]) .line-text :global(.token.punctuation) {
    color: #a5adcb !important;
  }

  :global([data-theme="dark"]) .line-text :global(.token.property),
  :global([data-theme="dark"]) .line-text :global(.token.tag),
  :global([data-theme="dark"]) .line-text :global(.token.boolean),
  :global([data-theme="dark"]) .line-text :global(.token.number),
  :global([data-theme="dark"]) .line-text :global(.token.constant),
  :global([data-theme="dark"]) .line-text :global(.token.symbol),
  :global([data-theme="dark"]) .line-text :global(.token.deleted) {
    color: #ed8796 !important;
  }

  :global([data-theme="dark"]) .line-text :global(.token.selector),
  :global([data-theme="dark"]) .line-text :global(.token.attr-name),
  :global([data-theme="dark"]) .line-text :global(.token.string),
  :global([data-theme="dark"]) .line-text :global(.token.char),
  :global([data-theme="dark"]) .line-text :global(.token.builtin),
  :global([data-theme="dark"]) .line-text :global(.token.inserted) {
    color: #a6da95 !important;
  }

  :global([data-theme="dark"]) .line-text :global(.token.operator),
  :global([data-theme="dark"]) .line-text :global(.token.entity),
  :global([data-theme="dark"]) .line-text :global(.token.url),
  :global([data-theme="dark"]) .line-text :global(.language-css .token.string),
  :global([data-theme="dark"]) .line-text :global(.style .token.string) {
    color: #cad3f5 !important;
  }

  :global([data-theme="dark"]) .line-text :global(.token.atrule),
  :global([data-theme="dark"]) .line-text :global(.token.attr-value),
  :global([data-theme="dark"]) .line-text :global(.token.keyword) {
    color: #c6a0f6 !important;
  }

  :global([data-theme="dark"]) .line-text :global(.token.function),
  :global([data-theme="dark"]) .line-text :global(.token.class-name) {
    color: #8aadf4 !important;
  }
</style>
