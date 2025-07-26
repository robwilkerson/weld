import { fireEvent, render } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom";
import type { HighlightedDiffLine, LineChunk } from "../types/diff";
import DiffPane from "./DiffPane.svelte";

// Mock the diff utilities
vi.mock("../utils/diff", () => ({
	escapeHtml: vi.fn((text: string) => text),
	getLineClass: vi.fn((type: string) => type),
}));

describe("DiffPane", () => {
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
	];

	const mockGetChunkForLine = vi.fn((index: number): LineChunk | null => {
		if (index === 1) {
			return {
				startIndex: 1,
				endIndex: 1,
				type: "removed",
				lines: 1,
			};
		}
		if (index === 2) {
			return {
				startIndex: 2,
				endIndex: 2,
				type: "added",
				lines: 1,
			};
		}
		return null;
	});

	const mockIsFirstLineOfChunk = vi.fn((index: number, chunk: LineChunk) => {
		return index === chunk.startIndex;
	});

	const mockIsLineHighlighted = vi.fn((index: number) => index === 1);
	const mockIsLineHovered = vi.fn((index: number) => index === 2);

	const defaultProps = {
		lines: mockLines,
		side: "left" as const,
		lineNumberWidth: "50px",
		getChunkForLine: mockGetChunkForLine,
		isFirstLineOfChunk: mockIsFirstLineOfChunk,
		isLineHighlighted: mockIsLineHighlighted,
		isLineHovered: mockIsLineHovered,
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should render pane with correct class", () => {
		const { container } = render(DiffPane, { props: defaultProps });
		expect(container.querySelector(".left-pane")).toBeInTheDocument();
	});

	it("should render right pane when side is right", () => {
		const { container } = render(DiffPane, {
			props: { ...defaultProps, side: "right" },
		});
		expect(container.querySelector(".right-pane")).toBeInTheDocument();
	});

	it("should render all lines", () => {
		const { container } = render(DiffPane, { props: defaultProps });
		const lines = container.querySelectorAll(".line");
		expect(lines).toHaveLength(3);
	});

	it("should display line numbers correctly", () => {
		const { container } = render(DiffPane, { props: defaultProps });
		const lineNumbers = container.querySelectorAll(".line-number");

		expect(lineNumbers[0]).toHaveTextContent("1");
		expect(lineNumbers[1]).toHaveTextContent("2");
		expect(lineNumbers[2]).toHaveTextContent("");
	});

	it("should display line content correctly", () => {
		const { container } = render(DiffPane, { props: defaultProps });
		const lineTexts = container.querySelectorAll(".line-text");

		expect(lineTexts[0]).toHaveTextContent("const a = 1;");
		expect(lineTexts[1]).toHaveTextContent("const b = 2;");
		expect(lineTexts[2]).toHaveTextContent("");
	});

	it("should dispatch scroll event", async () => {
		const { container, component } = render(DiffPane, { props: defaultProps });
		const scrollHandler = vi.fn();
		component.$on("scroll", scrollHandler);

		const pane = container.querySelector(".left-pane");
		if (pane) {
			await fireEvent.scroll(pane);
		}

		expect(scrollHandler).toHaveBeenCalled();
	});

	it("should dispatch chunkClick event for diff chunks", async () => {
		const { container, component } = render(DiffPane, { props: defaultProps });
		const clickHandler = vi.fn();
		component.$on("chunkClick", (event) => clickHandler(event.detail));

		const lines = container.querySelectorAll(".line");
		await fireEvent.click(lines[1]); // Click on removed line

		expect(clickHandler).toHaveBeenCalledWith(1);
	});

	it("should not dispatch chunkClick for same lines", async () => {
		const { container, component } = render(DiffPane, { props: defaultProps });
		const clickHandler = vi.fn();
		component.$on("chunkClick", clickHandler);

		const lines = container.querySelectorAll(".line");
		await fireEvent.click(lines[0]); // Click on same line

		expect(clickHandler).not.toHaveBeenCalled();
	});

	it("should dispatch chunkMouseEnter event", async () => {
		const { container, component } = render(DiffPane, { props: defaultProps });
		const mouseEnterHandler = vi.fn();
		component.$on("chunkMouseEnter", (event) =>
			mouseEnterHandler(event.detail),
		);

		const lines = container.querySelectorAll(".line");
		await fireEvent.mouseEnter(lines[1]);

		expect(mouseEnterHandler).toHaveBeenCalledWith(1);
	});

	it("should dispatch chunkMouseLeave event", async () => {
		const { container, component } = render(DiffPane, { props: defaultProps });
		const mouseLeaveHandler = vi.fn();
		component.$on("chunkMouseLeave", mouseLeaveHandler);

		const lines = container.querySelectorAll(".line");
		await fireEvent.mouseLeave(lines[1]);

		expect(mouseLeaveHandler).toHaveBeenCalled();
	});

	it("should apply current-diff class to highlighted lines", () => {
		const { container } = render(DiffPane, { props: defaultProps });
		const lines = container.querySelectorAll(".line");

		expect(lines[1]).toHaveClass("current-diff");
		expect(lines[0]).not.toHaveClass("current-diff");
		expect(lines[2]).not.toHaveClass("current-diff");
	});

	it("should apply chunk-hover class to hovered lines", () => {
		const { container } = render(DiffPane, { props: defaultProps });
		const lines = container.querySelectorAll(".line");

		expect(lines[2]).toHaveClass("chunk-hover");
		expect(lines[0]).not.toHaveClass("chunk-hover");
		expect(lines[1]).not.toHaveClass("chunk-hover");
	});

	it("should handle keyboard navigation on diff chunks", async () => {
		const { container, component } = render(DiffPane, { props: defaultProps });
		const clickHandler = vi.fn();
		component.$on("chunkClick", (event) => clickHandler(event.detail));

		const lines = container.querySelectorAll(".line");

		// Test Enter key
		await fireEvent.keyDown(lines[1], { key: "Enter" });
		expect(clickHandler).toHaveBeenCalledWith(1);

		// Test Space key
		clickHandler.mockClear();
		await fireEvent.keyDown(lines[2], { key: " " });
		expect(clickHandler).toHaveBeenCalledWith(2);
	});

	it("should expose getElement method", () => {
		const { component } = render(DiffPane, { props: defaultProps });
		const element = component.getElement();
		expect(element).toBeInstanceOf(HTMLElement);
		expect(element).toHaveClass("left-pane");
	});

	it("should expose setScrollTop method", () => {
		const { component } = render(DiffPane, { props: defaultProps });
		const element = component.getElement();

		component.setScrollTop(100);
		expect(element.scrollTop).toBe(100);
	});

	it("should expose setScrollLeft method", () => {
		const { component } = render(DiffPane, { props: defaultProps });
		const element = component.getElement();

		component.setScrollLeft(50);
		expect(element.scrollLeft).toBe(50);
	});
});
