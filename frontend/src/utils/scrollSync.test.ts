import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	calculateScrollToCenterLine,
	clampScrollPosition,
	createScrollSynchronizer,
	type ScrollElements,
} from "./scrollSync";

describe("scrollSync", () => {
	let mockElements: ScrollElements;
	let requestAnimationFrameSpy: import("vitest").MockInstance;
	let setTimeoutSpy: import("vitest").MockInstance;

	beforeEach(() => {
		// Mock DOM elements
		mockElements = {
			leftPane: {
				scrollTop: 0,
				scrollLeft: 0,
				scrollHeight: 1000,
				clientHeight: 500,
			} as HTMLElement,
			rightPane: {
				scrollTop: 0,
				scrollLeft: 0,
				scrollHeight: 1000,
				clientHeight: 500,
			} as HTMLElement,
			centerGutter: {
				scrollTop: 0,
				scrollLeft: 0,
				scrollHeight: 1000,
				clientHeight: 500,
			} as HTMLElement,
		};

		// Mock requestAnimationFrame
		requestAnimationFrameSpy = vi
			.spyOn(window, "requestAnimationFrame")
			.mockImplementation((cb: FrameRequestCallback) => {
				cb(0);
				return 0;
			});

		// Mock setTimeout
		setTimeoutSpy = vi
			.spyOn(window, "setTimeout")
			.mockImplementation((cb: () => void) => {
				cb();
				return 0 as unknown as ReturnType<typeof setTimeout>;
			});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("createScrollSynchronizer", () => {
		it("should create a scroll synchronizer", () => {
			const syncer = createScrollSynchronizer();
			expect(syncer).toHaveProperty("setElements");
			expect(syncer).toHaveProperty("syncFromLeft");
			expect(syncer).toHaveProperty("syncFromRight");
			expect(syncer).toHaveProperty("syncFromCenter");
			expect(syncer).toHaveProperty("scrollToPosition");
			expect(syncer).toHaveProperty("isSyncing");
			expect(syncer).toHaveProperty("setSyncing");
		});

		describe("syncFromLeft", () => {
			it("should sync scroll from left pane to other panes", () => {
				const syncer = createScrollSynchronizer();
				syncer.setElements(mockElements);

				// Set left pane scroll
				if (mockElements.leftPane) {
					mockElements.leftPane.scrollTop = 100;
					mockElements.leftPane.scrollLeft = 50;
				}

				// Sync
				syncer.syncFromLeft();

				// Check other panes were synced
				expect(mockElements.rightPane?.scrollTop).toBe(100);
				expect(mockElements.centerGutter?.scrollTop).toBe(100);
				expect(mockElements.rightPane?.scrollLeft).toBe(50);
			});

			it("should not sync if already syncing", () => {
				const syncer = createScrollSynchronizer();
				syncer.setElements(mockElements);
				syncer.setSyncing(true);

				if (mockElements.leftPane) {
					mockElements.leftPane.scrollTop = 100;
				}
				syncer.syncFromLeft();

				// Should not have synced
				expect(mockElements.rightPane?.scrollTop).toBe(0);
			});

			it("should not sync during initial scroll", () => {
				const syncer = createScrollSynchronizer();
				syncer.setElements(mockElements);

				if (mockElements.leftPane) {
					mockElements.leftPane.scrollTop = 100;
				}
				syncer.syncFromLeft({ isInitialScroll: true });

				// Should not have synced
				expect(mockElements.rightPane?.scrollTop).toBe(0);
			});

			it("should call onSyncComplete callback", () => {
				const syncer = createScrollSynchronizer();
				syncer.setElements(mockElements);
				const onSyncComplete = vi.fn();

				syncer.syncFromLeft({ onSyncComplete });

				expect(onSyncComplete).toHaveBeenCalled();
			});
		});

		describe("syncFromRight", () => {
			it("should sync scroll from right pane to other panes", () => {
				const syncer = createScrollSynchronizer();
				syncer.setElements(mockElements);

				// Set right pane scroll
				if (mockElements.rightPane) {
					mockElements.rightPane.scrollTop = 200;
					mockElements.rightPane.scrollLeft = 75;
				}

				// Sync
				syncer.syncFromRight();

				// Check other panes were synced
				expect(mockElements.leftPane?.scrollTop).toBe(200);
				expect(mockElements.centerGutter?.scrollTop).toBe(200);
				expect(mockElements.leftPane?.scrollLeft).toBe(75);
			});
		});

		describe("syncFromCenter", () => {
			it("should sync scroll from center gutter to content panes", () => {
				const syncer = createScrollSynchronizer();
				syncer.setElements(mockElements);

				// Set center gutter scroll
				if (mockElements.centerGutter) {
					mockElements.centerGutter.scrollTop = 300;
				}

				// Sync
				syncer.syncFromCenter();

				// Check content panes were synced
				expect(mockElements.leftPane?.scrollTop).toBe(300);
				expect(mockElements.rightPane?.scrollTop).toBe(300);
			});

			it("should use setTimeout for center sync", () => {
				const syncer = createScrollSynchronizer();
				syncer.setElements(mockElements);

				syncer.syncFromCenter();

				expect(setTimeoutSpy).toHaveBeenCalled();
			});
		});

		describe("scrollToPosition", () => {
			it("should scroll all panes to specified position", async () => {
				const syncer = createScrollSynchronizer();
				syncer.setElements(mockElements);

				await syncer.scrollToPosition(150);

				expect(mockElements.leftPane?.scrollTop).toBe(150);
				expect(mockElements.rightPane?.scrollTop).toBe(150);
				expect(mockElements.centerGutter?.scrollTop).toBe(150);
			});

			it("should animate scroll when requested", async () => {
				const syncer = createScrollSynchronizer();
				syncer.setElements(mockElements);

				await syncer.scrollToPosition(150, { animate: true });

				expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(2);
				expect(mockElements.leftPane?.scrollTop).toBe(150);
			});

			it("should resolve even with missing elements", async () => {
				const syncer = createScrollSynchronizer();
				syncer.setElements({
					leftPane: null,
					rightPane: null,
					centerGutter: null,
				});

				await expect(syncer.scrollToPosition(150)).resolves.toBeUndefined();
			});
		});

		describe("isSyncing", () => {
			it("should return sync state", () => {
				const syncer = createScrollSynchronizer();
				expect(syncer.isSyncing()).toBe(false);

				syncer.setSyncing(true);
				expect(syncer.isSyncing()).toBe(true);
			});
		});
	});

	describe("calculateScrollToCenterLine", () => {
		it("should calculate scroll position to center a line", () => {
			const lineHeight = 20;
			const viewportHeight = 400;

			// Line 10: middle at position 210 (10*20 + 10), centered means scroll to 10
			expect(calculateScrollToCenterLine(10, lineHeight, viewportHeight)).toBe(
				10,
			);

			// Line 50: middle at position 1010 (50*20 + 10), centered means scroll to 810
			expect(calculateScrollToCenterLine(50, lineHeight, viewportHeight)).toBe(
				810,
			);
		});

		it("should not return negative scroll values", () => {
			// Line 5: middle at position 110 (5*20 + 10), centered would be -90, but clamped to 0
			expect(calculateScrollToCenterLine(5, 20, 400)).toBe(0);
		});

		it("should handle edge case for 13th diff with specific viewport", () => {
			const lineHeight = 19.2; // from CSS var(--line-height)
			const viewportHeight = 600; // typical viewport height

			// Test for the 13th diff (index 12 if 0-based)
			// Let's say it's at line 250
			const lineIndex = 250;

			// Calculate expected scroll position
			const linePosition = lineIndex * lineHeight + lineHeight / 2;
			const middleOfViewport = viewportHeight / 2;
			const expectedScroll = Math.max(0, linePosition - middleOfViewport);

			const result = calculateScrollToCenterLine(
				lineIndex,
				lineHeight,
				viewportHeight,
			);
			expect(result).toBe(expectedScroll);
			expect(result).toBe(4509.6); // (250 * 19.2 + 9.6) - 300 = 4809.6 - 300 = 4509.6
		});

		it("should handle very large line numbers", () => {
			const lineHeight = 19.2;
			const viewportHeight = 600;

			// Test with a very large line number
			const lineIndex = 1000;
			const result = calculateScrollToCenterLine(
				lineIndex,
				lineHeight,
				viewportHeight,
			);

			// Should still center correctly
			const expectedScroll =
				lineIndex * lineHeight + lineHeight / 2 - viewportHeight / 2;
			expect(result).toBe(expectedScroll);
			expect(result).toBe(18909.6); // (1000 * 19.2 + 9.6) - 300 = 19209.6 - 300 = 18909.6
		});

		it("should properly center when scrolling is constrained by max scroll", () => {
			const lineHeight = 19.2;
			const viewportHeight = 600;
			const scrollHeight = 5760; // 300 lines * 19.2

			// Simulate a case where we can't center because we're near the bottom
			// Max scroll = scrollHeight - viewportHeight = 5760 - 600 = 5160
			// If we try to center line 290, ideal scroll = (290 * 19.2 + 9.6) - 300 = 5577.6 - 300 = 5277.6
			// But max scroll is 5160, so it should be clamped

			const lineIndex = 290;
			const result = calculateScrollToCenterLine(
				lineIndex,
				lineHeight,
				viewportHeight,
				scrollHeight,
			);

			// The function should clamp to max scroll
			expect(result).toBe(5160); // Max scroll position
		});

		it("should handle 13th diff near bottom properly", () => {
			const lineHeight = 19.2;
			const viewportHeight = 600;
			// Simulate a file with the 13th diff near the bottom
			const totalLines = 300;
			const scrollHeight = totalLines * lineHeight; // 5760

			// 13th diff at line 280 (near bottom)
			const lineIndex = 280;

			// Calculate what should happen
			const idealScroll =
				lineIndex * lineHeight + lineHeight / 2 - viewportHeight / 2;
			const maxScroll = scrollHeight - viewportHeight;
			const expectedScroll = Math.min(idealScroll, maxScroll);

			const result = calculateScrollToCenterLine(
				lineIndex,
				lineHeight,
				viewportHeight,
				scrollHeight,
			);
			expect(result).toBe(expectedScroll);
			// idealScroll = (280 * 19.2 + 9.6) - 300 = 5385.6 - 300 = 5085.6
			// maxScroll = 5760 - 600 = 5160
			// Since 5085.6 < 5160, it's not clamped
			expect(result).toBe(5085.6);
		});
	});

	describe("clampScrollPosition", () => {
		it("should clamp scroll position to valid range", () => {
			const scrollHeight = 1000;
			const clientHeight = 400;

			// Normal value
			expect(clampScrollPosition(300, scrollHeight, clientHeight)).toBe(300);

			// Too high
			expect(clampScrollPosition(800, scrollHeight, clientHeight)).toBe(600);

			// Negative
			expect(clampScrollPosition(-50, scrollHeight, clientHeight)).toBe(0);
		});

		it("should handle edge cases", () => {
			// No scrollable area
			expect(clampScrollPosition(100, 400, 400)).toBe(0);

			// Client height larger than scroll height
			expect(clampScrollPosition(100, 300, 400)).toBe(0);
		});
	});
});
