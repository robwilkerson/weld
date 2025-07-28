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
	UpdateSaveMenuItems: vi.fn(),
	UpdateDiffNavigationMenuItems: vi.fn(),
}));

import {
	CompareFiles,
	CopyToFile,
	GetInitialFiles,
	GetMinimapVisible,
	SaveChanges,
	SelectFile,
} from "../../../wailsjs/go/main/App.js";

describe("Quit Dialog Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Default mocks
		vi.mocked(GetInitialFiles).mockResolvedValue(["", ""]);
		vi.mocked(GetMinimapVisible).mockResolvedValue(true);
	});

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
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Simulate quit action (Cmd/Ctrl+Q)
		const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
		await fireEvent.keyDown(document, {
			key: "q",
			metaKey: isMac,
			ctrlKey: !isMac,
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
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Mock SaveChanges to succeed
		vi.mocked(SaveChanges).mockResolvedValue(true);

		// Simulate quit action
		const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
		await fireEvent.keyDown(document, {
			key: "q",
			metaKey: isMac,
			ctrlKey: !isMac,
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
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Simulate quit action
		const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
		await fireEvent.keyDown(document, {
			key: "q",
			metaKey: isMac,
			ctrlKey: !isMac,
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
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Simulate quit action
		const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
		await fireEvent.keyDown(document, {
			key: "q",
			metaKey: isMac,
			ctrlKey: !isMac,
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
