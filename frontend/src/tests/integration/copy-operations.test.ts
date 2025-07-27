import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	CompareFiles,
	CopyToFile,
	GetInitialFiles,
	GetMinimapVisible,
	SelectFile,
} from "../../../wailsjs/go/main/App.js";
import App from "../../App.svelte";

// Mock wails runtime and file handler functions
vi.mock("../../../wailsjs/runtime/runtime.js", () => ({
	BrowserOpenURL: vi.fn(),
	EventsOn: vi.fn(),
	EventsOff: vi.fn(),
	WindowIsMinimised: vi.fn(() => Promise.resolve(false)),
	WindowIsMaximised: vi.fn(() => Promise.resolve(false)),
	WindowSetTitle: vi.fn(),
	Quit: vi.fn(),
}));

vi.mock("../../../wailsjs/go/main/App.js", () => ({
	GetInitialFiles: vi.fn(),
	SelectFile: vi.fn(),
	CompareFiles: vi.fn(),
	CopyToFile: vi.fn(),
	SaveChanges: vi.fn(),
	HasUnsavedChanges: vi.fn(),
	ReloadFile: vi.fn(),
	GetMinimapVisible: vi.fn(),
	SetMinimapVisible: vi.fn(),
	GetScrollSyncEnabled: vi.fn(),
	SetScrollSyncEnabled: vi.fn(),
}));

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
				{
					type: "removed",
					leftNumber: 3,
					rightNumber: null,
					content: "removed",
				},
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
		await new Promise((resolve) => setTimeout(resolve, 50));

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
				{
					type: "added",
					leftNumber: null,
					rightNumber: 2,
					content: "added line",
				},
				{ type: "same", leftNumber: 2, rightNumber: 3, content: "line2" },
				{
					type: "removed",
					leftNumber: 3,
					rightNumber: null,
					content: "removed line",
				},
				{ type: "same", leftNumber: 4, rightNumber: 4, content: "line3" },
				{
					type: "modified",
					leftNumber: 5,
					rightNumber: 5,
					content: "modified line",
				},
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
		await new Promise((resolve) => setTimeout(resolve, 50));

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
				{
					type: "added",
					leftNumber: null,
					rightNumber: 2,
					content: "single added line",
				},
				{ type: "same", leftNumber: 2, rightNumber: 3, content: "line2" },
				{
					type: "removed",
					leftNumber: 3,
					rightNumber: null,
					content: "single removed line",
				},
				{ type: "same", leftNumber: 4, rightNumber: 4, content: "line3" },
				{
					type: "modified",
					leftNumber: 5,
					rightNumber: 5,
					content: "modified line",
				},
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

		// SMOKE TEST: Only verifies copy operations don't crash
		// TODO: Make this comprehensive - test copying single lines in both directions

		// Navigate to the first diff (added line)
		await fireEvent.keyDown(document, { key: "j" });
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Copy the single added line from right to left
		await fireEvent.keyDown(document, { key: "H", shiftKey: true });
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Navigate to the removed line
		await fireEvent.keyDown(document, { key: "j" });
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Copy the single removed line from left to right
		await fireEvent.keyDown(document, { key: "L", shiftKey: true });
		await new Promise((resolve) => setTimeout(resolve, 50));

		// SMOKE TEST: Only verify the UI remains functional after operations
		// TODO: Make this comprehensive - verify actual copy operations and unsaved indicators

		// Verify the UI is still functional
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
				{
					type: "added",
					leftNumber: null,
					rightNumber: 2,
					content: "added line 1",
				},
				{
					type: "added",
					leftNumber: null,
					rightNumber: 3,
					content: "added line 2",
				},
				{
					type: "added",
					leftNumber: null,
					rightNumber: 4,
					content: "added line 3",
				},
				{ type: "same", leftNumber: 2, rightNumber: 5, content: "line2" },
				{
					type: "removed",
					leftNumber: 3,
					rightNumber: null,
					content: "removed line 1",
				},
				{
					type: "removed",
					leftNumber: 4,
					rightNumber: null,
					content: "removed line 2",
				},
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
			await new Promise((resolve) => setTimeout(resolve, 50));
		}

		// Navigate to first chunk and try keyboard copy
		await fireEvent.keyDown(document, { key: "j" });
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Copy entire added chunk from right to left
		await fireEvent.keyDown(document, { key: "H", shiftKey: true });
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Navigate to removed chunk
		await fireEvent.keyDown(document, { key: "j" });
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Copy entire removed chunk from left to right
		await fireEvent.keyDown(document, { key: "L", shiftKey: true });
		await new Promise((resolve) => setTimeout(resolve, 50));

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
				{
					type: "modified",
					leftNumber: 2,
					rightNumber: 2,
					content: "modified line 1",
				},
				{
					type: "modified",
					leftNumber: 3,
					rightNumber: 3,
					content: "modified line 2",
				},
				{
					type: "modified",
					leftNumber: 4,
					rightNumber: 4,
					content: "modified line 3",
				},
				{ type: "same", leftNumber: 5, rightNumber: 5, content: "line2" },
				{
					type: "modified",
					leftNumber: 6,
					rightNumber: 6,
					content: "another modified",
				},
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
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Copy modified chunk from left to right
		await fireEvent.keyDown(document, { key: "L", shiftKey: true });
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Navigate to next modified chunk
		await fireEvent.keyDown(document, { key: "j" });
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Copy modified chunk from right to left
		await fireEvent.keyDown(document, { key: "H", shiftKey: true });
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Try clicking gutter buttons for modified chunks
		const gutterButtons = container.querySelectorAll(".gutter-action");
		if (gutterButtons.length > 1) {
			await fireEvent.click(gutterButtons[1]);
			await new Promise((resolve) => setTimeout(resolve, 50));
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
				{
					type: "added",
					leftNumber: null,
					rightNumber: 2,
					content: "added line 1",
				},
				{
					type: "added",
					leftNumber: null,
					rightNumber: 3,
					content: "added line 2",
				},
				{ type: "same", leftNumber: 2, rightNumber: 4, content: "line2" },
				{
					type: "removed",
					leftNumber: 3,
					rightNumber: null,
					content: "removed line 1",
				},
				{
					type: "removed",
					leftNumber: 4,
					rightNumber: null,
					content: "removed line 2",
				},
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
			await new Promise((resolve) => setTimeout(resolve, 50));
		}

		// Navigate through diffs and simulate delete operations
		await fireEvent.keyDown(document, { key: "j" });
		await new Promise((resolve) => setTimeout(resolve, 50));

		// In a real implementation, there might be specific keyboard shortcuts for delete
		// For now, we're just verifying the UI remains stable

		// Verify UI is still intact after delete operations
		const diffViewer = container.querySelector(".diff-viewer");
		expect(diffViewer).toBeTruthy();
		expect(diffViewer?.classList.contains("comparing")).toBe(false);
	});
});
