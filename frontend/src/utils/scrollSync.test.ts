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

			// Line 10 should be at position 200, centered means scroll to 0
			expect(calculateScrollToCenterLine(10, lineHeight, viewportHeight)).toBe(
				0,
			);

			// Line 50 should be at position 1000, centered means scroll to 800
			expect(calculateScrollToCenterLine(50, lineHeight, viewportHeight)).toBe(
				800,
			);
		});

		it("should not return negative scroll values", () => {
			expect(calculateScrollToCenterLine(5, 20, 400)).toBe(0);
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
