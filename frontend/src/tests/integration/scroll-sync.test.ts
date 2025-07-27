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
	GetInitialFiles,
	GetMinimapVisible,
	SelectFile,
} from "../../../wailsjs/go/main/App.js";

describe("Scroll Synchronization Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Default mocks
		vi.mocked(GetInitialFiles).mockResolvedValue(["", ""]);
		vi.mocked(GetMinimapVisible).mockResolvedValue(true);
	});

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
					scrollLeft: 50,
				},
			});

			// Small delay for scroll sync
			await new Promise((resolve) => setTimeout(resolve, 50));
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
					scrollLeft: 75,
				},
			});

			// Small delay for scroll sync
			await new Promise((resolve) => setTimeout(resolve, 50));
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
					scrollLeft: 0,
				},
			});

			// Small delay for scroll sync
			await new Promise((resolve) => setTimeout(resolve, 50));
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
					scrollLeft: 150,
				},
			});

			// Small delay for scroll sync
			await new Promise((resolve) => setTimeout(resolve, 50));
		}

		// Try scrolling right pane horizontally as well
		if (rightPane) {
			fireEvent.scroll(rightPane, {
				target: {
					scrollTop: 0,
					scrollLeft: 200,
				},
			});

			await new Promise((resolve) => setTimeout(resolve, 50));
		}

		// Verify UI is still intact after horizontal scroll
		expect(container.querySelector(".diff-viewer")).toBeTruthy();
		expect(container.querySelector(".diff-content")).toBeTruthy();
		expect(leftPane).toBeTruthy();
		expect(rightPane).toBeTruthy();
	});
});
