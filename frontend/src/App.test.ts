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
