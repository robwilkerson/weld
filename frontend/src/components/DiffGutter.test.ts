import { fireEvent, render } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom";
import DiffGutter from "./DiffGutter.svelte";
import type { HighlightedDiffLine, LineChunk } from "../types/diff";

describe("DiffGutter", () => {
	const mockLines: HighlightedDiffLine[] = [
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
		{
			type: "modified",
			leftNumber: 3,
			rightNumber: 3,
			leftLine: "const d = 4;",
			rightLine: "const d = 5;",
			highlightedLeft: "const d = 4;",
			highlightedRight: "const d = 5;",
		},
	];

	const mockDiffChunks: LineChunk[] = [
		{
			startIndex: 1,
			endIndex: 1,
			type: "removed",
			lines: 1,
		},
		{
			startIndex: 2,
			endIndex: 2,
			type: "added",
			lines: 1,
		},
		{
			startIndex: 3,
			endIndex: 3,
			type: "modified",
			lines: 1,
		},
	];

	const mockGetChunkForLine = vi.fn((index: number): LineChunk | null => {
		return mockDiffChunks.find(
			chunk => index >= chunk.startIndex && index <= chunk.endIndex
		) || null;
	});

	const mockIsFirstLineOfChunk = vi.fn((index: number, chunk: LineChunk) => {
		return index === chunk.startIndex;
	});

	const mockIsLineHighlighted = vi.fn((index: number) => index === 1);
	const mockIsFirstOfConsecutiveModified = vi.fn((index: number) => index === 3);

	const defaultProps = {
		lines: mockLines,
		currentDiffChunkIndex: 0,
		diffChunks: mockDiffChunks,
		getChunkForLine: mockGetChunkForLine,
		isFirstLineOfChunk: mockIsFirstLineOfChunk,
		isLineHighlighted: mockIsLineHighlighted,
		isFirstOfConsecutiveModified: mockIsFirstOfConsecutiveModified,
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should render gutter element", () => {
		const { container } = render(DiffGutter, { props: defaultProps });
		expect(container.querySelector(".center-gutter")).toBeInTheDocument();
	});

	it("should render gutter lines for each diff line", () => {
		const { container } = render(DiffGutter, { props: defaultProps });
		const gutterLines = container.querySelectorAll(".gutter-line");
		expect(gutterLines).toHaveLength(4);
	});

	it("should show current diff indicator for highlighted line", () => {
		const { container } = render(DiffGutter, { props: defaultProps });
		const currentDiffIndicator = container.querySelector(".current-diff-indicator");
		expect(currentDiffIndicator).toBeInTheDocument();
		expect(currentDiffIndicator).toHaveAttribute("title", "Current diff");
	});

	it("should render chunk arrows for removed lines", () => {
		const { container } = render(DiffGutter, { props: defaultProps });
		const gutterLines = container.querySelectorAll(".gutter-line");
		const removedLineButtons = gutterLines[1].querySelectorAll("button");
		
		expect(removedLineButtons).toHaveLength(2);
		expect(removedLineButtons[0]).toHaveClass("left-side-arrow");
		expect(removedLineButtons[0]).toHaveTextContent("→");
		expect(removedLineButtons[1]).toHaveClass("right-side-arrow");
		expect(removedLineButtons[1]).toHaveTextContent("←");
	});

	it("should render chunk arrows for added lines", () => {
		const { container } = render(DiffGutter, { props: defaultProps });
		const gutterLines = container.querySelectorAll(".gutter-line");
		const addedLineButtons = gutterLines[2].querySelectorAll("button");
		
		expect(addedLineButtons).toHaveLength(2);
		expect(addedLineButtons[0]).toHaveClass("left-side-arrow");
		expect(addedLineButtons[0]).toHaveTextContent("→");
		expect(addedLineButtons[1]).toHaveClass("right-side-arrow");
		expect(addedLineButtons[1]).toHaveTextContent("←");
	});

	it("should render chunk arrows for modified lines", () => {
		const { container } = render(DiffGutter, { props: defaultProps });
		const gutterLines = container.querySelectorAll(".gutter-line");
		const modifiedLineButtons = gutterLines[3].querySelectorAll("button");
		
		expect(modifiedLineButtons).toHaveLength(2);
		expect(modifiedLineButtons[0]).toHaveClass("modified-arrow");
		expect(modifiedLineButtons[1]).toHaveClass("modified-arrow");
	});

	it("should dispatch copyChunkToRight event for removed chunk", async () => {
		const { container, component } = render(DiffGutter, { props: defaultProps });
		const copyHandler = vi.fn();
		component.$on("copyChunkToRight", (event) => copyHandler(event.detail));

		const gutterLines = container.querySelectorAll(".gutter-line");
		const leftArrow = gutterLines[1].querySelector(".left-side-arrow");
		
		if (leftArrow) {
			await fireEvent.click(leftArrow);
		}

		expect(copyHandler).toHaveBeenCalledWith(mockDiffChunks[0]);
	});

	it("should dispatch deleteChunkFromLeft event for removed chunk", async () => {
		const { container, component } = render(DiffGutter, { props: defaultProps });
		const deleteHandler = vi.fn();
		component.$on("deleteChunkFromLeft", (event) => deleteHandler(event.detail));

		const gutterLines = container.querySelectorAll(".gutter-line");
		const rightArrow = gutterLines[1].querySelector(".right-side-arrow");
		
		if (rightArrow) {
			await fireEvent.click(rightArrow);
		}

		expect(deleteHandler).toHaveBeenCalledWith(mockDiffChunks[0]);
	});

	it("should dispatch copyChunkToLeft event for added chunk", async () => {
		const { container, component } = render(DiffGutter, { props: defaultProps });
		const copyHandler = vi.fn();
		component.$on("copyChunkToLeft", (event) => copyHandler(event.detail));

		const gutterLines = container.querySelectorAll(".gutter-line");
		const rightArrow = gutterLines[2].querySelector(".right-side-arrow");
		
		if (rightArrow) {
			await fireEvent.click(rightArrow);
		}

		expect(copyHandler).toHaveBeenCalledWith(mockDiffChunks[1]);
	});

	it("should dispatch deleteChunkFromRight event for added chunk", async () => {
		const { container, component } = render(DiffGutter, { props: defaultProps });
		const deleteHandler = vi.fn();
		component.$on("deleteChunkFromRight", (event) => deleteHandler(event.detail));

		const gutterLines = container.querySelectorAll(".gutter-line");
		const leftArrow = gutterLines[2].querySelector(".left-side-arrow");
		
		if (leftArrow) {
			await fireEvent.click(leftArrow);
		}

		expect(deleteHandler).toHaveBeenCalledWith(mockDiffChunks[1]);
	});

	it("should dispatch copyModifiedChunkToRight event for modified chunk", async () => {
		const { container, component } = render(DiffGutter, { props: defaultProps });
		const copyHandler = vi.fn();
		component.$on("copyModifiedChunkToRight", (event) => copyHandler(event.detail));

		const gutterLines = container.querySelectorAll(".gutter-line");
		const leftArrow = gutterLines[3].querySelector(".left-side-arrow");
		
		if (leftArrow) {
			await fireEvent.click(leftArrow);
		}

		expect(copyHandler).toHaveBeenCalledWith(mockDiffChunks[2]);
	});

	it("should dispatch copyModifiedChunkToLeft event for modified chunk", async () => {
		const { container, component } = render(DiffGutter, { props: defaultProps });
		const copyHandler = vi.fn();
		component.$on("copyModifiedChunkToLeft", (event) => copyHandler(event.detail));

		const gutterLines = container.querySelectorAll(".gutter-line");
		const rightArrow = gutterLines[3].querySelector(".right-side-arrow");
		
		if (rightArrow) {
			await fireEvent.click(rightArrow);
		}

		expect(copyHandler).toHaveBeenCalledWith(mockDiffChunks[2]);
	});

	it("should dispatch scroll event", async () => {
		const { container, component } = render(DiffGutter, { props: defaultProps });
		const scrollHandler = vi.fn();
		component.$on("scroll", scrollHandler);

		const gutter = container.querySelector(".center-gutter");
		if (gutter) {
			await fireEvent.scroll(gutter);
		}

		expect(scrollHandler).toHaveBeenCalled();
	});

	it("should apply chunk-start and chunk-end classes", () => {
		const { container } = render(DiffGutter, { props: defaultProps });
		const gutterLines = container.querySelectorAll(".gutter-line");
		
		expect(gutterLines[1]).toHaveClass("chunk-start");
		expect(gutterLines[1]).toHaveClass("chunk-end");
		expect(gutterLines[2]).toHaveClass("chunk-start");
		expect(gutterLines[2]).toHaveClass("chunk-end");
	});

	it("should expose getElement method", () => {
		const { component } = render(DiffGutter, { props: defaultProps });
		const element = component.getElement();
		expect(element).toBeInstanceOf(HTMLElement);
		expect(element).toHaveClass("center-gutter");
	});

	it("should expose setScrollTop method", () => {
		const { component } = render(DiffGutter, { props: defaultProps });
		const element = component.getElement();
		
		component.setScrollTop(100);
		expect(element.scrollTop).toBe(100);
	});
});