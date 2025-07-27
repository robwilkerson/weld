import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App.svelte";

// Mock the Wails runtime
vi.mock("../../../wailsjs/runtime/runtime.js", () => ({
	EventsOn: vi.fn(),
	EventsOff: vi.fn(),
}));

// Mock the Wails App functions
vi.mock("../../../wailsjs/go/main/App.js", () => ({
	CompareFiles: vi.fn(),
	GetInitialFiles: vi.fn(),
	GetMinimapVisible: vi.fn(),
	SetMinimapVisible: vi.fn(),
	HasUnsavedChanges: vi.fn(),
	SaveChanges: vi.fn(),
	CopyToFile: vi.fn(),
	DiscardAllChanges: vi.fn(),
	QuitWithoutSaving: vi.fn(),
	SaveSelectedFilesAndQuit: vi.fn(),
	SelectFile: vi.fn(),
}));

import {
	CompareFiles,
	CopyToFile,
	GetInitialFiles,
	GetMinimapVisible,
	SelectFile,
} from "../../../wailsjs/go/main/App.js";

describe("Edge Cases and Special File Handling", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Default mocks
		vi.mocked(GetInitialFiles).mockResolvedValue(["", ""]);
		vi.mocked(GetMinimapVisible).mockResolvedValue(true);
	});

	// Test: Large file handling
	it("should handle large files (1000+ lines) gracefully", async () => {
		const { container } = render(App);

		// Mock SelectFile for file selections
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/large1.txt")
			.mockResolvedValueOnce("/path/to/large2.txt");

		// Create a large diff result with 1000+ lines
		const largeLines = [];
		for (let i = 1; i <= 1000; i++) {
			largeLines.push({
				type: "same" as const,
				leftLineNumber: i,
				rightLineNumber: i,
				leftContent: `Line ${i} content`,
				rightContent: `Line ${i} content`,
			});
		}
		// Add some differences
		for (let i = 1001; i <= 1010; i++) {
			largeLines.push({
				type: "modified" as const,
				leftLineNumber: i,
				rightLineNumber: i,
				leftContent: `Old line ${i}`,
				rightContent: `New line ${i}`,
			});
		}

		// Mock CompareFiles to return large diff
		vi.mocked(CompareFiles).mockResolvedValueOnce({
			lineNumberWidth: 4, // 4 digits for line numbers
			lines: largeLines,
		});

		// Select files
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);

		// Compare files
		const compareButton = container.querySelector(
			".compare-btn",
		) as HTMLButtonElement;
		await fireEvent.click(compareButton);

		// Wait for diff to render
		await waitFor(() => {
			const diffViewer = container.querySelector(".diff-viewer");
			expect(diffViewer).toBeTruthy();
		});

		// Verify UI handles large content
		const diffContent = container.querySelector(".diff-content");
		expect(diffContent).toBeTruthy();

		// Try navigation in large file
		await fireEvent.keyDown(document, { key: "j" });
		await fireEvent.keyDown(document, { key: "k" });

		// Verify UI is still responsive
		expect(container.querySelector(".diff-viewer")).toBeTruthy();
		expect(container.querySelector("main")).toBeTruthy();
	});

	// Test: Empty file comparison
	it("should handle empty files gracefully", async () => {
		const { container, getByText } = render(App);

		// Test Case 1: Both files empty - should show identical files banner
		// Mock SelectFile for file selections
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/empty1.txt")
			.mockResolvedValueOnce("/path/to/empty2.txt");

		// Mock CompareFiles to return empty result
		vi.mocked(CompareFiles).mockResolvedValueOnce({
			lineNumberWidth: 1,
			lines: [], // Empty files are identical
		});

		// Select files
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);

		// Verify file paths are displayed
		expect(getByText("empty1.txt")).toBeTruthy();
		expect(getByText("empty2.txt")).toBeTruthy();

		// Compare files
		const compareButton = container.querySelector(
			".compare-btn",
		) as HTMLButtonElement;
		await fireEvent.click(compareButton);

		// Wait for comparison to complete
		await waitFor(() => {
			const errorDiv = container.querySelector(".error");
			expect(errorDiv).toBeTruthy();
		});

		// Verify "Files are identical" message is shown
		const identicalText = getByText("Files are identical");
		expect(identicalText).toBeTruthy();

		// Verify diff content is shown but empty (0 lines)
		const diffContent = container.querySelector(".diff-content");
		expect(diffContent).toBeTruthy();

		// Verify the diff panes have 0 height (no content)
		const leftPane = container.querySelector(".left-pane .pane-content");
		const rightPane = container.querySelector(".right-pane .pane-content");
		expect(leftPane?.getAttribute("style")).toContain(
			"height: calc(0 * var(--line-height))",
		);
		expect(rightPane?.getAttribute("style")).toContain(
			"height: calc(0 * var(--line-height))",
		);

		// Verify save buttons are disabled (no changes to save)
		const saveButtons = container.querySelectorAll(".save-btn");
		saveButtons.forEach((button) => {
			expect(button.hasAttribute("disabled")).toBe(true);
		});

		// Test Case 2: One empty, one with content
		// Reset mocks
		vi.mocked(SelectFile).mockClear();
		vi.mocked(CompareFiles).mockClear();

		// Select new files
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/empty.txt")
			.mockResolvedValueOnce("/path/to/content.txt");

		// Mock diff result showing all lines as added
		vi.mocked(CompareFiles).mockResolvedValueOnce({
			lineNumberWidth: 1,
			lines: [
				{ type: "added", leftNumber: null, rightNumber: 1, content: "line 1" },
				{ type: "added", leftNumber: null, rightNumber: 2, content: "line 2" },
				{ type: "added", leftNumber: null, rightNumber: 3, content: "line 3" },
			],
		});

		// Select and compare new files
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton);

		// Wait for diff content
		await waitFor(() => {
			const diffContentNew = container.querySelector(".diff-content");
			expect(diffContentNew).toBeTruthy();
		});

		// Verify diff is shown (not identical files banner)
		const diffContent2 = container.querySelector(".diff-content");
		expect(diffContent2).toBeTruthy();

		// Verify we're now showing diff content (not the identical message)
		const errorDiv2 = container.querySelector(".error");
		if (errorDiv2) {
			expect(errorDiv2.textContent).not.toContain("Files are identical");
		}

		// Verify navigation works even with empty left file
		await fireEvent.keyDown(document, { key: "j" });
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Verify UI remains stable
		expect(container.querySelector(".diff-viewer")).toBeTruthy();
		expect(container.querySelector("main")).toBeTruthy();
	});

	// Test: Binary file handling
	it("should handle binary files and display content", async () => {
		const { container, getByText } = render(App);

		// Mock SelectFile for binary file selection
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/image.png")
			.mockResolvedValueOnce("/path/to/document.pdf");

		// Mock CompareFiles to return binary content (as the app currently does)
		// Binary files show as garbled text when compared
		vi.mocked(CompareFiles).mockResolvedValueOnce({
			lineNumberWidth: 1,
			lines: [
				{
					type: "same",
					leftNumber: 1,
					rightNumber: 1,
					content: "\x89PNG\r\n\x1a\n",
				},
				{
					type: "modified",
					leftNumber: 2,
					rightNumber: 2,
					content: "\x00\x00\x00\rIHDR\x00\x00",
				},
				{
					type: "same",
					leftNumber: 3,
					rightNumber: 3,
					content: "[binary data]",
				},
			],
		});

		// Select files
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);

		// Verify binary file names are displayed
		await waitFor(() => {
			expect(leftButton.textContent).toContain("image.png");
			expect(rightButton.textContent).toContain("document.pdf");
		});

		// Verify file icons show for binary files (defaults to Unknown File Type)
		const leftIcon = leftButton.querySelector(".file-icon");
		const rightIcon = rightButton.querySelector(".file-icon");
		expect(leftIcon?.getAttribute("title")).toBe("Unknown File Type");
		expect(rightIcon?.getAttribute("title")).toBe("Unknown File Type");

		// Compare button should be enabled
		const compareButton = container.querySelector(
			".compare-btn",
		) as HTMLButtonElement;
		expect(compareButton.disabled).toBe(false);

		// Try to compare files
		await fireEvent.click(compareButton);

		// Wait for diff content to appear (app currently shows binary as text)
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
		});

		// Verify compare button text
		expect(compareButton.textContent).toBe("Compare");

		// Diff viewer should show content (even though it's binary)
		const diffViewer = container.querySelector(".diff-viewer");
		expect(diffViewer).toBeTruthy();

		// No error should be shown (app attempts to display binary as text)
		const errorDiv = container.querySelector(".error");
		if (errorDiv?.textContent) {
			// Should not have an error about binary files
			expect(errorDiv.textContent).not.toContain("Cannot compare binary files");
		}

		// Test: User can still select and compare text files after binary comparison
		vi.mocked(SelectFile).mockClear();
		vi.mocked(CompareFiles).mockClear();

		// Select text files this time
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/text1.txt")
			.mockResolvedValueOnce("/path/to/text2.txt");

		// Mock successful comparison
		vi.mocked(CompareFiles).mockResolvedValueOnce({
			lineNumberWidth: 1,
			lines: [
				{ type: "same", leftNumber: 1, rightNumber: 1, content: "Hello" },
			],
		});

		// Select new files
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);

		// Verify text file names and icons
		await waitFor(() => {
			expect(leftButton.textContent).toContain("text1.txt");
			expect(rightButton.textContent).toContain("text2.txt");
		});

		// Compare should work now
		await fireEvent.click(compareButton);

		// Wait for successful comparison
		await waitFor(() => {
			const diffContentAfter = container.querySelector(".diff-content");
			expect(diffContentAfter).toBeTruthy();
		});

		// Should show normal diff content for text files
		const diffViewerAfter = container.querySelector(".diff-viewer");
		expect(diffViewerAfter).toBeTruthy();
		// Verify diff content exists (not empty state)
		const diffContentAfterText = container.querySelector(".diff-content");
		expect(diffContentAfterText).toBeTruthy();
	});

	// Test: Unicode content handling
	it("should handle unicode content correctly", async () => {
		const { container } = render(App);

		// Mock SelectFile for file selections
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/unicode1.txt")
			.mockResolvedValueOnce("/path/to/unicode2.txt");

		// Mock CompareFiles with unicode content
		vi.mocked(CompareFiles).mockResolvedValueOnce({
			lineNumberWidth: 2,
			lines: [
				{
					type: "same",
					leftLineNumber: 1,
					rightLineNumber: 1,
					leftContent: "Hello 世界",
					rightContent: "Hello 世界",
				},
				{
					type: "modified",
					leftLineNumber: 2,
					rightLineNumber: 2,
					leftContent: "Emoji test: 😀😎🎉",
					rightContent: "Emoji test: 🚀💻✨",
				},
				{
					type: "same",
					leftLineNumber: 3,
					rightLineNumber: 3,
					leftContent: "المملكة العربية السعودية",
					rightContent: "المملكة العربية السعودية",
				},
			],
		});

		// Select files
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);

		// Compare files
		const compareButton = container.querySelector(
			".compare-btn",
		) as HTMLButtonElement;
		await fireEvent.click(compareButton);

		// Wait for diff to render
		await waitFor(() => {
			const diffViewer = container.querySelector(".diff-viewer");
			expect(diffViewer).toBeTruthy();
		});

		// Verify UI handles unicode content
		expect(container.querySelector(".diff-viewer")).toBeTruthy();
		expect(container.querySelector("main")).toBeTruthy();

		// Try copying unicode content
		vi.mocked(CopyToFile).mockResolvedValueOnce(true);
		await fireEvent.keyDown(document, { key: "L", shiftKey: true });

		// Verify no crash with unicode operations
		expect(container.querySelector("main")).toBeTruthy();
	});

	// Test: Files with unusual extensions
	it("should handle files with unusual but valid extensions", async () => {
		const { container } = render(App);

		// Test various file extensions
		const testCases = [
			"/path/to/config.yaml",
			"/path/to/data.jsonl",
			"/path/to/script.sh",
			"/path/to/styles.scss",
			"/path/to/component.tsx",
			"/path/to/data.csv",
			"/path/to/README.md",
			"/path/to/Dockerfile", // No extension
			"/path/to/.gitignore", // Starts with dot
			"/path/to/file.backup.js", // Multiple dots
		];

		// Mock SelectFile for each test case
		for (let i = 0; i < testCases.length; i += 2) {
			const leftFile = testCases[i];
			const rightFile = testCases[i + 1] || testCases[0];

			vi.mocked(SelectFile)
				.mockResolvedValueOnce(leftFile)
				.mockResolvedValueOnce(rightFile);

			const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
			await fireEvent.click(leftButton);
			await fireEvent.click(rightButton);

			// Verify file names are displayed
			await waitFor(() => {
				const leftFileName = leftFile.split("/").pop();
				const rightFileName = rightFile.split("/").pop();
				expect(leftButton.textContent).toContain(leftFileName);
				expect(rightButton.textContent).toContain(rightFileName);
			});

			// Verify file icons are displayed (should not crash)
			const leftIcon = leftButton.querySelector(".file-icon");
			const rightIcon = rightButton.querySelector(".file-icon");
			expect(leftIcon).toBeTruthy();
			expect(rightIcon).toBeTruthy();
			expect(leftIcon?.getAttribute("title")).toBeTruthy();
			expect(rightIcon?.getAttribute("title")).toBeTruthy();

			// Clear mocks for next iteration
			vi.mocked(SelectFile).mockClear();
		}

		expect(container.querySelector("main")).toBeTruthy();
	});

	// Test: Files with very long names/paths
	it("should handle files with very long names and paths", async () => {
		const { container } = render(App);

		// Create very long file names
		const longPath =
			"/very/deep/directory/structure/with/many/nested/folders/that/goes/on/and/on/and/on";
		const longFileName = `${"a".repeat(100)}.txt`;
		const longFullPath = `${longPath}/${longFileName}`;

		// Mock SelectFile for long paths
		vi.mocked(SelectFile)
			.mockResolvedValueOnce(longFullPath)
			.mockResolvedValueOnce("/short/path.txt");

		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);

		// Verify file names are displayed (should be truncated gracefully)
		await waitFor(() => {
			expect(leftButton.textContent).toContain(longFileName);
			expect(rightButton.textContent).toContain("path.txt");
		});

		// Verify UI doesn't break with long names
		const compareButton = container.querySelector(".compare-btn");
		expect(compareButton?.disabled).toBe(false);
		expect(container.querySelector("main")).toBeTruthy();
	});

	// Test: Files with special characters in names
	it("should handle files with special characters in names", async () => {
		const { container } = render(App);

		const specialFiles = [
			"/path/to/file with spaces.txt",
			"/path/to/file-with-dashes.js",
			"/path/to/file_with_underscores.py",
			"/path/to/file(with)parentheses.md",
			"/path/to/file[with]brackets.json",
			"/path/to/file{with}braces.yaml",
		];

		// Test first two files
		vi.mocked(SelectFile)
			.mockResolvedValueOnce(specialFiles[0])
			.mockResolvedValueOnce(specialFiles[1]);

		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);

		// Verify file names with special characters are displayed
		await waitFor(() => {
			expect(leftButton.textContent).toContain("file with spaces.txt");
			expect(rightButton.textContent).toContain("file-with-dashes.js");
		});

		// Verify compare button works
		const compareButton = container.querySelector(
			".compare-btn",
		) as HTMLButtonElement;
		expect(compareButton.disabled).toBe(false);
		expect(container.querySelector("main")).toBeTruthy();
	});

	// Test: Files with different line endings (CRLF vs LF)
	it("should handle files with different line endings", async () => {
		const { container } = render(App);

		// Mock SelectFile for files with different line endings
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/windows-file.txt")
			.mockResolvedValueOnce("/path/to/unix-file.txt");

		// Mock CompareFiles to simulate line ending differences
		vi.mocked(CompareFiles).mockResolvedValueOnce({
			lineNumberWidth: 1,
			lines: [
				{
					type: "same",
					leftLineNumber: 1,
					rightLineNumber: 1,
					leftContent: "First line\\r\\n", // CRLF
					rightContent: "First line\\n", // LF
				},
				{
					type: "same",
					leftLineNumber: 2,
					rightLineNumber: 2,
					leftContent: "Second line\\r\\n",
					rightContent: "Second line\\n",
				},
			],
		});

		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);

		// Compare files
		const compareButton = container.querySelector(
			".compare-btn",
		) as HTMLButtonElement;
		await fireEvent.click(compareButton);

		// Wait for diff to render
		await waitFor(() => {
			const diffViewer = container.querySelector(".diff-viewer");
			expect(diffViewer).toBeTruthy();
		});

		// Verify the app handles line ending differences gracefully
		expect(container.querySelector(".diff-content")).toBeTruthy();
		expect(container.querySelector("main")).toBeTruthy();
	});
});
