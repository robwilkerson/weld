import { describe, expect, it, vi } from "vitest";
import type { HighlightedDiffLine, HighlightedDiffResult } from "../types/diff";
import type { DiffChunk } from "../utils/diffChunks";

// Mock UpdateCopyMenuItems
const mockUpdateCopyMenuItems = vi.fn();

// Extract the logic from App.svelte's reactive statement
function updateCopyMenuBasedOnSelection(
	currentChunkIndex: number,
	diffChunks: DiffChunk[],
	highlightedDiff: HighlightedDiffResult | null,
	updateCopyMenuItems: (type: string) => void,
) {
	if (
		currentChunkIndex >= 0 &&
		diffChunks &&
		diffChunks[currentChunkIndex] &&
		highlightedDiff
	) {
		const currentChunk = diffChunks[currentChunkIndex];
		const currentLine = highlightedDiff.lines[currentChunk.startIndex];
		if (currentLine) {
			updateCopyMenuItems(currentLine.type);
		}
	} else {
		// No chunk selected, disable both menu items
		updateCopyMenuItems("");
	}
}

describe("Copy Menu Logic", () => {
	beforeEach(() => {
		mockUpdateCopyMenuItems.mockClear();
	});

	it("should enable menu items with correct type when a diff is selected", () => {
		const highlightedLines: HighlightedDiffLine[] = [
			{
				type: "removed",
				leftNumber: 1,
				rightNumber: null,
				leftLine: "old",
				rightLine: "",
				leftHighlightedLine: "old",
				rightHighlightedLine: "",
			},
			{
				type: "added",
				leftNumber: null,
				rightNumber: 1,
				leftLine: "",
				rightLine: "new",
				leftHighlightedLine: "",
				rightHighlightedLine: "new",
			},
		];

		const chunks: DiffChunk[] = [
			{ startIndex: 0, endIndex: 0 }, // removed
			{ startIndex: 1, endIndex: 1 }, // added
		];

		const highlightedDiff: HighlightedDiffResult = {
			lines: highlightedLines,
		};

		// Test selecting first chunk (removed)
		updateCopyMenuBasedOnSelection(
			0,
			chunks,
			highlightedDiff,
			mockUpdateCopyMenuItems,
		);
		expect(mockUpdateCopyMenuItems).toHaveBeenCalledWith("removed");

		// Test selecting second chunk (added)
		updateCopyMenuBasedOnSelection(
			1,
			chunks,
			highlightedDiff,
			mockUpdateCopyMenuItems,
		);
		expect(mockUpdateCopyMenuItems).toHaveBeenCalledWith("added");
	});

	it("should enable menu items for modified lines", () => {
		const highlightedLines: HighlightedDiffLine[] = [
			{
				type: "modified",
				leftNumber: 1,
				rightNumber: 1,
				leftLine: "original",
				rightLine: "changed",
				leftHighlightedLine: "original",
				rightHighlightedLine: "changed",
			},
		];

		const chunks: DiffChunk[] = [{ startIndex: 0, endIndex: 0 }];

		const highlightedDiff: HighlightedDiffResult = {
			lines: highlightedLines,
		};

		updateCopyMenuBasedOnSelection(
			0,
			chunks,
			highlightedDiff,
			mockUpdateCopyMenuItems,
		);
		expect(mockUpdateCopyMenuItems).toHaveBeenCalledWith("modified");
	});

	it("should disable menu items when no chunk is selected", () => {
		const highlightedLines: HighlightedDiffLine[] = [
			{
				type: "removed",
				leftNumber: 1,
				rightNumber: null,
				leftLine: "old",
				rightLine: "",
				leftHighlightedLine: "old",
				rightHighlightedLine: "",
			},
		];

		const chunks: DiffChunk[] = [{ startIndex: 0, endIndex: 0 }];

		const highlightedDiff: HighlightedDiffResult = {
			lines: highlightedLines,
		};

		// No chunk selected (index -1)
		updateCopyMenuBasedOnSelection(
			-1,
			chunks,
			highlightedDiff,
			mockUpdateCopyMenuItems,
		);
		expect(mockUpdateCopyMenuItems).toHaveBeenCalledWith("");
	});

	it("should disable menu items when chunks array is empty", () => {
		const highlightedDiff: HighlightedDiffResult = {
			lines: [],
		};

		updateCopyMenuBasedOnSelection(
			0,
			[],
			highlightedDiff,
			mockUpdateCopyMenuItems,
		);
		expect(mockUpdateCopyMenuItems).toHaveBeenCalledWith("");
	});

	it("should disable menu items when highlighted diff is null", () => {
		const chunks: DiffChunk[] = [{ startIndex: 0, endIndex: 0 }];

		updateCopyMenuBasedOnSelection(0, chunks, null, mockUpdateCopyMenuItems);
		expect(mockUpdateCopyMenuItems).toHaveBeenCalledWith("");
	});

	it("should handle edge case when chunk index is out of bounds", () => {
		const highlightedLines: HighlightedDiffLine[] = [
			{
				type: "removed",
				leftNumber: 1,
				rightNumber: null,
				leftLine: "old",
				rightLine: "",
				leftHighlightedLine: "old",
				rightHighlightedLine: "",
			},
		];

		const chunks: DiffChunk[] = [{ startIndex: 0, endIndex: 0 }];

		const highlightedDiff: HighlightedDiffResult = {
			lines: highlightedLines,
		};

		// Index out of bounds
		updateCopyMenuBasedOnSelection(
			5,
			chunks,
			highlightedDiff,
			mockUpdateCopyMenuItems,
		);
		expect(mockUpdateCopyMenuItems).toHaveBeenCalledWith("");
	});

	it("should handle consecutive diff types correctly", () => {
		const highlightedLines: HighlightedDiffLine[] = [
			{
				type: "removed",
				leftNumber: 1,
				rightNumber: null,
				leftLine: "line1",
				rightLine: "",
				leftHighlightedLine: "line1",
				rightHighlightedLine: "",
			},
			{
				type: "removed",
				leftNumber: 2,
				rightNumber: null,
				leftLine: "line2",
				rightLine: "",
				leftHighlightedLine: "line2",
				rightHighlightedLine: "",
			},
			{
				type: "added",
				leftNumber: null,
				rightNumber: 1,
				leftLine: "",
				rightLine: "new1",
				leftHighlightedLine: "",
				rightHighlightedLine: "new1",
			},
		];

		// Chunks group consecutive lines of same type
		const chunks: DiffChunk[] = [
			{ startIndex: 0, endIndex: 1 }, // both removed lines
			{ startIndex: 2, endIndex: 2 }, // added line
		];

		const highlightedDiff: HighlightedDiffResult = {
			lines: highlightedLines,
		};

		// First chunk should use type from first line of chunk
		updateCopyMenuBasedOnSelection(
			0,
			chunks,
			highlightedDiff,
			mockUpdateCopyMenuItems,
		);
		expect(mockUpdateCopyMenuItems).toHaveBeenCalledWith("removed");

		// Second chunk
		updateCopyMenuBasedOnSelection(
			1,
			chunks,
			highlightedDiff,
			mockUpdateCopyMenuItems,
		);
		expect(mockUpdateCopyMenuItems).toHaveBeenCalledWith("added");
	});

	it("should skip 'same' type lines when calculating menu state", () => {
		const highlightedLines: HighlightedDiffLine[] = [
			{
				type: "same",
				leftNumber: 1,
				rightNumber: 1,
				leftLine: "unchanged",
				rightLine: "unchanged",
				leftHighlightedLine: "unchanged",
				rightHighlightedLine: "unchanged",
			},
			{
				type: "modified",
				leftNumber: 2,
				rightNumber: 2,
				leftLine: "old",
				rightLine: "new",
				leftHighlightedLine: "old",
				rightHighlightedLine: "new",
			},
		];

		// Only the modified line creates a chunk
		const chunks: DiffChunk[] = [{ startIndex: 1, endIndex: 1 }];

		const highlightedDiff: HighlightedDiffResult = {
			lines: highlightedLines,
		};

		updateCopyMenuBasedOnSelection(
			0,
			chunks,
			highlightedDiff,
			mockUpdateCopyMenuItems,
		);
		expect(mockUpdateCopyMenuItems).toHaveBeenCalledWith("modified");
	});
});
