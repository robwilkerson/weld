import { fireEvent, render } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom";
import FileSelector from "./FileSelector.svelte";

// Mock the Wails API
vi.mock("../../wailsjs/go/main/App.js", () => ({
	SelectFile: vi.fn(),
}));

// Mock the file icon utilities
vi.mock("../utils/fileIcons.js", () => ({
	getFileIcon: vi.fn(() => "<svg></svg>"),
	getFileTypeName: vi.fn((filename) => {
		if (filename.endsWith(".js")) return "JavaScript";
		if (filename.endsWith(".py")) return "Python";
		return "Unknown File Type";
	}),
}));

import { SelectFile } from "../../wailsjs/go/main/App.js";

describe("FileSelector", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should render with default values", () => {
		const { getByText } = render(FileSelector);

		expect(getByText("Select left file...")).toBeInTheDocument();
		expect(getByText("Select right file...")).toBeInTheDocument();
		expect(getByText("Compare")).toBeInTheDocument();
	});

	it("should display file names when provided", () => {
		const { getByText } = render(FileSelector, {
			props: {
				leftFilePath: "/path/to/left.js",
				rightFilePath: "/path/to/right.py",
				leftFileName: "left.js",
				rightFileName: "right.py",
			},
		});

		expect(getByText("left.js")).toBeInTheDocument();
		expect(getByText("right.py")).toBeInTheDocument();
	});

	it("should disable compare button when files not selected", () => {
		const { getByText } = render(FileSelector, {
			props: {
				leftFilePath: "",
				rightFilePath: "",
			},
		});

		const compareButton = getByText("Compare");
		expect(compareButton).toBeDisabled();
	});

	it("should enable compare button when both files selected", () => {
		const { getByText } = render(FileSelector, {
			props: {
				leftFilePath: "/path/to/left.js",
				rightFilePath: "/path/to/right.js",
			},
		});

		const compareButton = getByText("Compare");
		expect(compareButton).not.toBeDisabled();
	});

	it("should show comparing state", () => {
		const { getByText } = render(FileSelector, {
			props: {
				leftFilePath: "/path/to/left.js",
				rightFilePath: "/path/to/right.js",
				isComparing: true,
			},
		});

		expect(getByText("Comparing...")).toBeInTheDocument();
	});

	it("should disable compare button when comparison completed", () => {
		const { getByText } = render(FileSelector, {
			props: {
				leftFilePath: "/path/to/left.js",
				rightFilePath: "/path/to/right.js",
				hasCompletedComparison: true,
			},
		});

		const compareButton = getByText("Compare");
		expect(compareButton).toBeDisabled();
	});

	it("should dispatch leftFileSelected event when left file selected", async () => {
		const mockPath = "/path/to/selected.js";
		vi.mocked(SelectFile).mockResolvedValue(mockPath);

		const { getByText, component } = render(FileSelector);

		const leftFileSelectedHandler = vi.fn();
		component.$on("leftFileSelected", leftFileSelectedHandler);

		const leftButton = getByText("Select left file...");
		await fireEvent.click(leftButton);

		expect(SelectFile).toHaveBeenCalled();
		expect(leftFileSelectedHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: { path: mockPath },
			}),
		);
	});

	it("should dispatch rightFileSelected event when right file selected", async () => {
		const mockPath = "/path/to/selected.py";
		vi.mocked(SelectFile).mockResolvedValue(mockPath);

		const { getByText, component } = render(FileSelector);

		const rightFileSelectedHandler = vi.fn();
		component.$on("rightFileSelected", rightFileSelectedHandler);

		const rightButton = getByText("Select right file...");
		await fireEvent.click(rightButton);

		expect(SelectFile).toHaveBeenCalled();
		expect(rightFileSelectedHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: { path: mockPath },
			}),
		);
	});

	it("should dispatch error event when file selection fails", async () => {
		const mockError = new Error("File selection failed");
		vi.mocked(SelectFile).mockRejectedValue(mockError);

		const { getByText, component } = render(FileSelector);

		const errorHandler = vi.fn();
		component.$on("error", errorHandler);

		const leftButton = getByText("Select left file...");
		await fireEvent.click(leftButton);

		expect(errorHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: { message: `Error selecting left file: ${mockError}` },
			}),
		);
	});

	it("should dispatch error event for binary file rejection", async () => {
		const mockError = new Error("binary files cannot be compared: test.bin");
		vi.mocked(SelectFile).mockRejectedValue(mockError);

		const { getByText, component } = render(FileSelector);

		const errorHandler = vi.fn();
		component.$on("error", errorHandler);

		const rightButton = getByText("Select right file...");
		await fireEvent.click(rightButton);

		expect(errorHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: { message: `Error selecting right file: ${mockError}` },
			}),
		);
	});

	it("should dispatch compare event when compare button clicked", async () => {
		const { getByText, component } = render(FileSelector, {
			props: {
				leftFilePath: "/path/to/left.js",
				rightFilePath: "/path/to/right.js",
			},
		});

		const compareHandler = vi.fn();
		component.$on("compare", compareHandler);

		const compareButton = getByText("Compare");
		await fireEvent.click(compareButton);

		expect(compareHandler).toHaveBeenCalled();
	});

	it("should apply dark mode styles", () => {
		const { container } = render(FileSelector, {
			props: {
				isDarkMode: true,
			},
		});

		// The component should render with dark mode prop
		expect(container.querySelector(".file-selectors")).toBeInTheDocument();
	});
});
