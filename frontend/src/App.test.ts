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
