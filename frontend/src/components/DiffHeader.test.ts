import { fireEvent, render } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom";
import DiffHeader from "./DiffHeader.svelte";

// Mock the diff utilities
vi.mock("../utils/diff", () => ({
	getDisplayPath: vi.fn((leftPath, rightPath, isLeft) => {
		const path = isLeft ? leftPath : rightPath;
		return path.split("/").pop() || path;
	}),
}));

describe("DiffHeader", () => {
	const defaultProps = {
		leftFilePath: "/path/to/left.js",
		rightFilePath: "/path/to/right.js",
		hasUnsavedLeftChanges: false,
		hasUnsavedRightChanges: false,
		isFirstLineDiff: false,
		lineNumberWidth: "50px",
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should render file paths", () => {
		const { getByText } = render(DiffHeader, { props: defaultProps });

		expect(getByText("left.js")).toBeInTheDocument();
		expect(getByText("right.js")).toBeInTheDocument();
	});

	it("should disable save buttons when no unsaved changes", () => {
		const { getAllByRole } = render(DiffHeader, { props: defaultProps });

		const buttons = getAllByRole("button");
		expect(buttons[0]).toBeDisabled();
		expect(buttons[1]).toBeDisabled();
	});

	it("should enable left save button when has unsaved left changes", () => {
		const { getAllByRole } = render(DiffHeader, {
			props: {
				...defaultProps,
				hasUnsavedLeftChanges: true,
			},
		});

		const buttons = getAllByRole("button");
		expect(buttons[0]).not.toBeDisabled();
		expect(buttons[1]).toBeDisabled();
	});

	it("should enable right save button when has unsaved right changes", () => {
		const { getAllByRole } = render(DiffHeader, {
			props: {
				...defaultProps,
				hasUnsavedRightChanges: true,
			},
		});

		const buttons = getAllByRole("button");
		expect(buttons[0]).toBeDisabled();
		expect(buttons[1]).not.toBeDisabled();
	});

	it("should dispatch saveLeft event when left save button clicked", async () => {
		const { getAllByRole, component } = render(DiffHeader, {
			props: {
				...defaultProps,
				hasUnsavedLeftChanges: true,
			},
		});

		const saveLeftHandler = vi.fn();
		component.$on("saveLeft", saveLeftHandler);

		const buttons = getAllByRole("button");
		await fireEvent.click(buttons[0]);

		expect(saveLeftHandler).toHaveBeenCalled();
	});

	it("should dispatch saveRight event when right save button clicked", async () => {
		const { getAllByRole, component } = render(DiffHeader, {
			props: {
				...defaultProps,
				hasUnsavedRightChanges: true,
			},
		});

		const saveRightHandler = vi.fn();
		component.$on("saveRight", saveRightHandler);

		const buttons = getAllByRole("button");
		await fireEvent.click(buttons[1]);

		expect(saveRightHandler).toHaveBeenCalled();
	});

	it("should apply first-line-diff class when isFirstLineDiff is true", () => {
		const { container } = render(DiffHeader, {
			props: {
				...defaultProps,
				isFirstLineDiff: true,
			},
		});

		const header = container.querySelector(".file-header");
		expect(header).toHaveClass("first-line-diff");
	});

	it("should set line number width CSS variable", () => {
		const { container } = render(DiffHeader, {
			props: {
				...defaultProps,
				lineNumberWidth: "75px",
			},
		});

		const header = container.querySelector(".file-header");
		expect(header).toHaveStyle("--line-number-width: 75px");
	});

	it("should have save button tooltips", () => {
		const { getAllByRole } = render(DiffHeader, { props: defaultProps });

		const buttons = getAllByRole("button");
		expect(buttons[0]).toHaveAttribute("title", "Save changes");
		expect(buttons[1]).toHaveAttribute("title", "Save changes");
	});
});
