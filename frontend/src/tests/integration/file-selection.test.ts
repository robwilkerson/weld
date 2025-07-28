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
	GetInitialFiles,
	GetMinimapVisible,
	SelectFile,
} from "../../../wailsjs/go/main/App.js";

describe("App Component - File Selection", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Default mocks
		vi.mocked(GetInitialFiles).mockResolvedValue(["", ""]);
		vi.mocked(GetMinimapVisible).mockResolvedValue(true);
	});

	it("should handle file selection and update UI accordingly", async () => {
		// Mock different file selections
		vi.mocked(SelectFile)
			.mockResolvedValueOnce("/path/to/script.js")
			.mockResolvedValueOnce("/path/to/styles.css")
			.mockResolvedValueOnce("") // Cancel scenario
			.mockResolvedValueOnce("/path/to/index.html");

		const { container } = render(App);

		// Get all file buttons and compare button
		const fileButtons = container.querySelectorAll(".file-btn");
		const leftFileButton = fileButtons[0] as HTMLButtonElement;
		const rightFileButton = fileButtons[1] as HTMLButtonElement;
		const compareButton = container.querySelector(
			".compare-btn",
		) as HTMLButtonElement;

		expect(leftFileButton).toBeTruthy();
		expect(rightFileButton).toBeTruthy();
		expect(compareButton).toBeTruthy();

		// Initially, compare button should be disabled
		expect(compareButton.disabled).toBe(true);
		expect(leftFileButton.textContent).toContain("Select left file...");
		expect(rightFileButton.textContent).toContain("Select right file...");

		// Select left file
		await fireEvent.click(leftFileButton);

		// Verify left file selection
		await waitFor(() => {
			expect(SelectFile).toHaveBeenCalledTimes(1);
			expect(leftFileButton.textContent).toContain("script.js");

			// Check icon update
			const leftIcon = leftFileButton.querySelector(".file-icon");
			expect(leftIcon?.getAttribute("title")).toBe("JavaScript");

			// Compare button should still be disabled (only one file selected)
			expect(compareButton.disabled).toBe(true);
		});

		// Select right file
		await fireEvent.click(rightFileButton);

		// Verify right file selection
		await waitFor(() => {
			expect(SelectFile).toHaveBeenCalledTimes(2);
			expect(rightFileButton.textContent).toContain("styles.css");

			// Check icon update
			const rightIcon = rightFileButton.querySelector(".file-icon");
			expect(rightIcon?.getAttribute("title")).toBe("CSS");

			// Compare button should now be enabled
			expect(compareButton.disabled).toBe(false);
		});

		// Test cancel scenario - click left file again but cancel
		await fireEvent.click(leftFileButton);

		// Verify file remains unchanged when cancelled
		await waitFor(() => {
			expect(SelectFile).toHaveBeenCalledTimes(3);
			// File should remain the same
			expect(leftFileButton.textContent).toContain("script.js");
			expect(compareButton.disabled).toBe(false);
		});

		// Test file replacement - select different right file
		await fireEvent.click(rightFileButton);

		// Verify file replacement
		await waitFor(() => {
			expect(SelectFile).toHaveBeenCalledTimes(4);
			expect(rightFileButton.textContent).toContain("index.html");

			// Check icon update for HTML file
			const rightIcon = rightFileButton.querySelector(".file-icon");
			expect(rightIcon?.getAttribute("title")).toBe("HTML");

			// Compare button should remain enabled
			expect(compareButton.disabled).toBe(false);
		});

		// Verify both files are properly set
		const leftFileName = leftFileButton.querySelector(".file-name");
		const rightFileName = rightFileButton.querySelector(".file-name");
		expect(leftFileName?.textContent).toBe("script.js");
		expect(rightFileName?.textContent).toBe("index.html");
	});
});
