import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HighlightedDiffLine } from "../types/diff";
import { diffChunks, diffStore } from "./diffStore";
import { navigationState, navigationStore } from "./navigationStore";

// Mock the Wails API
vi.mock("../../wailsjs/go/backend/App.js", () => ({
	UpdateDiffNavigationMenuItems: vi.fn(),
}));

describe("navigationStore", () => {
	let mockScrollToLine: ReturnType<typeof vi.fn>;
	let mockPlayInvalidSound: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
		diffStore.clear();
		mockScrollToLine = vi.fn();
		mockPlayInvalidSound = vi.fn();
		navigationStore.setCallbacks({
			scrollToLine: mockScrollToLine,
			playInvalidSound: mockPlayInvalidSound,
		});
	});

	// Helper to set up diff with chunks
	function setupDiffWithChunks(lineCount: number) {
		const lines: HighlightedDiffLine[] = [];
		// Add some same lines
		for (let i = 0; i < 5; i++) {
			lines.push({
				type: "same",
				leftLine: `line ${i}`,
				rightLine: `line ${i}`,
				leftNumber: i + 1,
				rightNumber: i + 1,
				leftLineHighlighted: `line ${i}`,
				rightLineHighlighted: `line ${i}`,
			});
		}
		// Add a removed chunk
		for (let i = 5; i < 8; i++) {
			lines.push({
				type: "removed",
				leftLine: `removed ${i}`,
				rightLine: "",
				leftNumber: i + 1,
				rightNumber: null,
				leftLineHighlighted: `removed ${i}`,
				rightLineHighlighted: "",
			});
		}
		// Add more same lines
		for (let i = 8; i < 12; i++) {
			lines.push({
				type: "same",
				leftLine: `line ${i}`,
				rightLine: `line ${i}`,
				leftNumber: i + 1,
				rightNumber: i - 2,
				leftLineHighlighted: `line ${i}`,
				rightLineHighlighted: `line ${i}`,
			});
		}
		// Add an added chunk
		for (let i = 12; i < 15; i++) {
			lines.push({
				type: "added",
				leftLine: "",
				rightLine: `added ${i}`,
				leftNumber: null,
				rightNumber: i - 2,
				leftLineHighlighted: "",
				rightLineHighlighted: `added ${i}`,
			});
		}
		// Add more lines based on lineCount
		for (let i = 15; i < lineCount; i++) {
			lines.push({
				type: "same",
				leftLine: `line ${i}`,
				rightLine: `line ${i}`,
				leftNumber: i - 2,
				rightNumber: i + 1,
				leftLineHighlighted: `line ${i}`,
				rightLineHighlighted: `line ${i}`,
			});
		}

		diffStore.setHighlightedDiff({ lines });
	}

	describe("jumpToNextDiff", () => {
		it("should do nothing when there are no chunks", () => {
			navigationStore.jumpToNextDiff();
			expect(mockScrollToLine).not.toHaveBeenCalled();
			expect(mockPlayInvalidSound).not.toHaveBeenCalled();
		});

		it("should jump to first chunk when no chunk is selected", () => {
			setupDiffWithChunks(20);
			diffStore.setCurrentChunkIndex(-1);

			navigationStore.jumpToNextDiff();

			expect(get(diffStore).currentChunkIndex).toBe(0);
			const chunks = get(diffChunks);
			expect(mockScrollToLine).toHaveBeenCalledWith(chunks[0].startIndex, 0);
		});

		it("should jump to next chunk when not at last", () => {
			setupDiffWithChunks(20);
			diffStore.setCurrentChunkIndex(0);

			navigationStore.jumpToNextDiff();

			expect(get(diffStore).currentChunkIndex).toBe(1);
			const chunks = get(diffChunks);
			expect(mockScrollToLine).toHaveBeenCalledWith(chunks[1].startIndex, 1);
		});

		it("should play invalid sound when at last chunk", () => {
			setupDiffWithChunks(20);
			const chunks = get(diffChunks);
			diffStore.setCurrentChunkIndex(chunks.length - 1);

			navigationStore.jumpToNextDiff();

			expect(mockPlayInvalidSound).toHaveBeenCalled();
			expect(mockScrollToLine).not.toHaveBeenCalled();
			expect(get(diffStore).currentChunkIndex).toBe(chunks.length - 1);
		});
	});

	describe("jumpToPrevDiff", () => {
		it("should do nothing when there are no chunks", () => {
			navigationStore.jumpToPrevDiff();
			expect(mockScrollToLine).not.toHaveBeenCalled();
			expect(mockPlayInvalidSound).not.toHaveBeenCalled();
		});

		it("should jump to last chunk when no chunk is selected", () => {
			setupDiffWithChunks(20);
			diffStore.setCurrentChunkIndex(-1);

			navigationStore.jumpToPrevDiff();

			const chunks = get(diffChunks);
			expect(get(diffStore).currentChunkIndex).toBe(chunks.length - 1);
			expect(mockScrollToLine).toHaveBeenCalledWith(
				chunks[chunks.length - 1].startIndex,
				chunks.length - 1,
			);
		});

		it("should jump to previous chunk when not at first", () => {
			setupDiffWithChunks(20);
			diffStore.setCurrentChunkIndex(1);

			navigationStore.jumpToPrevDiff();

			expect(get(diffStore).currentChunkIndex).toBe(0);
			const chunks = get(diffChunks);
			expect(mockScrollToLine).toHaveBeenCalledWith(chunks[0].startIndex, 0);
		});

		it("should play invalid sound when at first chunk", () => {
			setupDiffWithChunks(20);
			diffStore.setCurrentChunkIndex(0);

			navigationStore.jumpToPrevDiff();

			expect(mockPlayInvalidSound).toHaveBeenCalled();
			expect(mockScrollToLine).not.toHaveBeenCalled();
			expect(get(diffStore).currentChunkIndex).toBe(0);
		});
	});

	describe("jumpToFirstDiff", () => {
		it("should do nothing when there are no chunks", () => {
			// Create an empty diff result
			diffStore.setRawDiff({ lines: [] });

			navigationStore.jumpToFirstDiff();

			expect(get(diffStore).currentChunkIndex).toBe(-1);
			expect(mockScrollToLine).not.toHaveBeenCalled();
			expect(mockPlayInvalidSound).not.toHaveBeenCalled();
		});

		it("should jump to first chunk when not at first", () => {
			setupDiffWithChunks(20);
			diffStore.setCurrentChunkIndex(2);

			navigationStore.jumpToFirstDiff();

			expect(get(diffStore).currentChunkIndex).toBe(0);
			const chunks = get(diffChunks);
			expect(mockScrollToLine).toHaveBeenCalledWith(chunks[0].startIndex, 0);
		});

		it("should play invalid sound when already at first chunk", () => {
			setupDiffWithChunks(20);
			diffStore.setCurrentChunkIndex(0);

			navigationStore.jumpToFirstDiff();

			expect(mockPlayInvalidSound).toHaveBeenCalled();
			expect(mockScrollToLine).not.toHaveBeenCalled();
			expect(get(diffStore).currentChunkIndex).toBe(0);
		});

		it("should jump to NEW first chunk after original first is removed", () => {
			// Setup initial diff with chunks
			setupDiffWithChunks(20);
			const originalChunks = get(diffChunks);
			expect(originalChunks.length).toBe(2); // Verify we have 2 chunks

			// Remember the second chunk (which will become first)
			const _secondChunkStartIndex = originalChunks[1].startIndex;

			// Navigate to somewhere else (not first)
			diffStore.setCurrentChunkIndex(1);

			// Simulate removing the first chunk (like after a copy operation)
			// We'll create a new diff that only has what was the second chunk
			const lines: HighlightedDiffLine[] = [];
			// Add some same lines
			for (let i = 0; i < 12; i++) {
				lines.push({
					type: "same",
					leftLine: `line ${i}`,
					rightLine: `line ${i}`,
					leftNumber: i + 1,
					rightNumber: i + 1,
					leftLineHighlighted: `line ${i}`,
					rightLineHighlighted: `line ${i}`,
				});
			}
			// Add only the second chunk (what was added lines)
			for (let i = 12; i < 15; i++) {
				lines.push({
					type: "added",
					leftLine: "",
					rightLine: `added ${i}`,
					leftNumber: null,
					rightNumber: i - 2,
					leftLineHighlighted: "",
					rightLineHighlighted: `added ${i}`,
				});
			}

			diffStore.setHighlightedDiff({ lines });
			const newChunks = get(diffChunks);
			expect(newChunks.length).toBe(1); // Now we only have 1 chunk

			// Reset current index since chunks changed
			diffStore.setCurrentChunkIndex(-1);

			// Now jump to first diff - should go to what was the second chunk
			navigationStore.jumpToFirstDiff();

			expect(get(diffStore).currentChunkIndex).toBe(0);
			expect(mockScrollToLine).toHaveBeenCalledWith(newChunks[0].startIndex, 0);
		});
	});

	describe("jumpToLastDiff", () => {
		it("should do nothing when there are no chunks", () => {
			// Create an empty diff result
			diffStore.setRawDiff({ lines: [] });

			navigationStore.jumpToLastDiff();

			expect(get(diffStore).currentChunkIndex).toBe(-1);
			expect(mockScrollToLine).not.toHaveBeenCalled();
			expect(mockPlayInvalidSound).not.toHaveBeenCalled();
		});

		it("should jump to last chunk when not at last", () => {
			setupDiffWithChunks(20);
			diffStore.setCurrentChunkIndex(0);

			navigationStore.jumpToLastDiff();

			const chunks = get(diffChunks);
			const lastIndex = chunks.length - 1;
			expect(get(diffStore).currentChunkIndex).toBe(lastIndex);
			expect(mockScrollToLine).toHaveBeenCalledWith(
				chunks[lastIndex].startIndex,
				lastIndex,
			);
		});

		it("should play invalid sound when already at last chunk", () => {
			setupDiffWithChunks(20);
			const chunks = get(diffChunks);
			const lastIndex = chunks.length - 1;
			diffStore.setCurrentChunkIndex(lastIndex);

			navigationStore.jumpToLastDiff();

			expect(mockPlayInvalidSound).toHaveBeenCalled();
			expect(mockScrollToLine).not.toHaveBeenCalled();
			expect(get(diffStore).currentChunkIndex).toBe(lastIndex);
		});

		it("should jump to NEW last chunk after original last is removed", () => {
			// Setup initial diff with chunks
			setupDiffWithChunks(20);
			const originalChunks = get(diffChunks);
			expect(originalChunks.length).toBe(2); // Verify we have 2 chunks

			// Remember the first chunk (which will become last after second is removed)
			const _firstChunkStartIndex = originalChunks[0].startIndex;

			// Navigate to somewhere else (not last)
			diffStore.setCurrentChunkIndex(0);

			// Simulate removing the last chunk (like after a copy operation)
			// We'll create a new diff that only has what was the first chunk
			const lines: HighlightedDiffLine[] = [];
			// Add some same lines
			for (let i = 0; i < 5; i++) {
				lines.push({
					type: "same",
					leftLine: `line ${i}`,
					rightLine: `line ${i}`,
					leftNumber: i + 1,
					rightNumber: i + 1,
					leftLineHighlighted: `line ${i}`,
					rightLineHighlighted: `line ${i}`,
				});
			}
			// Add only the first chunk (removed lines)
			for (let i = 5; i < 8; i++) {
				lines.push({
					type: "removed",
					leftLine: `removed ${i}`,
					rightLine: "",
					leftNumber: i + 1,
					rightNumber: null,
					leftLineHighlighted: `removed ${i}`,
					rightLineHighlighted: "",
				});
			}
			// Add more same lines
			for (let i = 8; i < 15; i++) {
				lines.push({
					type: "same",
					leftLine: `line ${i}`,
					rightLine: `line ${i}`,
					leftNumber: i + 1,
					rightNumber: i - 2,
					leftLineHighlighted: `line ${i}`,
					rightLineHighlighted: `line ${i}`,
				});
			}

			diffStore.setHighlightedDiff({ lines });
			const newChunks = get(diffChunks);
			expect(newChunks.length).toBe(1); // Now we only have 1 chunk

			// Reset current index since chunks changed
			diffStore.setCurrentChunkIndex(-1);

			// Now jump to last diff - should go to what was the first chunk (now the only chunk)
			navigationStore.jumpToLastDiff();

			expect(get(diffStore).currentChunkIndex).toBe(0);
			expect(mockScrollToLine).toHaveBeenCalledWith(newChunks[0].startIndex, 0);
		});
	});

	describe("navigateAfterCopy", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("should reset to -1 when no chunks remain", () => {
			navigationStore.navigateAfterCopy(0, 2);

			expect(get(diffStore).currentChunkIndex).toBe(-1);
		});

		it("should wrap to first when chunk was removed and we were at end", () => {
			setupDiffWithChunks(20);
			const oldTotalChunks = 3;
			const oldIndex = 2; // was at last

			navigationStore.navigateAfterCopy(oldIndex, oldTotalChunks);

			expect(get(diffStore).currentChunkIndex).toBe(0);
		});

		it("should stay at same index when chunk was removed", () => {
			setupDiffWithChunks(20);
			const chunks = get(diffChunks);
			const oldTotalChunks = chunks.length + 1;
			const oldIndex = 0;

			navigationStore.navigateAfterCopy(oldIndex, oldTotalChunks);

			expect(get(diffStore).currentChunkIndex).toBe(0);
		});

		it("should move to next chunk when no chunks removed", () => {
			setupDiffWithChunks(20);
			const chunks = get(diffChunks);
			const oldTotalChunks = chunks.length;
			const oldIndex = 0;

			navigationStore.navigateAfterCopy(oldIndex, oldTotalChunks);

			expect(get(diffStore).currentChunkIndex).toBe(1);
		});

		it("should wrap to first when at last chunk and no chunks removed", () => {
			setupDiffWithChunks(20);
			const chunks = get(diffChunks);
			const oldTotalChunks = chunks.length;
			const oldIndex = chunks.length - 1;

			navigationStore.navigateAfterCopy(oldIndex, oldTotalChunks);

			expect(get(diffStore).currentChunkIndex).toBe(0);
		});

		it("should scroll to new position after delay", () => {
			setupDiffWithChunks(20);
			const chunks = get(diffChunks);

			navigationStore.navigateAfterCopy(0, chunks.length);

			expect(mockScrollToLine).not.toHaveBeenCalled();

			vi.runAllTimers();

			expect(mockScrollToLine).toHaveBeenCalledWith(chunks[1].startIndex, 1);
		});
	});

	describe("getState", () => {
		it("should return correct state with no chunks", () => {
			const state = navigationStore.getState();
			expect(state).toEqual({
				hasChunks: false,
				currentIndex: -1,
				isFirstChunk: false,
				isLastChunk: true, // -1 === 0 - 1 when no chunks
				canNavigateNext: false,
				canNavigatePrev: false,
			});
		});

		it("should return correct state with chunks", () => {
			setupDiffWithChunks(20);
			const chunks = get(diffChunks);

			// If we only have 2 chunks, test differently
			if (chunks.length === 2) {
				// For 2 chunks, index 1 is the last chunk
				diffStore.setCurrentChunkIndex(0);
				const state = navigationStore.getState();
				expect(state).toEqual({
					hasChunks: true,
					currentIndex: 0,
					isFirstChunk: true,
					isLastChunk: false,
					canNavigateNext: true,
					canNavigatePrev: false,
				});
			} else {
				// Set to middle chunk (not first or last)
				const middleIndex = Math.floor(chunks.length / 2);
				diffStore.setCurrentChunkIndex(middleIndex);

				const state = navigationStore.getState();

				expect(state).toEqual({
					hasChunks: true,
					currentIndex: middleIndex,
					isFirstChunk: false,
					isLastChunk: false,
					canNavigateNext: true,
					canNavigatePrev: true,
				});
			}
		});

		it("should identify first chunk correctly", () => {
			setupDiffWithChunks(20);
			diffStore.setCurrentChunkIndex(0);

			const state = navigationStore.getState();

			expect(state.isFirstChunk).toBe(true);
			expect(state.canNavigatePrev).toBe(false);
			expect(state.canNavigateNext).toBe(true);
		});

		it("should identify last chunk correctly", () => {
			setupDiffWithChunks(20);
			const chunks = get(diffChunks);
			diffStore.setCurrentChunkIndex(chunks.length - 1);

			const state = navigationStore.getState();

			expect(state.isLastChunk).toBe(true);
			expect(state.canNavigatePrev).toBe(true);
			expect(state.canNavigateNext).toBe(false);
		});
	});

	describe("navigationState derived store", () => {
		it("should update when diffStore changes", () => {
			setupDiffWithChunks(20);
			diffStore.setCurrentChunkIndex(0);

			const state = get(navigationState);

			expect(state.hasChunks).toBe(true);
			expect(state.currentIndex).toBe(0);
			expect(state.isFirstChunk).toBe(true);
			expect(state.canNavigatePrev).toBe(false);
			expect(state.canNavigateNext).toBe(true);
		});

		it("should update menu items when state changes", async () => {
			const { UpdateDiffNavigationMenuItems } = await import(
				"../../wailsjs/go/backend/App.js"
			);

			// Clear previous calls
			vi.clearAllMocks();

			setupDiffWithChunks(20);

			// For 2 chunks, set to first chunk (can navigate next but not prev)
			diffStore.setCurrentChunkIndex(0);

			// Wait for subscription to fire
			await new Promise((resolve) => setTimeout(resolve, 0));

			// Should have been called with canNavigatePrev=false, canNavigateNext=true, canNavigateFirst=false, canNavigateLast=true
			expect(UpdateDiffNavigationMenuItems).toHaveBeenCalledWith(
				false,
				true,
				false,
				true,
			);
		});
	});
});
