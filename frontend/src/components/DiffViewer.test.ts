import { fireEvent, render } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom";
import type { DiffViewerProps, HighlightedDiffLine } from "../types/diff";
import DiffViewer from "./DiffViewer.svelte";

// Mock the utilities
vi.mock("../utils/diff", () => ({
	getDisplayPath: vi.fn((leftPath, rightPath, isLeft) => {
		const path = isLeft ? leftPath : rightPath;
		return path.split("/").pop() || path;
	}),
	escapeHtml: vi.fn((text: string) => text),
	getLineClass: vi.fn((type: string) => type),
}));

vi.mock("../utils/scrollSync", () => ({
	calculateScrollToCenterLine: vi.fn(
		(lineIndex, lineHeight, viewportHeight) => {
			return lineIndex * lineHeight - viewportHeight / 2;
		},
	),
}));

describe("DiffViewer", () => {
	const mockDiffResult: DiffViewerProps["diffResult"] = {
		original_lines: 3,
		modified_lines: 3,
		lines: [
			{
				type: "same",
				leftNumber: 1,
				rightNumber: 1,
				leftLine: "const a = 1;",
				rightLine: "const a = 1;",
				highlightedLeft: "const a = 1;",
				highlightedRight: "const a = 1;",
			},
			{
				type: "removed",
				leftNumber: 2,
				rightNumber: null,
				leftLine: "const b = 2;",
				rightLine: "",
				highlightedLeft: "const b = 2;",
				highlightedRight: "",
			},
			{
				type: "added",
				leftNumber: null,
				rightNumber: 2,
				leftLine: "",
				rightLine: "const c = 3;",
				highlightedLeft: "",
				highlightedRight: "const c = 3;",
			},
		] as HighlightedDiffLine[],
	};

	const defaultProps: DiffViewerProps = {
		leftFilePath: "/path/to/left.js",
		rightFilePath: "/path/to/right.js",
		diffResult: mockDiffResult,
		hasUnsavedLeftChanges: false,
		hasUnsavedRightChanges: false,
		currentDiffChunkIndex: -1,
		hoveredChunkIndex: -1,
		showMinimap: true,
		isDarkMode: false,
		isComparing: false,
		hasCompletedComparison: true,
		areFilesIdentical: false,
		isSameFile: false,
		lineNumberWidth: "50px",
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should render diff viewer", () => {
		const { container } = render(DiffViewer, { props: defaultProps });
		expect(container.querySelector(".diff-viewer")).toBeInTheDocument();
	});

	it("should show empty state when no files selected", () => {
		const { getByText } = render(DiffViewer, {
			props: {
				...defaultProps,
				leftFilePath: "",
				rightFilePath: "",
				diffResult: null,
				hasCompletedComparison: false,
			},
		});
		expect(
			getByText("Select two files to compare their differences"),
		).toBeInTheDocument();
	});

	it("should show empty state when files selected but not compared", () => {
		const { getByText } = render(DiffViewer, {
			props: {
				...defaultProps,
				diffResult: null,
				hasCompletedComparison: false,
			},
		});
		expect(
			getByText(
				'Files selected. Click "Compare Files" button above to see differences.',
			),
		).toBeInTheDocument();
	});

	it("should show comparing state", () => {
		const { container } = render(DiffViewer, {
			props: {
				...defaultProps,
				isComparing: true,
			},
		});
		const viewer = container.querySelector(".diff-viewer");
		expect(viewer).toHaveClass("comparing");
	});

	it("should show identical files banner", () => {
		const { getByText } = render(DiffViewer, {
			props: {
				...defaultProps,
				areFilesIdentical: true,
			},
		});
		expect(getByText("Files are identical")).toBeInTheDocument();
	});

	it("should show same file banner", () => {
		const { getByText } = render(DiffViewer, {
			props: {
				...defaultProps,
				isSameFile: true,
			},
		});
		expect(getByText(/is being compared to itself/)).toBeInTheDocument();
	});

	it("should render all sub-components", () => {
		const { container } = render(DiffViewer, { props: defaultProps });

		// Check for DiffHeader
		expect(container.querySelector(".file-header")).toBeInTheDocument();

		// Check for DiffPanes
		expect(container.querySelector(".left-pane")).toBeInTheDocument();
		expect(container.querySelector(".right-pane")).toBeInTheDocument();

		// Check for DiffGutter
		expect(container.querySelector(".center-gutter")).toBeInTheDocument();

		// Check for Minimap
		expect(container.querySelector(".minimap")).toBeInTheDocument();
	});

	it("should hide minimap when showMinimap is false", () => {
		const { container } = render(DiffViewer, {
			props: {
				...defaultProps,
				showMinimap: false,
			},
		});
		expect(container.querySelector(".minimap")).not.toBeInTheDocument();
	});

	it("should dispatch saveLeft event", async () => {
		const { getAllByRole, component } = render(DiffViewer, {
			props: {
				...defaultProps,
				hasUnsavedLeftChanges: true,
			},
		});

		const saveHandler = vi.fn();
		component.$on("saveLeft", saveHandler);

		const saveButtons = getAllByRole("button").filter(
			(btn) => btn.title === "Save changes",
		);
		await fireEvent.click(saveButtons[0]);

		expect(saveHandler).toHaveBeenCalled();
	});

	it("should dispatch saveRight event", async () => {
		const { getAllByRole, component } = render(DiffViewer, {
			props: {
				...defaultProps,
				hasUnsavedRightChanges: true,
			},
		});

		const saveHandler = vi.fn();
		component.$on("saveRight", saveHandler);

		const saveButtons = getAllByRole("button").filter(
			(btn) => btn.title === "Save changes",
		);
		await fireEvent.click(saveButtons[1]);

		expect(saveHandler).toHaveBeenCalled();
	});

	it("should dispatch chunkClick event", async () => {
		const { container, component } = render(DiffViewer, {
			props: defaultProps,
		});

		const clickHandler = vi.fn();
		component.$on("chunkClick", (event) => clickHandler(event.detail));

		// Click on a removed line
		const lines = container.querySelectorAll(".left-pane .line");
		await fireEvent.click(lines[1]);

		expect(clickHandler).toHaveBeenCalledWith({
			chunkIndex: 0,
			lineIndex: 1,
		});
	});

	it("should dispatch copy events from gutter", async () => {
		const { container, component } = render(DiffViewer, {
			props: defaultProps,
		});

		const copyToRightHandler = vi.fn();
		component.$on("copyChunkToRight", (event) =>
			copyToRightHandler(event.detail),
		);

		// Find and click the copy to right arrow for removed chunk
		const gutterLines = container.querySelectorAll(".gutter-line");
		const copyButton = gutterLines[1].querySelector(".left-side-arrow");

		if (copyButton) {
			await fireEvent.click(copyButton);
		}

		expect(copyToRightHandler).toHaveBeenCalled();
	});

	it("should handle chunk hover", async () => {
		const { container, component } = render(DiffViewer, {
			props: defaultProps,
		});

		const hoverHandler = vi.fn();
		const leaveHandler = vi.fn();
		component.$on("chunkHover", (event) => hoverHandler(event.detail));
		component.$on("chunkLeave", leaveHandler);

		const lines = container.querySelectorAll(".left-pane .line");

		await fireEvent.mouseEnter(lines[1]);
		expect(hoverHandler).toHaveBeenCalledWith(1);

		await fireEvent.mouseLeave(lines[1]);
		expect(leaveHandler).toHaveBeenCalled();
	});

	it("should handle minimap click", async () => {
		const { container, component } = render(DiffViewer, {
			props: defaultProps,
		});

		const minimapClickHandler = vi.fn();
		component.$on("minimapClick", (event) => minimapClickHandler(event.detail));

		const minimap = container.querySelector(".minimap");
		if (minimap) {
			await fireEvent.click(minimap);
		}

		expect(minimapClickHandler).toHaveBeenCalled();
	});

	it("should expose scrollToLine method", async () => {
		const { component } = render(DiffViewer, { props: defaultProps });

		// Since the component refs are not exposed directly, we'll verify the method exists
		expect(typeof component.scrollToLine).toBe("function");

		// We can't easily test the internal implementation without
		// access to the component refs, so we'll just ensure
		// the method can be called without errors
		expect(() => component.scrollToLine(1)).not.toThrow();
	});

	it("should highlight current diff chunk", () => {
		const { container } = render(DiffViewer, {
			props: {
				...defaultProps,
				currentDiffChunkIndex: 0,
			},
		});

		const lines = container.querySelectorAll(".left-pane .line");
		expect(lines[1]).toHaveClass("current-diff");
	});

	it("should apply hover class to hovered chunk", () => {
		const { container } = render(DiffViewer, {
			props: {
				...defaultProps,
				hoveredChunkIndex: 1,
			},
		});

		const lines = container.querySelectorAll(".left-pane .line");
		expect(lines[2]).toHaveClass("chunk-hover");
	});
});
