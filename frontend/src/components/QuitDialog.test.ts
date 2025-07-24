import { fireEvent, render } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom";
import QuitDialog from "./QuitDialog.svelte";

// Mock the path utilities
vi.mock("../utils/path.js", () => ({
	getDisplayFileName: vi.fn((path) => path.split("/").pop() || path),
}));

describe("QuitDialog", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should not render when show is false", () => {
		const { container } = render(QuitDialog, {
			props: {
				show: false,
			},
		});

		expect(container.querySelector(".modal-overlay")).not.toBeInTheDocument();
	});

	it("should render when show is true", () => {
		const { container, getByText } = render(QuitDialog, {
			props: {
				show: true,
			},
		});

		expect(container.querySelector(".modal-overlay")).toBeInTheDocument();
		expect(getByText("Unsaved Changes")).toBeInTheDocument();
		expect(
			getByText("Select which files to save before quitting:"),
		).toBeInTheDocument();
	});

	it("should display file paths with checkboxes", () => {
		const { getByText, container } = render(QuitDialog, {
			props: {
				show: true,
				leftFilePath: "/path/to/left.js",
				rightFilePath: "/path/to/right.js",
				quitDialogFiles: ["/path/to/left.js"],
				fileSelections: {
					"/path/to/left.js": true,
					"/path/to/right.js": false,
				},
			},
		});

		expect(getByText("left.js")).toBeInTheDocument();
		expect(getByText("right.js")).toBeInTheDocument();

		const checkboxes = container.querySelectorAll('input[type="checkbox"]');
		expect(checkboxes).toHaveLength(2);
		expect(checkboxes[0]).not.toBeDisabled();
		expect(checkboxes[1]).toBeDisabled();
	});

	it("should show (no changes) for files not in quitDialogFiles", () => {
		const { getByText } = render(QuitDialog, {
			props: {
				show: true,
				leftFilePath: "/path/to/left.js",
				rightFilePath: "/path/to/right.js",
				quitDialogFiles: ["/path/to/left.js"],
				fileSelections: {
					"/path/to/left.js": true,
					"/path/to/right.js": false,
				},
			},
		});

		expect(getByText("(no changes)")).toBeInTheDocument();
	});

	it("should not show duplicate files", () => {
		const { container } = render(QuitDialog, {
			props: {
				show: true,
				leftFilePath: "/path/to/file.js",
				rightFilePath: "/path/to/file.js",
				quitDialogFiles: ["/path/to/file.js"],
				fileSelections: {
					"/path/to/file.js": true,
				},
			},
		});

		const checkboxes = container.querySelectorAll('input[type="checkbox"]');
		expect(checkboxes).toHaveLength(1);
	});

	it("should dispatch saveAndQuit event when Save Selected & Quit clicked", async () => {
		const { getByText, component } = render(QuitDialog, {
			props: {
				show: true,
			},
		});

		const saveAndQuitHandler = vi.fn();
		component.$on("saveAndQuit", saveAndQuitHandler);

		const button = getByText("Save Selected & Quit");
		await fireEvent.click(button);

		expect(saveAndQuitHandler).toHaveBeenCalled();
	});

	it("should dispatch quitWithoutSaving event when Quit Without Saving clicked", async () => {
		const { getByText, component } = render(QuitDialog, {
			props: {
				show: true,
			},
		});

		const quitWithoutSavingHandler = vi.fn();
		component.$on("quitWithoutSaving", quitWithoutSavingHandler);

		const button = getByText("Quit Without Saving");
		await fireEvent.click(button);

		expect(quitWithoutSavingHandler).toHaveBeenCalled();
	});

	it("should dispatch cancel event when Cancel clicked", async () => {
		const { getByText, component } = render(QuitDialog, {
			props: {
				show: true,
			},
		});

		const cancelHandler = vi.fn();
		component.$on("cancel", cancelHandler);

		const button = getByText("Cancel");
		await fireEvent.click(button);

		expect(cancelHandler).toHaveBeenCalled();
	});

	it("should dispatch cancel event when overlay clicked", async () => {
		const { container, component } = render(QuitDialog, {
			props: {
				show: true,
			},
		});

		const cancelHandler = vi.fn();
		component.$on("cancel", cancelHandler);

		const overlay = container.querySelector(".modal-overlay");
		if (overlay) {
			await fireEvent.click(overlay);
			expect(cancelHandler).toHaveBeenCalled();
		}
	});

	it("should not close when dialog content clicked", async () => {
		const { container, component } = render(QuitDialog, {
			props: {
				show: true,
			},
		});

		const cancelHandler = vi.fn();
		component.$on("cancel", cancelHandler);

		const dialog = container.querySelector(".quit-dialog");
		if (dialog) {
			await fireEvent.click(dialog);
			expect(cancelHandler).not.toHaveBeenCalled();
		}
	});

	it("should bind checkbox values to fileSelections", async () => {
		const fileSelections = {
			"/path/to/left.js": false,
		};

		const { container } = render(QuitDialog, {
			props: {
				show: true,
				leftFilePath: "/path/to/left.js",
				quitDialogFiles: ["/path/to/left.js"],
				fileSelections,
			},
		});

		const checkbox = container.querySelector(
			'input[type="checkbox"]',
		) as HTMLInputElement;
		expect(checkbox.checked).toBe(false);

		await fireEvent.click(checkbox);
		expect(fileSelections["/path/to/left.js"]).toBe(true);
	});
});
