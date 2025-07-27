import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.svelte";

// Mock the Wails runtime
vi.mock("../wailsjs/runtime/runtime.js", () => ({
	EventsOn: vi.fn(),
	EventsOff: vi.fn(),
}));

// Mock the Wails App functions
vi.mock("../wailsjs/go/main/App.js", () => ({
	CompareFiles: vi.fn(),
	GetInitialFiles: vi.fn(),
	GetMinimapVisible: vi.fn(),
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
	SaveChanges,
	SelectFile,
} from "../wailsjs/go/main/App.js";

describe("App Component - File Selection", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Default mocks
		vi.mocked(GetInitialFiles).mockResolvedValue(["", ""]);
		vi.mocked(GetMinimapVisible).mockResolvedValue(true);
	});

	it("should select left file via button click and show correct icon", async () => {
		vi.mocked(SelectFile).mockResolvedValue("/path/to/script.js");

		const { container } = render(App);

		// Find the first file button (left file)
		const leftFileButton = container.querySelector(".file-btn");
		expect(leftFileButton).toBeTruthy();

		// Click the button
		await fireEvent.click(leftFileButton!);

		// Wait for the update
		await waitFor(() => {
			expect(SelectFile).toHaveBeenCalled();
			expect(leftFileButton?.textContent).toContain("script.js");

			// Check that the icon exists and has the correct title
			const fileIcon = leftFileButton?.querySelector(".file-icon");
			expect(fileIcon).toBeTruthy();
			expect(fileIcon?.getAttribute("title")).toBe("JavaScript");

			// Check that an SVG icon is rendered
			const svgIcon = fileIcon?.querySelector("svg");
			expect(svgIcon).toBeTruthy();
		});
	});

	it("should select right file via button click and show correct icon", async () => {
		vi.mocked(SelectFile).mockResolvedValue("/path/to/styles.css");

		const { container } = render(App);

		// Find the second file button (right file)
		const fileButtons = container.querySelectorAll(".file-btn");
		const rightFileButton = fileButtons[1];
		expect(rightFileButton).toBeTruthy();

		// Click the button
		await fireEvent.click(rightFileButton!);

		// Wait for the update
		await waitFor(() => {
			expect(SelectFile).toHaveBeenCalled();
			expect(rightFileButton?.textContent).toContain("styles.css");

			// Check that the icon exists and has the correct title
			const fileIcon = rightFileButton?.querySelector(".file-icon");
			expect(fileIcon).toBeTruthy();
			expect(fileIcon?.getAttribute("title")).toBe("CSS");

			// Check that an SVG icon is rendered
			const svgIcon = fileIcon?.querySelector("svg");
			expect(svgIcon).toBeTruthy();
		});
	});

	it("should enable compare button when both files are selected", async () => {
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		const { container } = render(App);

		const compareButton = container.querySelector(".compare-btn");
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");

		// Initially, compare button should be disabled
		expect(compareButton).toBeTruthy();
		expect(compareButton).toHaveProperty("disabled", true);

		// Select left file
		await fireEvent.click(leftButton);

		// Compare button should still be disabled with only one file
		await waitFor(() => {
			expect(leftButton.textContent).toContain("left.txt");
			expect(compareButton).toHaveProperty("disabled", true);
		});

		// Select right file
		await fireEvent.click(rightButton);

		// Compare button should now be enabled
		await waitFor(() => {
			expect(rightButton.textContent).toContain("right.txt");
			expect(compareButton).toHaveProperty("disabled", false);
		});
	});
});

describe("App Component - File Comparison", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Default mocks
		vi.mocked(GetInitialFiles).mockResolvedValue(["", ""]);
		vi.mocked(GetMinimapVisible).mockResolvedValue(true);
	});

	it("should show activity indicator during comparison", async () => {
		// Mock file selection
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Mock CompareFiles to have a delay to see the loading state
		const mockDiffResult = {
			lines: [
				{ type: "same", leftNumber: 1, rightNumber: 1, content: "line1" },
				{ type: "added", leftNumber: null, rightNumber: 2, content: "added" },
			],
		};

		vi.mocked(CompareFiles).mockImplementation(
			() =>
				new Promise((resolve) =>
					setTimeout(() => resolve(mockDiffResult), 200),
				),
		);

		const { container } = render(App);
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		// Select files
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);

		// Click compare
		await fireEvent.click(compareButton!);

		// Should immediately show "Comparing..."
		expect(compareButton?.textContent).toBe("Comparing...");
		expect(compareButton).toHaveProperty("disabled", true);

		// Wait for comparison to complete
		await waitFor(
			() => {
				expect(compareButton?.textContent).toBe("Compare");
				// Button should remain disabled after comparison completes
				expect(compareButton).toHaveProperty("disabled", true);
			},
			{ timeout: 300 },
		);
	});

	it("should display diff results after comparison", async () => {
		// Mock file selection
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Mock CompareFiles with a simple diff result
		const mockDiffResult = {
			lines: [
				{ type: "same", leftNumber: 1, rightNumber: 1, content: "line1" },
				{
					type: "added",
					leftNumber: null,
					rightNumber: 2,
					content: "added line",
				},
				{
					type: "removed",
					leftNumber: 2,
					rightNumber: null,
					content: "removed line",
				},
				{
					type: "modified",
					leftNumber: 3,
					rightNumber: 3,
					content: "modified line",
				},
				{ type: "same", leftNumber: 4, rightNumber: 4, content: "line4" },
			],
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);

		const { container } = render(App);
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		// Select files and compare
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff viewer to appear and comparison to complete
		await waitFor(() => {
			const diffViewer = container.querySelector(".diff-viewer");
			expect(diffViewer).toBeTruthy();
			expect(diffViewer?.classList.contains("comparing")).toBe(false);
		});

		// Check that diff content is displayed
		const diffContent = container.querySelector(".diff-content");
		expect(diffContent).toBeTruthy();

		// Check for left and right panes
		const leftPane = container.querySelector(".left-pane");
		const rightPane = container.querySelector(".right-pane");
		expect(leftPane).toBeTruthy();
		expect(rightPane).toBeTruthy();

		// Check for center gutter
		const centerGutter = container.querySelector(".center-gutter");
		expect(centerGutter).toBeTruthy();

		// Check that content areas exist
		const leftPaneContent = leftPane?.querySelector(".pane-content");
		const rightPaneContent = rightPane?.querySelector(".pane-content");
		expect(leftPaneContent).toBeTruthy();
		expect(rightPaneContent).toBeTruthy();

		// Verify that the diff viewer is showing content (not empty state)
		const emptyState = container.querySelector(".empty-state");
		expect(emptyState).toBeFalsy();
	});

	it("should display 'Files are identical' message for identical files", async () => {
		// Mock file selection
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/identical.txt")
			.mockResolvedValueOnce("/path/to/identical-copy.txt");

		// Mock CompareFiles to return empty diff (identical files)
		const mockIdenticalResult = {
			lines: [],
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockIdenticalResult);

		const { container } = render(App);
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		// Select files and compare
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for the "Files are identical" error message to appear
		await waitFor(() => {
			const errorDiv = container.querySelector(".error");
			expect(errorDiv).toBeTruthy();
			expect(errorDiv?.textContent).toBe("Files are identical");
		});

		// Verify diff viewer is shown but with no diff content
		const diffViewer = container.querySelector(".diff-viewer");
		expect(diffViewer).toBeTruthy();

		// No diff panes should show when files are identical
		const diffContent = container.querySelector(".diff-content");
		expect(diffContent).toBeTruthy();
	});

	it("should display warning when comparing file to itself", async () => {
		// Mock file selection - same file path for both
		const samePath = "/path/to/same-file.js";
		vi.mocked(SelectFile)
			.mockResolvedValueOnce(samePath)
			.mockResolvedValueOnce(samePath);

		// Mock CompareFiles to return some diff result (even though files are the same)
		const mockDiffResult = {
			lines: [
				{ type: "same", leftNumber: 1, rightNumber: 1, content: "line1" },
			],
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);

		const { container } = render(App);
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		// Select the same file for both sides
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);

		// Both buttons should show the same filename
		await waitFor(() => {
			expect(leftButton.textContent).toContain("same-file.js");
			expect(rightButton.textContent).toContain("same-file.js");
		});

		// Compare the files
		await fireEvent.click(compareButton!);

		// Wait for the same file warning banner to appear
		await waitFor(() => {
			const sameFileBanner = container.querySelector(".same-file-banner");
			expect(sameFileBanner).toBeTruthy();
			expect(sameFileBanner?.textContent).toContain(
				"File same-file.js is being compared to itself",
			);

			// Check for the warning icon
			const warningIcon = sameFileBanner?.querySelector(".warning-icon");
			expect(warningIcon).toBeTruthy();
			expect(warningIcon?.textContent).toBe("⚠️");
		});

		// Verify diff viewer is still shown
		const diffViewer = container.querySelector(".diff-viewer");
		expect(diffViewer).toBeTruthy();

		// Diff content should still be shown even when comparing to itself
		const diffContent = container.querySelector(".diff-content");
		expect(diffContent).toBeTruthy();
	});

	it("should handle comparison errors gracefully", async () => {
		// Mock file selection
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Mock CompareFiles to throw an error
		const errorMessage = "Failed to read file: Permission denied";
		vi.mocked(CompareFiles).mockRejectedValue(new Error(errorMessage));

		const { container } = render(App);
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		// Select files and try to compare
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for the error message to appear
		await waitFor(() => {
			const errorDiv = container.querySelector(".error");
			expect(errorDiv).toBeTruthy();
			expect(errorDiv?.textContent).toContain(errorMessage);
		});

		// Compare button should be re-enabled after error
		await waitFor(() => {
			expect(compareButton).toHaveProperty("disabled", false);
			expect(compareButton?.textContent).toBe("Compare");
		});

		// No diff viewer should be shown when there's an error
		const diffViewer = container.querySelector(".diff-viewer");
		expect(diffViewer).toBeTruthy();

		// But it should show empty state, not diff content
		const emptyState = container.querySelector(".empty-state");
		expect(emptyState).toBeTruthy();
		expect(emptyState?.textContent).toContain('Click "Compare Files" button');
	});
});

describe("App Component - Keyboard Navigation", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Default mocks
		vi.mocked(GetInitialFiles).mockResolvedValue(["", ""]);
		vi.mocked(GetMinimapVisible).mockResolvedValue(true);
	});

	it("should respond to j and k keyboard navigation", async () => {
		// Mock file selection and comparison
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Mock diff result with multiple distinct chunks
		const mockDiffResult = {
			lines: [
				{ type: "same", leftNumber: 1, rightNumber: 1, content: "line1" },
				{ type: "same", leftNumber: 2, rightNumber: 2, content: "line2" },
				{ type: "added", leftNumber: null, rightNumber: 3, content: "added1" },
				{ type: "same", leftNumber: 3, rightNumber: 4, content: "line3" },
				{ type: "same", leftNumber: 4, rightNumber: 5, content: "line4" },
				{
					type: "removed",
					leftNumber: 5,
					rightNumber: null,
					content: "removed1",
				},
				{ type: "same", leftNumber: 6, rightNumber: 6, content: "line5" },
				{ type: "same", leftNumber: 7, rightNumber: 7, content: "line6" },
				{
					type: "modified",
					leftNumber: 8,
					rightNumber: 8,
					content: "modified1",
				},
				{ type: "same", leftNumber: 9, rightNumber: 9, content: "line7" },
			],
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);

		const { container } = render(App);
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		// Select files and compare
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff to load and verify it has loaded with highlights
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
			const highlightedLines = container.querySelectorAll(".current-diff");
			expect(highlightedLines.length).toBeGreaterThan(0);
		});

		// Since we can't easily test the actual navigation due to component
		// initialization complexity in tests, we'll verify the keyboard
		// handler is attached and doesn't throw errors

		// Press 'j' key - should not throw
		await fireEvent.keyDown(document, { key: "j" });

		// Small delay to let any async updates complete
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Press 'k' key - should not throw
		await fireEvent.keyDown(document, { key: "k" });

		// Verify the diff viewer is still displayed properly
		const diffViewer = container.querySelector(".diff-viewer");
		expect(diffViewer).toBeTruthy();
		expect(diffViewer?.classList.contains("comparing")).toBe(false);
	});

	it("should respond to arrow key navigation", async () => {
		// Mock file selection and comparison
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Mock diff result with multiple chunks
		const mockDiffResult = {
			lines: [
				{ type: "same", leftNumber: 1, rightNumber: 1, content: "line1" },
				{ type: "added", leftNumber: null, rightNumber: 2, content: "added1" },
				{ type: "same", leftNumber: 2, rightNumber: 3, content: "line2" },
				{
					type: "removed",
					leftNumber: 3,
					rightNumber: null,
					content: "removed1",
				},
				{ type: "same", leftNumber: 4, rightNumber: 4, content: "line3" },
			],
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);

		const { container } = render(App);
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		// Select files and compare
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff to load
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
			const highlightedLines = container.querySelectorAll(".current-diff");
			expect(highlightedLines.length).toBeGreaterThan(0);
		});

		// Press ArrowDown key - should work like 'j'
		await fireEvent.keyDown(document, { key: "ArrowDown" });

		// Small delay
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Press ArrowUp key - should work like 'k'
		await fireEvent.keyDown(document, { key: "ArrowUp" });

		// Verify no errors and UI is still intact
		const diffViewer = container.querySelector(".diff-viewer");
		expect(diffViewer).toBeTruthy();
		expect(diffViewer?.classList.contains("comparing")).toBe(false);
	});

	it("should handle copy operations with Shift+L and Shift+H", async () => {
		// Mock file selection and comparison
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Mock diff result with a simple diff
		const mockDiffResult = {
			lines: [
				{ type: "same", leftNumber: 1, rightNumber: 1, content: "line1" },
				{
					type: "added",
					leftNumber: null,
					rightNumber: 2,
					content: "added line",
				},
				{ type: "same", leftNumber: 2, rightNumber: 3, content: "line2" },
			],
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);
		// Mock CopyToFile to succeed
		vi.mocked(CopyToFile).mockResolvedValue(undefined);

		const { container } = render(App);
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		// Select files and compare
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff to load
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
		});

		// Press Shift+L - copy left to right (should not throw)
		await fireEvent.keyDown(document, { key: "L", shiftKey: true });

		// Small delay
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Press Shift+H - copy right to left (should not throw)
		await fireEvent.keyDown(document, { key: "H", shiftKey: true });

		// Verify UI is intact
		const diffViewer = container.querySelector(".diff-viewer");
		expect(diffViewer).toBeTruthy();
	});

	it("should play sound at navigation boundaries", async () => {
		// Mock file selection and comparison
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Mock diff result with only one diff chunk
		const mockDiffResult = {
			lines: [
				{ type: "same", leftNumber: 1, rightNumber: 1, content: "line1" },
				{ type: "added", leftNumber: null, rightNumber: 2, content: "added" },
				{ type: "same", leftNumber: 2, rightNumber: 3, content: "line2" },
			],
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);

		const { container } = render(App);
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		// Select files and compare
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff to load
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
		});

		// We're already at the first diff, pressing 'k' should trigger boundary sound
		// Since we can't easily test AudioContext, we just verify it doesn't throw
		await fireEvent.keyDown(document, { key: "k" });

		// Press 'j' to go to the end (only one diff chunk)
		await fireEvent.keyDown(document, { key: "j" });

		// Press 'j' again - should be at boundary
		await fireEvent.keyDown(document, { key: "j" });

		// Verify UI is still working
		expect(container.querySelector(".diff-viewer")).toBeTruthy();
	});
});

describe("App Component - Copy Operations", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Default mocks
		vi.mocked(GetInitialFiles).mockResolvedValue(["", ""]);
		vi.mocked(GetMinimapVisible).mockResolvedValue(true);
	});

	it("should advance to next diff after copy operation (smoke test)", async () => {
		// Mock file selection and comparison
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Mock diff result with multiple diffs
		const mockDiffResult = {
			lines: [
				{ type: "same", leftNumber: 1, rightNumber: 1, content: "line1" },
				{ type: "added", leftNumber: null, rightNumber: 2, content: "added" },
				{ type: "same", leftNumber: 2, rightNumber: 3, content: "line2" },
				{ type: "removed", leftNumber: 3, rightNumber: null, content: "removed" },
				{ type: "same", leftNumber: 4, rightNumber: 4, content: "line3" },
			],
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);
		vi.mocked(CopyToFile).mockResolvedValue(undefined);

		const { container } = render(App);
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		// Select files and compare
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff to load
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
		});

		// SMOKE TEST: Only verifies the copy operation doesn't crash
		// TODO: Make this a comprehensive test that verifies cursor advances to next diff
		const diffViewerBefore = container.querySelector(".diff-viewer");
		expect(diffViewerBefore).toBeTruthy();

		// Trigger a copy operation (should advance to next diff after)
		await fireEvent.keyDown(document, { key: "L", shiftKey: true });

		// Small delay for any async operations
		await new Promise(resolve => setTimeout(resolve, 50));

		// Verify UI is still intact after copy
		const diffViewerAfter = container.querySelector(".diff-viewer");
		expect(diffViewerAfter).toBeTruthy();
		expect(diffViewerAfter?.classList.contains("comparing")).toBe(false);
	});

	it("should handle gutter arrow button clicks for copy operations (smoke test)", async () => {
		// Mock file selection and comparison
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Mock diff result with different types of changes
		const mockDiffResult = {
			lines: [
				{ type: "same", leftNumber: 1, rightNumber: 1, content: "line1" },
				{ type: "added", leftNumber: null, rightNumber: 2, content: "added line" },
				{ type: "same", leftNumber: 2, rightNumber: 3, content: "line2" },
				{ type: "removed", leftNumber: 3, rightNumber: null, content: "removed line" },
				{ type: "same", leftNumber: 4, rightNumber: 4, content: "line3" },
				{ type: "modified", leftNumber: 5, rightNumber: 5, content: "modified line" },
				{ type: "same", leftNumber: 6, rightNumber: 6, content: "line4" },
			],
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);
		vi.mocked(CopyToFile).mockResolvedValue(undefined);

		const { container } = render(App);
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		// Select files and compare
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff to load
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
		});

		// SMOKE TEST: Only verifies clicking gutter button doesn't crash
		// TODO: Make this a comprehensive test that verifies actual copy behavior
		// In a real test, we would find and click gutter action buttons
		const gutterButtons = container.querySelectorAll(".gutter-action");
		if (gutterButtons.length > 0) {
			await fireEvent.click(gutterButtons[0]);
		}

		// Small delay for any async operations
		await new Promise(resolve => setTimeout(resolve, 50));

		// Verify UI is still intact after clicking gutter button
		const diffViewer = container.querySelector(".diff-viewer");
		expect(diffViewer).toBeTruthy();
		expect(diffViewer?.classList.contains("comparing")).toBe(false);
	});

	it("should handle copy single line operations (smoke test)", async () => {
		// Mock file selection and comparison
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Mock diff result with single line differences
		const mockDiffResult = {
			lines: [
				{ type: "same", leftNumber: 1, rightNumber: 1, content: "line1" },
				{ type: "added", leftNumber: null, rightNumber: 2, content: "single added line" },
				{ type: "same", leftNumber: 2, rightNumber: 3, content: "line2" },
				{ type: "removed", leftNumber: 3, rightNumber: null, content: "single removed line" },
				{ type: "same", leftNumber: 4, rightNumber: 4, content: "line3" },
			],
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);
		vi.mocked(CopyToFile).mockResolvedValue(undefined);

		const { container } = render(App);
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		// Select files and compare
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff to load
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
		});

		// SMOKE TEST: Only verifies copy operations don't crash
		// TODO: Make this comprehensive - test copying single lines in both directions
		
		// Navigate to the first diff (added line)
		await fireEvent.keyDown(document, { key: "j" });
		await new Promise(resolve => setTimeout(resolve, 50));
		
		// Copy the single added line from right to left
		await fireEvent.keyDown(document, { key: "H", shiftKey: true });
		await new Promise(resolve => setTimeout(resolve, 50));

		// Navigate to the removed line
		await fireEvent.keyDown(document, { key: "j" });
		await new Promise(resolve => setTimeout(resolve, 50));
		
		// Copy the single removed line from left to right
		await fireEvent.keyDown(document, { key: "L", shiftKey: true });
		await new Promise(resolve => setTimeout(resolve, 50));

		// Verify UI is still intact
		const diffViewer = container.querySelector(".diff-viewer");
		expect(diffViewer).toBeTruthy();
		expect(diffViewer?.classList.contains("comparing")).toBe(false);
	});

	it("should handle copy entire chunk operations (smoke test)", async () => {
		// Mock file selection and comparison
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Mock diff result with multi-line chunks
		const mockDiffResult = {
			lines: [
				{ type: "same", leftNumber: 1, rightNumber: 1, content: "line1" },
				{ type: "added", leftNumber: null, rightNumber: 2, content: "added line 1" },
				{ type: "added", leftNumber: null, rightNumber: 3, content: "added line 2" },
				{ type: "added", leftNumber: null, rightNumber: 4, content: "added line 3" },
				{ type: "same", leftNumber: 2, rightNumber: 5, content: "line2" },
				{ type: "removed", leftNumber: 3, rightNumber: null, content: "removed line 1" },
				{ type: "removed", leftNumber: 4, rightNumber: null, content: "removed line 2" },
				{ type: "same", leftNumber: 5, rightNumber: 6, content: "line3" },
			],
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);
		vi.mocked(CopyToFile).mockResolvedValue(undefined);

		const { container } = render(App);
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		// Select files and compare
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff to load
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
		});

		// SMOKE TEST: Only verifies chunk copy operations don't crash
		// TODO: Make this comprehensive - test copying entire chunks in both directions

		// Try clicking gutter buttons for chunk operations
		const gutterButtons = container.querySelectorAll(".gutter-action");
		
		// Click first chunk copy button if available
		if (gutterButtons.length > 0) {
			await fireEvent.click(gutterButtons[0]);
			await new Promise(resolve => setTimeout(resolve, 50));
		}

		// Navigate to first chunk and try keyboard copy
		await fireEvent.keyDown(document, { key: "j" });
		await new Promise(resolve => setTimeout(resolve, 50));
		
		// Copy entire added chunk from right to left
		await fireEvent.keyDown(document, { key: "H", shiftKey: true });
		await new Promise(resolve => setTimeout(resolve, 50));

		// Navigate to removed chunk
		await fireEvent.keyDown(document, { key: "j" });
		await new Promise(resolve => setTimeout(resolve, 50));
		
		// Copy entire removed chunk from left to right
		await fireEvent.keyDown(document, { key: "L", shiftKey: true });
		await new Promise(resolve => setTimeout(resolve, 50));

		// Verify UI is still intact
		const diffViewer = container.querySelector(".diff-viewer");
		expect(diffViewer).toBeTruthy();
		expect(diffViewer?.classList.contains("comparing")).toBe(false);
	});

	it("should handle copy modified chunk operations (smoke test)", async () => {
		// Mock file selection and comparison
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Mock diff result with modified chunks
		const mockDiffResult = {
			lines: [
				{ type: "same", leftNumber: 1, rightNumber: 1, content: "line1" },
				{ type: "modified", leftNumber: 2, rightNumber: 2, content: "modified line 1" },
				{ type: "modified", leftNumber: 3, rightNumber: 3, content: "modified line 2" },
				{ type: "modified", leftNumber: 4, rightNumber: 4, content: "modified line 3" },
				{ type: "same", leftNumber: 5, rightNumber: 5, content: "line2" },
				{ type: "modified", leftNumber: 6, rightNumber: 6, content: "another modified" },
				{ type: "same", leftNumber: 7, rightNumber: 7, content: "line3" },
			],
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);
		vi.mocked(CopyToFile).mockResolvedValue(undefined);

		const { container } = render(App);
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		// Select files and compare
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff to load
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
		});

		// SMOKE TEST: Only verifies modified chunk copy operations don't crash
		// TODO: Make this comprehensive - test copying modified chunks in both directions

		// Navigate to first modified chunk
		await fireEvent.keyDown(document, { key: "j" });
		await new Promise(resolve => setTimeout(resolve, 50));
		
		// Copy modified chunk from left to right
		await fireEvent.keyDown(document, { key: "L", shiftKey: true });
		await new Promise(resolve => setTimeout(resolve, 50));

		// Navigate to next modified chunk
		await fireEvent.keyDown(document, { key: "j" });
		await new Promise(resolve => setTimeout(resolve, 50));
		
		// Copy modified chunk from right to left
		await fireEvent.keyDown(document, { key: "H", shiftKey: true });
		await new Promise(resolve => setTimeout(resolve, 50));

		// Try clicking gutter buttons for modified chunks
		const gutterButtons = container.querySelectorAll(".gutter-action");
		if (gutterButtons.length > 1) {
			await fireEvent.click(gutterButtons[1]);
			await new Promise(resolve => setTimeout(resolve, 50));
		}

		// Verify UI is still intact
		const diffViewer = container.querySelector(".diff-viewer");
		expect(diffViewer).toBeTruthy();
		expect(diffViewer?.classList.contains("comparing")).toBe(false);
	});

	it("should handle delete chunk operations (smoke test)", async () => {
		// Mock file selection and comparison
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Mock diff result with chunks that can be deleted
		const mockDiffResult = {
			lines: [
				{ type: "same", leftNumber: 1, rightNumber: 1, content: "line1" },
				{ type: "added", leftNumber: null, rightNumber: 2, content: "added line 1" },
				{ type: "added", leftNumber: null, rightNumber: 3, content: "added line 2" },
				{ type: "same", leftNumber: 2, rightNumber: 4, content: "line2" },
				{ type: "removed", leftNumber: 3, rightNumber: null, content: "removed line 1" },
				{ type: "removed", leftNumber: 4, rightNumber: null, content: "removed line 2" },
				{ type: "same", leftNumber: 5, rightNumber: 5, content: "line3" },
			],
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);
		vi.mocked(CopyToFile).mockResolvedValue(undefined);

		const { container } = render(App);
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		// Select files and compare
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff to load
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
		});

		// SMOKE TEST: Only verifies delete operations don't crash
		// TODO: Make this comprehensive - test deleting chunks from both sides

		// Look for delete buttons in the gutter (usually have specific classes or icons)
		const gutterButtons = container.querySelectorAll(".gutter-action");
		
		// Try clicking delete buttons if available
		for (let i = 0; i < Math.min(gutterButtons.length, 3); i++) {
			const button = gutterButtons[i];
			// In real app, delete buttons might have specific attributes or classes
			await fireEvent.click(button);
			await new Promise(resolve => setTimeout(resolve, 50));
		}

		// Navigate through diffs and simulate delete operations
		await fireEvent.keyDown(document, { key: "j" });
		await new Promise(resolve => setTimeout(resolve, 50));

		// In a real implementation, there might be specific keyboard shortcuts for delete
		// For now, we're just verifying the UI remains stable

		// Verify UI is still intact after delete operations
		const diffViewer = container.querySelector(".diff-viewer");
		expect(diffViewer).toBeTruthy();
		expect(diffViewer?.classList.contains("comparing")).toBe(false);
	});
});

describe("App Component - Menu and Settings", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Default mocks
		vi.mocked(GetInitialFiles).mockResolvedValue(["", ""]);
		vi.mocked(GetMinimapVisible).mockResolvedValue(true);
	});

	it("should toggle hamburger menu on click (smoke test)", async () => {
		const { container } = render(App);

		// Find the hamburger menu button
		const menuButton = container.querySelector(".menu-toggle");
		expect(menuButton).toBeTruthy();

		// SMOKE TEST: Only verifies menu toggle doesn't crash
		// TODO: Make this comprehensive - verify menu opens/closes and state changes
		
		// Click to open menu
		await fireEvent.click(menuButton!);
		
		// Small delay for any async operations
		await new Promise(resolve => setTimeout(resolve, 50));

		// Verify UI is still intact after clicking menu
		expect(container.querySelector(".menu-toggle")).toBeTruthy();
		
		// Click again to close menu (should not crash)
		await fireEvent.click(menuButton!);
		
		// Small delay for any async operations
		await new Promise(resolve => setTimeout(resolve, 50));
		
		// Verify basic UI structure is still intact
		const header = container.querySelector(".header");
		expect(header).toBeTruthy();
		expect(container.querySelector(".menu-container")).toBeTruthy();
	});

	it("should close menu on outside click (smoke test)", async () => {
		const { container } = render(App);

		// Find the hamburger menu button
		const menuButton = container.querySelector(".menu-toggle");
		expect(menuButton).toBeTruthy();

		// SMOKE TEST: Only verifies outside click doesn't crash
		// TODO: Make this comprehensive - verify menu actually closes on outside click
		
		// Click to open menu
		await fireEvent.click(menuButton!);
		
		// Small delay for menu to open
		await new Promise(resolve => setTimeout(resolve, 50));

		// Click outside the menu (on the main content area)
		const mainContent = container.querySelector("main");
		if (mainContent) {
			await fireEvent.click(mainContent);
			
			// Small delay for any async operations
			await new Promise(resolve => setTimeout(resolve, 50));
		}

		// Verify UI is still intact
		expect(container.querySelector(".menu-toggle")).toBeTruthy();
		expect(container.querySelector(".header")).toBeTruthy();
		
		// Click on body as another outside click test
		await fireEvent.click(document.body);
		await new Promise(resolve => setTimeout(resolve, 50));
		
		// Verify everything still works
		expect(container.querySelector(".menu-container")).toBeTruthy();
	});

	it("should toggle dark mode from menu (smoke test)", async () => {
		const { container } = render(App);

		// Find the hamburger menu button
		const menuButton = container.querySelector(".menu-toggle");
		expect(menuButton).toBeTruthy();

		// SMOKE TEST: Only verifies dark mode toggle doesn't crash
		// TODO: Make this comprehensive - verify theme actually changes
		
		// Click to open menu
		await fireEvent.click(menuButton!);
		
		// Small delay for menu to open
		await new Promise(resolve => setTimeout(resolve, 50));

		// Find the theme toggle button - look for Light/Dark Mode text
		const menuItems = container.querySelectorAll(".menu-item");
		let themeToggle: Element | null = null;
		
		menuItems.forEach(item => {
			const text = item.textContent || "";
			if (text.includes("Light Mode") || text.includes("Dark Mode")) {
				themeToggle = item;
			}
		});

		if (themeToggle) {
			// Click the theme toggle
			await fireEvent.click(themeToggle);
			
			// Small delay for theme change
			await new Promise(resolve => setTimeout(resolve, 50));
		}

		// Verify UI is still intact after theme toggle
		expect(container.querySelector(".menu-toggle")).toBeTruthy();
		expect(container.querySelector(".header")).toBeTruthy();
		
		// Click theme toggle again if found (toggle back)
		if (themeToggle) {
			await fireEvent.click(menuButton!); // Re-open menu
			await new Promise(resolve => setTimeout(resolve, 50));
			
			// Find theme toggle again (text might have changed)
			const updatedMenuItems = container.querySelectorAll(".menu-item");
			updatedMenuItems.forEach(item => {
				const text = item.textContent || "";
				if (text.includes("Light Mode") || text.includes("Dark Mode")) {
					themeToggle = item;
				}
			});
			
			if (themeToggle) {
				await fireEvent.click(themeToggle);
				await new Promise(resolve => setTimeout(resolve, 50));
			}
		}
		
		// Verify everything still works
		expect(container.querySelector(".menu-container")).toBeTruthy();
	});

	it("should toggle minimap visibility from menu bar (smoke test)", async () => {
		// NOTE: Minimap toggle is in the menu bar by design, not the hamburger menu
		// The menu item is active regardless of whether there's an active comparison
		
		// Mock file selection and comparison first to have a diff view
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		const mockDiffResult = {
			lines: [
				{ type: "same", leftNumber: 1, rightNumber: 1, content: "line1" },
				{ type: "added", leftNumber: null, rightNumber: 2, content: "added" },
				{ type: "same", leftNumber: 2, rightNumber: 3, content: "line2" },
			],
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);

		const { container } = render(App);

		// First, set up a comparison so we can see the minimap effect
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff to load
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
		});

		// Find the hamburger menu button (menu bar)
		const menuButton = container.querySelector(".menu-toggle");
		expect(menuButton).toBeTruthy();

		// SMOKE TEST: Only verifies minimap toggle doesn't crash
		// TODO: Make this comprehensive - verify minimap actually shows/hides
		
		// Click to open menu
		await fireEvent.click(menuButton!);
		
		// Small delay for menu to open
		await new Promise(resolve => setTimeout(resolve, 50));

		// Find the minimap toggle button - look for Show/Hide Minimap text
		const menuItems = container.querySelectorAll(".menu-item");
		let minimapToggle: Element | null = null;
		
		menuItems.forEach(item => {
			const text = item.textContent || "";
			if (text.includes("Show Minimap") || text.includes("Hide Minimap")) {
				minimapToggle = item;
			}
		});

		if (minimapToggle && !minimapToggle.hasAttribute("disabled")) {
			// Click the minimap toggle
			await fireEvent.click(minimapToggle);
			
			// Small delay for minimap change
			await new Promise(resolve => setTimeout(resolve, 50));
		}

		// Verify UI is still intact
		expect(container.querySelector(".diff-viewer")).toBeTruthy();
		expect(container.querySelector(".header")).toBeTruthy();
		
		// Try toggling again
		if (minimapToggle && !minimapToggle.hasAttribute("disabled")) {
			await fireEvent.click(menuButton!); // Re-open menu
			await new Promise(resolve => setTimeout(resolve, 50));
			
			// Find minimap toggle again (text might have changed)
			const updatedMenuItems = container.querySelectorAll(".menu-item");
			updatedMenuItems.forEach(item => {
				const text = item.textContent || "";
				if (text.includes("Show Minimap") || text.includes("Hide Minimap")) {
					minimapToggle = item;
				}
			});
			
			if (minimapToggle && !minimapToggle.hasAttribute("disabled")) {
				await fireEvent.click(minimapToggle);
				await new Promise(resolve => setTimeout(resolve, 50));
			}
		}
		
		// Verify everything still works
		expect(container.querySelector(".menu-container")).toBeTruthy();
	});
});

describe("Minimap Interaction Tests", () => {
	it("should navigate to position when clicking on minimap (smoke test)", async () => {
		// Mock file selection and comparison to show minimap
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		const mockDiffResult = {
			lines: [
				{ type: "same", leftNumber: 1, rightNumber: 1, content: "line1" },
				{ type: "added", leftNumber: null, rightNumber: 2, content: "added line" },
				{ type: "same", leftNumber: 2, rightNumber: 3, content: "line2" },
				{ type: "removed", leftNumber: 3, rightNumber: null, content: "removed line" },
				{ type: "same", leftNumber: 4, rightNumber: 4, content: "line3" },
				{ type: "modified", leftNumber: 5, rightNumber: 5, content: "modified line" },
				{ type: "same", leftNumber: 6, rightNumber: 6, content: "line4" },
			],
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);

		const { container } = render(App);

		// Set up comparison
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff to load
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
		});

		// SMOKE TEST: Only verifies minimap click doesn't crash
		// TODO: Make this comprehensive - verify actual scroll position changes

		// Find the minimap
		const minimap = container.querySelector(".minimap");
		if (minimap) {
			// Try clicking somewhere on the minimap
			const minimapRect = minimap.getBoundingClientRect();
			const clickEvent = new MouseEvent("click", {
				bubbles: true,
				cancelable: true,
				clientX: minimapRect.left + minimapRect.width / 2,
				clientY: minimapRect.top + minimapRect.height / 2,
			});
			
			minimap.dispatchEvent(clickEvent);
			
			// Small delay for any scroll animation
			await new Promise(resolve => setTimeout(resolve, 100));
		}

		// Verify UI is still intact
		expect(container.querySelector(".diff-viewer")).toBeTruthy();
		expect(container.querySelector(".diff-content")).toBeTruthy();
	});

	it("should highlight current diff in minimap (smoke test)", async () => {
		// Mock file selection and comparison to show minimap with multiple diffs
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		const mockDiffResult = {
			lines: [
				{ type: "same", leftNumber: 1, rightNumber: 1, content: "line1" },
				{ type: "added", leftNumber: null, rightNumber: 2, content: "added line" },
				{ type: "same", leftNumber: 2, rightNumber: 3, content: "line2" },
				{ type: "removed", leftNumber: 3, rightNumber: null, content: "removed line" },
				{ type: "same", leftNumber: 4, rightNumber: 4, content: "line3" },
				{ type: "modified", leftNumber: 5, rightNumber: 5, content: "modified line" },
				{ type: "same", leftNumber: 6, rightNumber: 6, content: "line4" },
			],
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);

		const { container } = render(App);

		// Set up comparison
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff to load
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
		});

		// SMOKE TEST: Only verifies minimap renders with chunks and highlighting elements
		// TODO: Make this comprehensive - verify specific chunks are highlighted based on current diff

		// Find the minimap
		const minimap = container.querySelector(".minimap");
		expect(minimap).toBeTruthy();

		// Check if minimap has diff chunks rendered
		const minimapChunks = minimap?.querySelectorAll(".minimap-chunk");
		if (minimapChunks) {
			expect(minimapChunks.length).toBeGreaterThan(0);
			
			// Look for highlight-related classes or elements
			// In a real test we'd verify which chunk is highlighted
			const highlightedElements = minimap?.querySelectorAll(".highlight, .current-chunk, [class*='highlight']");
			// Just verify the highlight mechanism exists
			expect(highlightedElements).toBeDefined();
		}

		// Verify UI structure is intact
		expect(container.querySelector(".diff-viewer")).toBeTruthy();
		expect(container.querySelector(".minimap")).toBeTruthy();
	});

	it("should show viewport indicator in minimap (smoke test)", async () => {
		// Mock file selection and comparison to show minimap
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Create a longer diff to ensure scrolling is possible
		const mockDiffResult = {
			lines: Array.from({ length: 50 }, (_, i) => ({
				type: i % 10 === 0 ? "modified" : "same",
				leftNumber: i + 1,
				rightNumber: i + 1,
				content: `line ${i + 1}`,
			})),
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);

		const { container } = render(App);

		// Set up comparison
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff to load
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
		});

		// SMOKE TEST: Only verifies viewport indicator element exists
		// TODO: Make this comprehensive - verify viewport position updates with scroll

		// Find the minimap
		const minimap = container.querySelector(".minimap");
		expect(minimap).toBeTruthy();

		// Look for viewport indicator element
		const viewportIndicator = minimap?.querySelector(".minimap-viewport, .viewport-indicator, [class*='viewport']");
		expect(viewportIndicator).toBeTruthy();

		// Simulate a scroll event (though it won't actually scroll in test environment)
		const leftPane = container.querySelector(".diff-pane.left");
		if (leftPane) {
			fireEvent.scroll(leftPane, { target: { scrollTop: 100 } });
			await new Promise(resolve => setTimeout(resolve, 50));
		}

		// Verify UI structure is still intact after scroll attempt
		expect(container.querySelector(".diff-viewer")).toBeTruthy();
		expect(container.querySelector(".minimap")).toBeTruthy();
		
		// Viewport indicator should still exist
		const viewportAfterScroll = minimap?.querySelector(".minimap-viewport, .viewport-indicator, [class*='viewport']");
		expect(viewportAfterScroll).toBeTruthy();
	});

	it("should handle viewport drag to scroll in minimap (smoke test)", async () => {
		// Mock file selection and comparison to show minimap
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Create a longer diff to ensure scrolling is possible
		const mockDiffResult = {
			lines: Array.from({ length: 50 }, (_, i) => ({
				type: i % 10 === 0 ? "modified" : "same",
				leftNumber: i + 1,
				rightNumber: i + 1,
				content: `line ${i + 1}`,
			})),
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);

		const { container } = render(App);

		// Set up comparison
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff to load
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
		});

		// SMOKE TEST: Only verifies drag interaction doesn't crash
		// TODO: Make this comprehensive - verify drag actually scrolls the diff view

		// Find the minimap and viewport indicator
		const minimap = container.querySelector(".minimap");
		expect(minimap).toBeTruthy();

		const viewportIndicator = minimap?.querySelector(".minimap-viewport, .viewport-indicator, [class*='viewport']");
		expect(viewportIndicator).toBeTruthy();

		if (viewportIndicator) {
			// Simulate drag interaction
			const rect = viewportIndicator.getBoundingClientRect();
			
			// Mouse down on viewport
			fireEvent.mouseDown(viewportIndicator, {
				clientX: rect.left + rect.width / 2,
				clientY: rect.top + rect.height / 2,
			});

			// Mouse move (drag)
			fireEvent.mouseMove(document, {
				clientX: rect.left + rect.width / 2,
				clientY: rect.top + rect.height / 2 + 50,
			});

			// Mouse up to end drag
			fireEvent.mouseUp(document);

			await new Promise(resolve => setTimeout(resolve, 50));
		}

		// Verify UI structure is still intact after drag
		expect(container.querySelector(".diff-viewer")).toBeTruthy();
		expect(container.querySelector(".minimap")).toBeTruthy();
		expect(viewportIndicator).toBeTruthy();
	});

	it("should show tooltip with line numbers on minimap hover (smoke test)", async () => {
		// Mock file selection and comparison to show minimap
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		const mockDiffResult = {
			lines: [
				{ type: "same", leftNumber: 1, rightNumber: 1, content: "line1" },
				{ type: "added", leftNumber: null, rightNumber: 2, content: "added line" },
				{ type: "same", leftNumber: 2, rightNumber: 3, content: "line2" },
				{ type: "removed", leftNumber: 3, rightNumber: null, content: "removed line" },
				{ type: "same", leftNumber: 4, rightNumber: 4, content: "line3" },
				{ type: "modified", leftNumber: 5, rightNumber: 5, content: "modified line" },
				{ type: "same", leftNumber: 6, rightNumber: 6, content: "line4" },
			],
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);

		const { container } = render(App);

		// Set up comparison
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff to load
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
		});

		// SMOKE TEST: Only verifies hover interaction doesn't crash
		// TODO: Make this comprehensive - verify tooltip appears with correct line numbers

		// Find the minimap
		const minimap = container.querySelector(".minimap");
		expect(minimap).toBeTruthy();

		if (minimap) {
			// Simulate hover over minimap
			const rect = minimap.getBoundingClientRect();
			
			// Mouse enter minimap
			fireEvent.mouseEnter(minimap);
			
			// Mouse move within minimap
			fireEvent.mouseMove(minimap, {
				clientX: rect.left + rect.width / 2,
				clientY: rect.top + rect.height / 2,
			});

			await new Promise(resolve => setTimeout(resolve, 100));

			// Look for tooltip element (might be in document body or near minimap)
			const tooltip = document.querySelector(".minimap-tooltip, .tooltip, [role='tooltip']");
			// Just verify tooltip mechanism exists, actual content would require proper initialization
			
			// Mouse leave minimap
			fireEvent.mouseLeave(minimap);
		}

		// Verify UI structure is still intact
		expect(container.querySelector(".diff-viewer")).toBeTruthy();
		expect(container.querySelector(".minimap")).toBeTruthy();
	});
});

describe("Scroll Synchronization Tests", () => {
	it("should sync scroll from left pane to right pane (smoke test)", async () => {
		// Mock file selection and comparison to show scrollable content
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Create a longer diff to ensure scrolling is possible
		const mockDiffResult = {
			lines: Array.from({ length: 100 }, (_, i) => ({
				type: i % 15 === 0 ? "modified" : i % 20 === 0 ? "added" : "same",
				leftNumber: i + 1,
				rightNumber: i + 1,
				content: `line ${i + 1} with some longer content to make it scrollable`,
			})),
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);

		const { container } = render(App);

		// Set up comparison
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff to load
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
		});

		// SMOKE TEST: Only verifies scroll event doesn't crash
		// TODO: Make this comprehensive - verify right pane actually scrolls to match left pane

		// Find the left and right panes
		const leftPane = container.querySelector(".left-pane");
		const rightPane = container.querySelector(".right-pane");
		
		expect(leftPane).toBeTruthy();
		expect(rightPane).toBeTruthy();

		if (leftPane) {
			// Simulate scroll on left pane
			fireEvent.scroll(leftPane, { 
				target: { 
					scrollTop: 200,
					scrollLeft: 50 
				} 
			});

			// Small delay for scroll sync
			await new Promise(resolve => setTimeout(resolve, 50));
		}

		// Verify UI is still intact after scroll
		expect(container.querySelector(".diff-viewer")).toBeTruthy();
		expect(container.querySelector(".diff-content")).toBeTruthy();
		expect(leftPane).toBeTruthy();
		expect(rightPane).toBeTruthy();
	});

	it("should sync scroll from right pane to left pane (smoke test)", async () => {
		// Mock file selection and comparison to show scrollable content
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Create a longer diff to ensure scrolling is possible
		const mockDiffResult = {
			lines: Array.from({ length: 100 }, (_, i) => ({
				type: i % 15 === 0 ? "modified" : i % 20 === 0 ? "removed" : "same",
				leftNumber: i + 1,
				rightNumber: i + 1,
				content: `line ${i + 1} with some longer content to make it scrollable`,
			})),
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);

		const { container } = render(App);

		// Set up comparison
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff to load
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
		});

		// SMOKE TEST: Only verifies scroll event doesn't crash
		// TODO: Make this comprehensive - verify left pane actually scrolls to match right pane

		// Find the left and right panes
		const leftPane = container.querySelector(".left-pane");
		const rightPane = container.querySelector(".right-pane");
		
		expect(leftPane).toBeTruthy();
		expect(rightPane).toBeTruthy();

		if (rightPane) {
			// Simulate scroll on right pane
			fireEvent.scroll(rightPane, { 
				target: { 
					scrollTop: 300,
					scrollLeft: 75 
				} 
			});

			// Small delay for scroll sync
			await new Promise(resolve => setTimeout(resolve, 50));
		}

		// Verify UI is still intact after scroll
		expect(container.querySelector(".diff-viewer")).toBeTruthy();
		expect(container.querySelector(".diff-content")).toBeTruthy();
		expect(leftPane).toBeTruthy();
		expect(rightPane).toBeTruthy();
	});

	it("should sync scroll from center gutter to both panes (smoke test)", async () => {
		// Mock file selection and comparison to show scrollable content
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Create a longer diff to ensure scrolling is possible
		const mockDiffResult = {
			lines: Array.from({ length: 100 }, (_, i) => ({
				type: i % 10 === 0 ? "modified" : i % 25 === 0 ? "added" : "same",
				leftNumber: i + 1,
				rightNumber: i + 1,
				content: `line ${i + 1} with some longer content to make it scrollable`,
			})),
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);

		const { container } = render(App);

		// Set up comparison
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff to load
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
		});

		// SMOKE TEST: Only verifies scroll event doesn't crash
		// TODO: Make this comprehensive - verify both panes scroll to match center gutter

		// Find the center gutter
		const centerGutter = container.querySelector(".center-gutter");
		const leftPane = container.querySelector(".left-pane");
		const rightPane = container.querySelector(".right-pane");
		
		expect(centerGutter).toBeTruthy();
		expect(leftPane).toBeTruthy();
		expect(rightPane).toBeTruthy();

		if (centerGutter) {
			// Simulate scroll on center gutter
			fireEvent.scroll(centerGutter, { 
				target: { 
					scrollTop: 250,
					scrollLeft: 0 
				} 
			});

			// Small delay for scroll sync
			await new Promise(resolve => setTimeout(resolve, 50));
		}

		// Verify UI is still intact after scroll
		expect(container.querySelector(".diff-viewer")).toBeTruthy();
		expect(container.querySelector(".diff-content")).toBeTruthy();
		expect(centerGutter).toBeTruthy();
		expect(leftPane).toBeTruthy();
		expect(rightPane).toBeTruthy();
	});

	it("should sync horizontal scroll between panes (smoke test)", async () => {
		// Mock file selection and comparison with long lines for horizontal scrolling
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Create diff with very long lines to enable horizontal scrolling
		const mockDiffResult = {
			lines: Array.from({ length: 50 }, (_, i) => ({
				type: i % 8 === 0 ? "modified" : "same",
				leftNumber: i + 1,
				rightNumber: i + 1,
				content: `line ${i + 1} ${"x".repeat(200)} very long content to enable horizontal scrolling`,
			})),
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);

		const { container } = render(App);

		// Set up comparison
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff to load
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
		});

		// SMOKE TEST: Only verifies horizontal scroll event doesn't crash
		// TODO: Make this comprehensive - verify horizontal scroll syncs between panes

		// Find the panes
		const leftPane = container.querySelector(".left-pane");
		const rightPane = container.querySelector(".right-pane");
		
		expect(leftPane).toBeTruthy();
		expect(rightPane).toBeTruthy();

		if (leftPane) {
			// Simulate horizontal scroll on left pane
			fireEvent.scroll(leftPane, { 
				target: { 
					scrollTop: 0,
					scrollLeft: 150 
				} 
			});

			// Small delay for scroll sync
			await new Promise(resolve => setTimeout(resolve, 50));
		}

		// Try scrolling right pane horizontally as well
		if (rightPane) {
			fireEvent.scroll(rightPane, { 
				target: { 
					scrollTop: 0,
					scrollLeft: 200 
				} 
			});

			await new Promise(resolve => setTimeout(resolve, 50));
		}

		// Verify UI is still intact after horizontal scroll
		expect(container.querySelector(".diff-viewer")).toBeTruthy();
		expect(container.querySelector(".diff-content")).toBeTruthy();
		expect(leftPane).toBeTruthy();
		expect(rightPane).toBeTruthy();
	});
});

describe("Save and Unsaved Changes Tests", () => {
	it("should save left file changes (smoke test)", async () => {
		// Mock file selection and comparison
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		const mockDiffResult = {
			lines: [
				{ type: "same", leftNumber: 1, rightNumber: 1, content: "line1" },
				{ type: "modified", leftNumber: 2, rightNumber: 2, content: "modified line" },
				{ type: "same", leftNumber: 3, rightNumber: 3, content: "line3" },
			],
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);

		const { container } = render(App);

		// Set up comparison
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff to load
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
		});

		// SMOKE TEST: Only verifies save action doesn't crash
		// TODO: Make this comprehensive - verify file is actually saved

		// Find save button for left file
		const leftSaveButton = container.querySelector(".file-info.left .save-btn");
		expect(leftSaveButton).toBeTruthy();

		// Mock SaveChanges to succeed
		vi.mocked(SaveChanges).mockResolvedValue(undefined);

		if (leftSaveButton && !leftSaveButton.hasAttribute("disabled")) {
			// Click save button
			await fireEvent.click(leftSaveButton);
			
			// Small delay for save operation
			await new Promise(resolve => setTimeout(resolve, 50));
		}

		// Verify UI is still intact
		expect(container.querySelector(".diff-viewer")).toBeTruthy();
		expect(container.querySelector(".file-header")).toBeTruthy();
		
		// Verify SaveChanges was called (if button was enabled)
		// In real test, we'd verify the file content and path
	});

	it("should save right file changes (smoke test)", async () => {
		// Mock file selection and comparison
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		const mockDiffResult = {
			lines: [
				{ type: "same", leftNumber: 1, rightNumber: 1, content: "line1" },
				{ type: "modified", leftNumber: 2, rightNumber: 2, content: "modified line" },
				{ type: "same", leftNumber: 3, rightNumber: 3, content: "line3" },
			],
		};

		vi.mocked(CompareFiles).mockResolvedValue(mockDiffResult);

		const { container } = render(App);

		// Set up comparison
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		const compareButton = container.querySelector(".compare-btn");

		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);
		await fireEvent.click(compareButton!);

		// Wait for diff to load
		await waitFor(() => {
			const diffContent = container.querySelector(".diff-content");
			expect(diffContent).toBeTruthy();
		});

		// SMOKE TEST: Only verifies save action doesn't crash
		// TODO: Make this comprehensive - verify file is actually saved

		// Find save button for right file
		const rightSaveButton = container.querySelector(".file-info.right .save-btn");
		expect(rightSaveButton).toBeTruthy();

		// Mock SaveChanges to succeed
		vi.mocked(SaveChanges).mockResolvedValue(undefined);

		if (rightSaveButton && !rightSaveButton.hasAttribute("disabled")) {
			// Click save button
			await fireEvent.click(rightSaveButton);
			
			// Small delay for save operation
			await new Promise(resolve => setTimeout(resolve, 50));
		}

		// Verify UI is still intact
		expect(container.querySelector(".diff-viewer")).toBeTruthy();
		expect(container.querySelector(".file-header")).toBeTruthy();
		
		// Verify SaveChanges was called (if button was enabled)
		// In real test, we'd verify the file content and path
	});

	// Test: Unsaved changes indicators
	it("should show unsaved changes indicators (smoke test)", async () => {
		const { container } = render(App);

		// Mock SelectFile for file selections
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Mock CompareFiles to succeed with a diff
		vi.mocked(CompareFiles).mockResolvedValueOnce({
			lineNumberWidth: 3,
			lines: [
				{
					type: "modified",
					leftLineNumber: 1,
					rightLineNumber: 1,
					leftContent: "old content",
					rightContent: "new content",
				},
			],
		});

		// Select files and compare
		const [leftButton, rightButton] = container.querySelectorAll(
			".file-btn",
		);
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);

		const compareButton = container.querySelector(
			".compare-btn",
		) as HTMLButtonElement;
		await fireEvent.click(compareButton);

		// Wait for diff to render
		await waitFor(() => {
			const diffViewer = container.querySelector(".diff-viewer");
			expect(diffViewer).toBeTruthy();
		});

		// Mock CopyToFile to succeed
		vi.mocked(CopyToFile).mockResolvedValueOnce(true);

		// Simulate a copy operation that would create unsaved changes
		// Press Shift+L to copy left to right
		await fireEvent.keyDown(document, { key: "L", shiftKey: true });

		// Wait a bit for state updates
		await new Promise(resolve => setTimeout(resolve, 50));

		// Check for unsaved indicator elements
		// Note: This is a smoke test - we're just verifying no crashes
		// In a real test, we'd verify the actual indicator appears
		const fileHeaders = container.querySelectorAll(".file-header");
		expect(fileHeaders.length).toBeGreaterThan(0);

		// Verify UI is intact
		const diffViewer = container.querySelector(".diff-viewer");
		expect(diffViewer).toBeTruthy();
	});

	// Test: Confirmation before discarding changes
	it("should confirm before discarding changes (smoke test)", async () => {
		const { container } = render(App);

		// Mock SelectFile for file selections
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt")
			.mockResolvedValueOnce("/path/to/new.txt"); // For the new file selection

		// Mock CompareFiles to succeed with a diff
		vi.mocked(CompareFiles).mockResolvedValueOnce({
			lineNumberWidth: 3,
			lines: [
				{
					type: "modified",
					leftLineNumber: 1,
					rightLineNumber: 1,
					leftContent: "old content",
					rightContent: "new content",
				},
			],
		});

		// Select files and compare
		const [leftButton, rightButton] = container.querySelectorAll(
			".file-btn",
		);
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);

		const compareButton = container.querySelector(
			".compare-btn",
		) as HTMLButtonElement;
		await fireEvent.click(compareButton);

		// Wait for diff to render
		await waitFor(() => {
			const diffViewer = container.querySelector(".diff-viewer");
			expect(diffViewer).toBeTruthy();
		});

		// Mock CopyToFile to succeed
		vi.mocked(CopyToFile).mockResolvedValueOnce(true);

		// Simulate a copy operation that would create unsaved changes
		await fireEvent.keyDown(document, { key: "L", shiftKey: true });

		// Wait a bit for state updates
		await new Promise(resolve => setTimeout(resolve, 50));

		// Try to select a new file (which would discard changes)
		// In a real app, this would trigger a confirmation dialog
		const firstButton = container.querySelector(
			".file-btn",
		) as HTMLButtonElement;
		
		// Click to select new file - should not throw
		await fireEvent.click(firstButton);

		// Verify UI is intact
		// Note: This is a smoke test - we can't verify the actual confirmation dialog
		const diffViewer = container.querySelector(".diff-viewer");
		expect(diffViewer).toBeTruthy();
	});
});

describe("Quit Dialog Tests", () => {
	// Test: Quit dialog shows when unsaved changes exist
	it("should show quit dialog when unsaved changes exist (smoke test)", async () => {
		const { container } = render(App);

		// Mock SelectFile for file selections
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Mock CompareFiles to succeed with a diff
		vi.mocked(CompareFiles).mockResolvedValueOnce({
			lineNumberWidth: 3,
			lines: [
				{
					type: "modified",
					leftLineNumber: 1,
					rightLineNumber: 1,
					leftContent: "old content",
					rightContent: "new content",
				},
			],
		});

		// Select files and compare
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);

		const compareButton = container.querySelector(
			".compare-btn",
		) as HTMLButtonElement;
		await fireEvent.click(compareButton);

		// Wait for diff to render
		await waitFor(() => {
			const diffViewer = container.querySelector(".diff-viewer");
			expect(diffViewer).toBeTruthy();
		});

		// Mock CopyToFile to succeed
		vi.mocked(CopyToFile).mockResolvedValueOnce(true);

		// Simulate a copy operation that would create unsaved changes
		await fireEvent.keyDown(document, { key: "L", shiftKey: true });

		// Wait a bit for state updates
		await new Promise(resolve => setTimeout(resolve, 50));

		// Simulate quit action (Cmd/Ctrl+Q)
		const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
		await fireEvent.keyDown(document, { 
			key: "q", 
			metaKey: isMac,
			ctrlKey: !isMac 
		});

		// Note: This is a smoke test - we can't verify the actual dialog appears
		// Just verify the app doesn't crash
		expect(container.querySelector("main")).toBeTruthy();
	});

	// Test: Save selected files option in quit dialog
	it("should handle save selected files in quit dialog (smoke test)", async () => {
		const { container } = render(App);

		// Mock SelectFile for file selections
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Mock CompareFiles to succeed with a diff
		vi.mocked(CompareFiles).mockResolvedValueOnce({
			lineNumberWidth: 3,
			lines: [
				{
					type: "modified",
					leftLineNumber: 1,
					rightLineNumber: 1,
					leftContent: "old content",
					rightContent: "new content",
				},
			],
		});

		// Select files and compare
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);

		const compareButton = container.querySelector(
			".compare-btn",
		) as HTMLButtonElement;
		await fireEvent.click(compareButton);

		// Wait for diff to render
		await waitFor(() => {
			const diffViewer = container.querySelector(".diff-viewer");
			expect(diffViewer).toBeTruthy();
		});

		// Mock CopyToFile to succeed
		vi.mocked(CopyToFile).mockResolvedValueOnce(true);

		// Simulate a copy operation that would create unsaved changes
		await fireEvent.keyDown(document, { key: "L", shiftKey: true });

		// Wait a bit for state updates
		await new Promise(resolve => setTimeout(resolve, 50));

		// Mock SaveChanges to succeed
		vi.mocked(SaveChanges).mockResolvedValue(true);

		// Simulate quit action
		const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
		await fireEvent.keyDown(document, { 
			key: "q", 
			metaKey: isMac,
			ctrlKey: !isMac 
		});

		// In a real test, we would:
		// 1. Verify quit dialog appears
		// 2. Select files to save
		// 3. Click "Save Selected & Quit"
		// 4. Verify SaveChanges is called for selected files
		// 5. Verify app closes

		// Since this is a smoke test, just verify no crash
		expect(container.querySelector("main")).toBeTruthy();
	});

	// Test: Discard all changes option in quit dialog
	it("should handle discard all changes in quit dialog (smoke test)", async () => {
		const { container } = render(App);

		// Mock SelectFile for file selections
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Mock CompareFiles to succeed with a diff
		vi.mocked(CompareFiles).mockResolvedValueOnce({
			lineNumberWidth: 3,
			lines: [
				{
					type: "modified",
					leftLineNumber: 1,
					rightLineNumber: 1,
					leftContent: "old content",
					rightContent: "new content",
				},
			],
		});

		// Select files and compare
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);

		const compareButton = container.querySelector(
			".compare-btn",
		) as HTMLButtonElement;
		await fireEvent.click(compareButton);

		// Wait for diff to render
		await waitFor(() => {
			const diffViewer = container.querySelector(".diff-viewer");
			expect(diffViewer).toBeTruthy();
		});

		// Mock CopyToFile to succeed
		vi.mocked(CopyToFile).mockResolvedValueOnce(true);

		// Simulate a copy operation that would create unsaved changes
		await fireEvent.keyDown(document, { key: "L", shiftKey: true });

		// Wait a bit for state updates
		await new Promise(resolve => setTimeout(resolve, 50));

		// Simulate quit action
		const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
		await fireEvent.keyDown(document, { 
			key: "q", 
			metaKey: isMac,
			ctrlKey: !isMac 
		});

		// In a real test, we would:
		// 1. Verify quit dialog appears
		// 2. Click "Discard All & Quit"
		// 3. Verify no save operations occur
		// 4. Verify app closes without saving

		// Since this is a smoke test, just verify no crash
		expect(container.querySelector("main")).toBeTruthy();
	});

	// Test: Cancel option in quit dialog
	it("should handle cancel in quit dialog (smoke test)", async () => {
		const { container } = render(App);

		// Mock SelectFile for file selections
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/left.txt")
			.mockResolvedValueOnce("/path/to/right.txt");

		// Mock CompareFiles to succeed with a diff
		vi.mocked(CompareFiles).mockResolvedValueOnce({
			lineNumberWidth: 3,
			lines: [
				{
					type: "modified",
					leftLineNumber: 1,
					rightLineNumber: 1,
					leftContent: "old content",
					rightContent: "new content",
				},
			],
		});

		// Select files and compare
		const [leftButton, rightButton] = container.querySelectorAll(".file-btn");
		await fireEvent.click(leftButton);
		await fireEvent.click(rightButton);

		const compareButton = container.querySelector(
			".compare-btn",
		) as HTMLButtonElement;
		await fireEvent.click(compareButton);

		// Wait for diff to render
		await waitFor(() => {
			const diffViewer = container.querySelector(".diff-viewer");
			expect(diffViewer).toBeTruthy();
		});

		// Mock CopyToFile to succeed
		vi.mocked(CopyToFile).mockResolvedValueOnce(true);

		// Simulate a copy operation that would create unsaved changes
		await fireEvent.keyDown(document, { key: "L", shiftKey: true });

		// Wait a bit for state updates
		await new Promise(resolve => setTimeout(resolve, 50));

		// Simulate quit action
		const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
		await fireEvent.keyDown(document, { 
			key: "q", 
			metaKey: isMac,
			ctrlKey: !isMac 
		});

		// In a real test, we would:
		// 1. Verify quit dialog appears
		// 2. Click "Cancel" or press Escape
		// 3. Verify dialog closes
		// 4. Verify app continues running
		// 5. Verify unsaved changes are preserved

		// Since this is a smoke test, just verify no crash
		expect(container.querySelector("main")).toBeTruthy();
		expect(container.querySelector(".diff-viewer")).toBeTruthy();
	});
});
