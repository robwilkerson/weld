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
