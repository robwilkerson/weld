import { fireEvent, render } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { LineChunk } from "../types";
import Minimap from "./Minimap.svelte";

describe("Minimap", () => {
	const mockLineChunks: LineChunk[] = [
		{
			type: "same",
			startIndex: 0,
			endIndex: 4,
			leftStart: 1,
			rightStart: 1,
			lines: 5,
		},
		{
			type: "added",
			startIndex: 5,
			endIndex: 7,
			leftStart: null,
			rightStart: 6,
			lines: 3,
		},
		{
			type: "removed",
			startIndex: 8,
			endIndex: 10,
			leftStart: 6,
			rightStart: null,
			lines: 3,
		},
		{
			type: "modified",
			startIndex: 11,
			endIndex: 13,
			leftStart: 9,
			rightStart: 9,
			lines: 3,
		},
	];

	const mockDiffChunks = [
		{ startIndex: 5, endIndex: 7 },
		{ startIndex: 8, endIndex: 10 },
		{ startIndex: 11, endIndex: 13 },
	];

	it("should not render when show is false", () => {
		const { container } = render(Minimap, {
			show: false,
			lineChunks: mockLineChunks,
			totalLines: 20,
		});

		expect(container.querySelector(".minimap-pane")).not.toBeInTheDocument();
	});

	it("should not render when totalLines is 0", () => {
		const { container } = render(Minimap, {
			show: true,
			lineChunks: mockLineChunks,
			totalLines: 0,
		});

		expect(container.querySelector(".minimap-pane")).not.toBeInTheDocument();
	});

	it("should render minimap when show is true and totalLines > 0", () => {
		const { container } = render(Minimap, {
			show: true,
			lineChunks: mockLineChunks,
			totalLines: 20,
		});

		expect(container.querySelector(".minimap-pane")).toBeInTheDocument();
		expect(container.querySelector(".minimap")).toBeInTheDocument();
	});

	it("should render diff chunks except 'same' type", () => {
		const { container } = render(Minimap, {
			show: true,
			lineChunks: mockLineChunks,
			totalLines: 20,
		});

		const chunks = container.querySelectorAll(".minimap-chunk");
		expect(chunks).toHaveLength(3); // added, removed, modified (not same)

		expect(container.querySelector(".minimap-added")).toBeInTheDocument();
		expect(container.querySelector(".minimap-removed")).toBeInTheDocument();
		expect(container.querySelector(".minimap-modified")).toBeInTheDocument();
		expect(container.querySelector(".minimap-same")).not.toBeInTheDocument();
	});

	it("should highlight current diff chunk", () => {
		const { container } = render(Minimap, {
			show: true,
			lineChunks: mockLineChunks,
			totalLines: 20,
			currentDiffChunkIndex: 1,
			diffChunks: mockDiffChunks,
		});

		const currentChunk = container.querySelector(".minimap-current");
		expect(currentChunk).toBeInTheDocument();
		expect(currentChunk).toHaveClass("minimap-removed");
	});

	it("should render viewport indicator", () => {
		const { container } = render(Minimap, {
			show: true,
			lineChunks: mockLineChunks,
			totalLines: 20,
			viewportTop: 25,
			viewportHeight: 50,
		});

		const viewport = container.querySelector(".minimap-viewport");
		expect(viewport).toBeInTheDocument();
		expect(viewport).toHaveStyle("top: 25%; height: 50%;");
	});

	it("should dispatch minimapClick event when minimap clicked", async () => {
		const { container, component } = render(Minimap, {
			show: true,
			lineChunks: mockLineChunks,
			totalLines: 20,
		});

		const mockHandler = vi.fn();
		component.$on("minimapClick", mockHandler);

		const minimap = container.querySelector(".minimap");
		expect(minimap).toBeTruthy();
		if (minimap) await fireEvent.click(minimap);

		expect(mockHandler).toHaveBeenCalledTimes(1);
		expect(mockHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: expect.objectContaining({
					event: expect.any(MouseEvent),
				}),
			}),
		);
	});

	it("should dispatch viewportMouseDown event when viewport dragged", async () => {
		const { container, component } = render(Minimap, {
			show: true,
			lineChunks: mockLineChunks,
			totalLines: 20,
			viewportTop: 25,
			viewportHeight: 50,
		});

		const mockHandler = vi.fn();
		component.$on("viewportMouseDown", mockHandler);

		const viewport = container.querySelector(".minimap-viewport");
		expect(viewport).toBeTruthy();
		if (viewport) await fireEvent.mouseDown(viewport);

		expect(mockHandler).toHaveBeenCalledTimes(1);
		expect(mockHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: expect.objectContaining({
					event: expect.any(MouseEvent),
				}),
			}),
		);
	});

	it("should set correct styles for chunks based on position", () => {
		const { container } = render(Minimap, {
			show: true,
			lineChunks: mockLineChunks,
			totalLines: 20,
		});

		const addedChunk = container.querySelector(".minimap-added");
		expect(addedChunk).toHaveStyle("top: 25%; height: 15%;"); // 5/20 * 100% = 25%, 3/20 * 100% = 15%
	});

	it("should set data attributes on chunks", () => {
		const { container } = render(Minimap, {
			show: true,
			lineChunks: mockLineChunks,
			totalLines: 20,
		});

		const addedChunk = container.querySelector(".minimap-added");
		expect(addedChunk).toHaveAttribute("data-chunk-start", "5");
		expect(addedChunk).toHaveAttribute("data-chunk-lines", "3");
	});
});
