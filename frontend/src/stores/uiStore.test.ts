import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock localStorage
const localStorageMock = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn(),
	key: vi.fn(),
	length: 0,
};
global.localStorage = localStorageMock as Storage;

// Mock document
const documentMock = {
	documentElement: {
		setAttribute: vi.fn(),
	},
};
global.document = documentMock as any;

import { uiStore } from "./uiStore";

describe("uiStore", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset store to initial state
		const _state = uiStore.getState();
		uiStore.setComparing(false);
		uiStore.setCompletionState(false);
		uiStore.clearError();
		uiStore.setMenuVisible(false);
		uiStore.setMinimapVisible(true);
		uiStore.hideQuitDialog();
		uiStore.setHorizontalScrollbar(false);
		uiStore.setDraggingViewport(false);
		uiStore.setHoveredChunkIndex(-1);
	});

	describe("initial state", () => {
		it("should have correct initial values", () => {
			const state = uiStore.getState();
			expect(state).toMatchObject({
				isComparing: false,
				hasCompletedComparison: false,
				errorMessage: "",
				showMenu: false,
				showMinimap: true,
				showQuitDialog: false,
				quitDialogFiles: [],
				hasHorizontalScrollbar: false,
				isDraggingViewport: false,
				hoveredChunkIndex: -1,
			});
		});

		it.skip("should load dark mode from localStorage", async () => {
			// Skipped in Bun - vi.resetModules not available
			localStorageMock.getItem.mockReturnValue("dark");
		});

		it.skip("should default to dark mode when no saved theme", async () => {
			// Skipped in Bun - vi.resetModules not available
			localStorageMock.getItem.mockReturnValue(null);
		});
	});

	describe("comparison state", () => {
		it("should set comparing state", () => {
			uiStore.setComparing(true);
			expect(get(uiStore).isComparing).toBe(true);

			uiStore.setComparing(false);
			expect(get(uiStore).isComparing).toBe(false);
		});

		it("should set completion state", () => {
			uiStore.setCompletionState(true);
			expect(get(uiStore).hasCompletedComparison).toBe(true);

			uiStore.setCompletionState(false);
			expect(get(uiStore).hasCompletedComparison).toBe(false);
		});

		it("should reset comparison state", () => {
			uiStore.setCompletionState(true);
			uiStore.resetComparisonState();
			expect(get(uiStore).hasCompletedComparison).toBe(false);
		});
	});

	describe("error handling", () => {
		it("should set error message", () => {
			uiStore.setError("Test error");
			expect(get(uiStore).errorMessage).toBe("Test error");
		});

		it("should clear error message", () => {
			uiStore.setError("Test error");
			uiStore.clearError();
			expect(get(uiStore).errorMessage).toBe("");
		});
	});

	describe("theme management", () => {
		it("should toggle dark mode", () => {
			const initialState = get(uiStore).isDarkMode;
			uiStore.toggleDarkMode();
			const newState = get(uiStore).isDarkMode;
			expect(newState).toBe(!initialState);
		});

		it("should update document and localStorage when toggling theme", () => {
			// Get current dark mode state
			const currentDarkMode = get(uiStore).isDarkMode;
			uiStore.toggleDarkMode();

			const expectedTheme = currentDarkMode ? "light" : "dark";
			expect(documentMock.documentElement.setAttribute).toHaveBeenCalledWith(
				"data-theme",
				expectedTheme,
			);
			expect(localStorageMock.setItem).toHaveBeenCalledWith(
				"theme",
				expectedTheme,
			);
		});
	});

	describe("menu visibility", () => {
		it("should toggle menu", () => {
			uiStore.toggleMenu();
			expect(get(uiStore).showMenu).toBe(true);

			uiStore.toggleMenu();
			expect(get(uiStore).showMenu).toBe(false);
		});

		it("should set menu visibility directly", () => {
			uiStore.setMenuVisible(true);
			expect(get(uiStore).showMenu).toBe(true);

			uiStore.setMenuVisible(false);
			expect(get(uiStore).showMenu).toBe(false);
		});
	});

	describe("minimap visibility", () => {
		it("should set minimap visibility", () => {
			uiStore.setMinimapVisible(false);
			expect(get(uiStore).showMinimap).toBe(false);

			uiStore.setMinimapVisible(true);
			expect(get(uiStore).showMinimap).toBe(true);
		});
	});

	describe("quit dialog", () => {
		it("should show quit dialog with files", () => {
			const files = ["/path/to/file1", "/path/to/file2"];
			uiStore.showQuitDialog(files);

			const state = get(uiStore);
			expect(state.showQuitDialog).toBe(true);
			expect(state.quitDialogFiles).toEqual(files);
		});

		it("should hide quit dialog and clear files", () => {
			uiStore.showQuitDialog(["/path/to/file"]);
			uiStore.hideQuitDialog();

			const state = get(uiStore);
			expect(state.showQuitDialog).toBe(false);
			expect(state.quitDialogFiles).toEqual([]);
		});
	});

	describe("viewport state", () => {
		it("should set horizontal scrollbar state", () => {
			uiStore.setHorizontalScrollbar(true);
			expect(get(uiStore).hasHorizontalScrollbar).toBe(true);

			uiStore.setHorizontalScrollbar(false);
			expect(get(uiStore).hasHorizontalScrollbar).toBe(false);
		});

		it("should set dragging viewport state", () => {
			uiStore.setDraggingViewport(true);
			expect(get(uiStore).isDraggingViewport).toBe(true);

			uiStore.setDraggingViewport(false);
			expect(get(uiStore).isDraggingViewport).toBe(false);
		});

		it("should set hovered chunk index", () => {
			uiStore.setHoveredChunkIndex(5);
			expect(get(uiStore).hoveredChunkIndex).toBe(5);

			uiStore.setHoveredChunkIndex(-1);
			expect(get(uiStore).hoveredChunkIndex).toBe(-1);
		});
	});

	describe("getState", () => {
		it("should return current state", () => {
			uiStore.setError("Test error");
			uiStore.setComparing(true);
			uiStore.setMenuVisible(true);

			const state = uiStore.getState();
			expect(state.errorMessage).toBe("Test error");
			expect(state.isComparing).toBe(true);
			expect(state.showMenu).toBe(true);
		});
	});
});
