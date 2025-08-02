import { get } from "svelte/store";
import { beforeEach, describe, expect, it } from "vitest";
import type {
	DiffResult,
	HighlightedDiffResult,
	LineChunk,
} from "../types/diff";
import {
	diffChunks,
	diffNavigation,
	diffStore,
	lineNumberWidth,
} from "./diffStore";

describe("diffStore", () => {
	// Sample test data
	const sampleDiffResult: DiffResult = {
		convertValues: true,
		lines: [
			{
				type: "same",
				leftNumber: 1,
				rightNumber: 1,
				leftLine: "line1",
				rightLine: "line1",
			},
			{
				type: "removed",
				leftNumber: 2,
				rightNumber: null,
				leftLine: "removed",
				rightLine: "",
			},
			{
				type: "added",
				leftNumber: null,
				rightNumber: 2,
				leftLine: "",
				rightLine: "added",
			},
			{
				type: "modified",
				leftNumber: 3,
				rightNumber: 3,
				leftLine: "old",
				rightLine: "new",
			},
			{
				type: "same",
				leftNumber: 4,
				rightNumber: 4,
				leftLine: "line4",
				rightLine: "line4",
			},
		],
	};

	const sampleHighlightedDiff: HighlightedDiffResult = {
		lines: [
			{
				type: "same",
				leftNumber: 1,
				rightNumber: 1,
				leftLine: "line1",
				rightLine: "line1",
				leftHighlighted: "line1",
				rightHighlighted: "line1",
			},
			{
				type: "removed",
				leftNumber: 2,
				rightNumber: null,
				leftLine: "removed",
				rightLine: "",
				leftHighlighted: "<span>removed</span>",
				rightHighlighted: "",
			},
			{
				type: "added",
				leftNumber: null,
				rightNumber: 2,
				leftLine: "",
				rightLine: "added",
				leftHighlighted: "",
				rightHighlighted: "<span>added</span>",
			},
			{
				type: "modified",
				leftNumber: 3,
				rightNumber: 3,
				leftLine: "old",
				rightLine: "new",
				leftHighlighted: "<span>old</span>",
				rightHighlighted: "<span>new</span>",
			},
			{
				type: "same",
				leftNumber: 4,
				rightNumber: 4,
				leftLine: "line4",
				rightLine: "line4",
				leftHighlighted: "line4",
				rightHighlighted: "line4",
			},
		],
	};

	const sampleLineChunks: LineChunk[] = [
		{ type: "removed", startIndex: 1, endIndex: 1, lines: 1 },
		{ type: "added", startIndex: 2, endIndex: 2, lines: 1 },
		{ type: "modified", startIndex: 3, endIndex: 3, lines: 1 },
	];

	beforeEach(() => {
		// Reset store before each test
		diffStore.clear();
	});

	describe("initial state", () => {
		it("should have null diff results", () => {
			const state = get(diffStore);
			expect(state.rawDiff).toBeNull();
			expect(state.highlightedDiff).toBeNull();
		});

		it("should have -1 as current chunk index", () => {
			const state = get(diffStore);
			expect(state.currentChunkIndex).toBe(-1);
		});

		it("should have empty line chunks", () => {
			const state = get(diffStore);
			expect(state.lineChunks).toEqual([]);
		});
	});

	describe("setRawDiff", () => {
		it("should set raw diff result", () => {
			diffStore.setRawDiff(sampleDiffResult);
			const state = get(diffStore);
			expect(state.rawDiff).toEqual(sampleDiffResult);
		});

		it("should reset current chunk index when setting new diff", () => {
			diffStore.setCurrentChunkIndex(2);
			diffStore.setRawDiff(sampleDiffResult);
			const state = get(diffStore);
			expect(state.currentChunkIndex).toBe(-1);
		});

		it("should handle null diff", () => {
			diffStore.setRawDiff(sampleDiffResult);
			diffStore.setRawDiff(null);
			const state = get(diffStore);
			expect(state.rawDiff).toBeNull();
		});
	});

	describe("setHighlightedDiff", () => {
		it("should set highlighted diff result", () => {
			diffStore.setHighlightedDiff(sampleHighlightedDiff);
			const state = get(diffStore);
			expect(state.highlightedDiff).toEqual(sampleHighlightedDiff);
		});

		it("should handle null highlighted diff", () => {
			diffStore.setHighlightedDiff(sampleHighlightedDiff);
			diffStore.setHighlightedDiff(null);
			const state = get(diffStore);
			expect(state.highlightedDiff).toBeNull();
		});
	});

	describe("setCurrentChunkIndex", () => {
		it("should set current chunk index", () => {
			diffStore.setCurrentChunkIndex(3);
			const state = get(diffStore);
			expect(state.currentChunkIndex).toBe(3);
		});

		it("should allow setting to -1", () => {
			diffStore.setCurrentChunkIndex(2);
			diffStore.setCurrentChunkIndex(-1);
			const state = get(diffStore);
			expect(state.currentChunkIndex).toBe(-1);
		});
	});

	describe("setLineChunks", () => {
		it("should set line chunks", () => {
			diffStore.setLineChunks(sampleLineChunks);
			const state = get(diffStore);
			expect(state.lineChunks).toEqual(sampleLineChunks);
		});

		it("should handle empty chunks", () => {
			diffStore.setLineChunks(sampleLineChunks);
			diffStore.setLineChunks([]);
			const state = get(diffStore);
			expect(state.lineChunks).toEqual([]);
		});
	});

	describe("navigation methods", () => {
		beforeEach(() => {
			// Set up test data with separated chunks
			const highlightedDiff: HighlightedDiffResult = {
				lines: [
					{
						type: "same",
						leftNumber: 1,
						rightNumber: 1,
						leftLine: "same",
						rightLine: "same",
						leftHighlighted: "same",
						rightHighlighted: "same",
					},
					{
						type: "removed",
						leftNumber: 2,
						rightNumber: null,
						leftLine: "removed",
						rightLine: "",
						leftHighlighted: "removed",
						rightHighlighted: "",
					},
					{
						type: "same",
						leftNumber: 3,
						rightNumber: 2,
						leftLine: "same2",
						rightLine: "same2",
						leftHighlighted: "same2",
						rightHighlighted: "same2",
					},
					{
						type: "added",
						leftNumber: null,
						rightNumber: 3,
						leftLine: "",
						rightLine: "added",
						leftHighlighted: "",
						rightHighlighted: "added",
					},
					{
						type: "same",
						leftNumber: 4,
						rightNumber: 4,
						leftLine: "same3",
						rightLine: "same3",
						leftHighlighted: "same3",
						rightHighlighted: "same3",
					},
					{
						type: "modified",
						leftNumber: 5,
						rightNumber: 5,
						leftLine: "old",
						rightLine: "new",
						leftHighlighted: "old",
						rightHighlighted: "new",
					},
				],
			};
			diffStore.setHighlightedDiff(highlightedDiff);
		});

		describe("goToNextChunk", () => {
			it("should navigate to next chunk", () => {
				diffStore.setCurrentChunkIndex(0);
				const result = diffStore.goToNextChunk();
				expect(result).toBe(true);
				expect(get(diffStore).currentChunkIndex).toBe(1);
			});

			it("should return false at last chunk", () => {
				diffStore.setCurrentChunkIndex(2);
				const result = diffStore.goToNextChunk();
				expect(result).toBe(false);
				expect(get(diffStore).currentChunkIndex).toBe(2);
			});

			it("should return false with no chunks", () => {
				diffStore.clear();
				const result = diffStore.goToNextChunk();
				expect(result).toBe(false);
			});
		});

		describe("goToPreviousChunk", () => {
			it("should navigate to previous chunk", () => {
				diffStore.setCurrentChunkIndex(2);
				const result = diffStore.goToPreviousChunk();
				expect(result).toBe(true);
				expect(get(diffStore).currentChunkIndex).toBe(1);
			});

			it("should return false at first chunk", () => {
				diffStore.setCurrentChunkIndex(0);
				const result = diffStore.goToPreviousChunk();
				expect(result).toBe(false);
				expect(get(diffStore).currentChunkIndex).toBe(0);
			});

			it("should return false with no chunks", () => {
				diffStore.clear();
				const result = diffStore.goToPreviousChunk();
				expect(result).toBe(false);
			});
		});
	});

	describe("clear", () => {
		it("should reset all state", () => {
			diffStore.setRawDiff(sampleDiffResult);
			diffStore.setHighlightedDiff(sampleHighlightedDiff);
			diffStore.setCurrentChunkIndex(2);
			diffStore.setLineChunks(sampleLineChunks);

			diffStore.clear();

			const state = get(diffStore);
			expect(state.rawDiff).toBeNull();
			expect(state.highlightedDiff).toBeNull();
			expect(state.currentChunkIndex).toBe(-1);
			expect(state.lineChunks).toEqual([]);
		});
	});

	describe("getState", () => {
		it("should return current state", () => {
			diffStore.setRawDiff(sampleDiffResult);
			diffStore.setCurrentChunkIndex(1);

			const state = diffStore.getState();
			expect(state.rawDiff).toEqual(sampleDiffResult);
			expect(state.currentChunkIndex).toBe(1);
		});
	});
});

describe("derived stores", () => {
	beforeEach(() => {
		diffStore.clear();
	});

	describe("diffChunks", () => {
		it("should be empty when no highlighted diff", () => {
			expect(get(diffChunks)).toEqual([]);
		});

		it("should calculate chunks from highlighted diff", () => {
			diffStore.setHighlightedDiff({
				lines: [
					{
						type: "same",
						leftNumber: 1,
						rightNumber: 1,
						leftLine: "same",
						rightLine: "same",
						leftHighlighted: "same",
						rightHighlighted: "same",
					},
					{
						type: "removed",
						leftNumber: 2,
						rightNumber: null,
						leftLine: "removed",
						rightLine: "",
						leftHighlighted: "removed",
						rightHighlighted: "",
					},
					{
						type: "added",
						leftNumber: null,
						rightNumber: 2,
						leftLine: "",
						rightLine: "added",
						leftHighlighted: "",
						rightHighlighted: "added",
					},
				],
			});

			const chunks = get(diffChunks);
			expect(chunks).toHaveLength(1); // consecutive non-same lines are grouped
			expect(chunks[0].startIndex).toBe(1);
			expect(chunks[0].endIndex).toBe(2);
		});
	});

	describe("lineNumberWidth", () => {
		it("should calculate width from raw diff", () => {
			diffStore.setRawDiff({
				convertValues: true,
				lines: Array(100)
					.fill(null)
					.map((_, i) => ({
						type: "same",
						leftNumber: i + 1,
						rightNumber: i + 1,
						leftLine: `line ${i + 1}`,
						rightLine: `line ${i + 1}`,
					})),
			});

			const width = get(lineNumberWidth);
			expect(width).toBe("38px"); // 3 digits * 6px + 20px padding
		});

		it("should return default width when no diff", () => {
			const width = get(lineNumberWidth);
			expect(width).toBe("32px"); // default width
		});
	});

	describe("diffNavigation", () => {
		beforeEach(() => {
			const highlightedDiff: HighlightedDiffResult = {
				lines: [
					{
						type: "same",
						leftNumber: 1,
						rightNumber: 1,
						leftLine: "same",
						rightLine: "same",
						leftHighlighted: "same",
						rightHighlighted: "same",
					},
					{
						type: "removed",
						leftNumber: 2,
						rightNumber: null,
						leftLine: "removed",
						rightLine: "",
						leftHighlighted: "removed",
						rightHighlighted: "",
					},
					{
						type: "same",
						leftNumber: 3,
						rightNumber: 3,
						leftLine: "same2",
						rightLine: "same2",
						leftHighlighted: "same2",
						rightHighlighted: "same2",
					},
					{
						type: "added",
						leftNumber: null,
						rightNumber: 4,
						leftLine: "",
						rightLine: "added",
						leftHighlighted: "",
						rightHighlighted: "added",
					},
					{
						type: "same",
						leftNumber: 4,
						rightNumber: 5,
						leftLine: "same3",
						rightLine: "same3",
						leftHighlighted: "same3",
						rightHighlighted: "same3",
					},
					{
						type: "modified",
						leftNumber: 5,
						rightNumber: 6,
						leftLine: "old",
						rightLine: "new",
						leftHighlighted: "old",
						rightHighlighted: "new",
					},
				],
			};
			diffStore.setHighlightedDiff(highlightedDiff);
		});

		it("should indicate navigation state correctly", () => {
			const nav = get(diffNavigation);
			expect(nav.hasPrevDiff).toBe(false);
			expect(nav.hasNextDiff).toBe(true); // there are 3 chunks and we're at -1
			expect(nav.hasChunks).toBe(true);
			expect(nav.chunkCount).toBe(3);
		});

		it("should update when current chunk changes", () => {
			diffStore.setCurrentChunkIndex(1);
			const nav = get(diffNavigation);
			expect(nav.hasPrevDiff).toBe(true);
			expect(nav.hasNextDiff).toBe(true);
			expect(nav.isFirstChunk).toBe(false);
			expect(nav.isLastChunk).toBe(false);
			expect(nav.currentIndex).toBe(1);
		});

		it("should identify first and last chunks", () => {
			diffStore.setCurrentChunkIndex(0);
			let nav = get(diffNavigation);
			expect(nav.isFirstChunk).toBe(true);
			expect(nav.isLastChunk).toBe(false);

			diffStore.setCurrentChunkIndex(2);
			nav = get(diffNavigation);
			expect(nav.isFirstChunk).toBe(false);
			expect(nav.isLastChunk).toBe(true);
		});

		it("should provide current chunk", () => {
			diffStore.setCurrentChunkIndex(1);
			const nav = get(diffNavigation);
			expect(nav.currentChunk).toBeTruthy();
			expect(nav.currentChunk?.startIndex).toBe(3); // second chunk starts at index 3
		});
	});
});
