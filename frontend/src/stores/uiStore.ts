import { get, writable } from "svelte/store";

interface FlashMessage {
	message: string;
	type: "error" | "warning" | "info";
}

interface UIState {
	// Comparison state
	isComparing: boolean;
	hasCompletedComparison: boolean;
	errorMessage: string; // Deprecated - will be removed
	flashMessage: FlashMessage | null;

	// Theme state
	isDarkMode: boolean;

	// UI visibility state
	showMenu: boolean;
	showMinimap: boolean;
	showQuitDialog: boolean;
	quitDialogFiles: string[];

	// Viewport state
	hasHorizontalScrollbar: boolean;
	isDraggingViewport: boolean;
	hoveredChunkIndex: number;
}

function createUIStore() {
	// Initialize theme from localStorage
	const savedTheme =
		typeof localStorage !== "undefined" ? localStorage.getItem("theme") : null;
	const initialDarkMode = savedTheme ? savedTheme === "dark" : true;

	// Set theme immediately to prevent flash
	if (typeof document !== "undefined") {
		document.documentElement.setAttribute(
			"data-theme",
			initialDarkMode ? "dark" : "light",
		);
	}

	const { subscribe, update } = writable<UIState>({
		isComparing: false,
		hasCompletedComparison: false,
		errorMessage: "",
		flashMessage: null,
		isDarkMode: initialDarkMode,
		showMenu: false,
		showMinimap: true,
		showQuitDialog: false,
		quitDialogFiles: [],
		hasHorizontalScrollbar: false,
		isDraggingViewport: false,
		hoveredChunkIndex: -1,
	});

	return {
		subscribe,

		// Set comparing state
		setComparing(isComparing: boolean): void {
			update((state) => ({
				...state,
				isComparing,
			}));
		},

		// Set comparison completed state
		setCompletionState(completed: boolean): void {
			update((state) => ({
				...state,
				hasCompletedComparison: completed,
			}));
		},

		// Set error message
		setError(message: string): void {
			update((state) => ({
				...state,
				errorMessage: message,
			}));
		},

		// Clear error message
		clearError(): void {
			update((state) => ({
				...state,
				errorMessage: "",
			}));
		},

		// Show flash message
		showFlash(
			message: string,
			type: "error" | "warning" | "info" = "info",
		): void {
			update((state) => ({
				...state,
				flashMessage: { message, type },
			}));
		},

		// Clear flash message
		clearFlash(): void {
			update((state) => ({
				...state,
				flashMessage: null,
			}));
		},

		// Toggle dark mode
		toggleDarkMode(): void {
			update((state) => {
				const newDarkMode = !state.isDarkMode;
				const theme = newDarkMode ? "dark" : "light";
				if (typeof document !== "undefined") {
					document.documentElement.setAttribute("data-theme", theme);
				}
				if (typeof localStorage !== "undefined") {
					localStorage.setItem("theme", theme);
				}
				return {
					...state,
					isDarkMode: newDarkMode,
				};
			});
		},

		// Toggle menu visibility
		toggleMenu(): void {
			update((state) => ({
				...state,
				showMenu: !state.showMenu,
			}));
		},

		// Set menu visibility
		setMenuVisible(visible: boolean): void {
			update((state) => ({
				...state,
				showMenu: visible,
			}));
		},

		// Set minimap visibility
		setMinimapVisible(visible: boolean): void {
			update((state) => ({
				...state,
				showMinimap: visible,
			}));
		},

		// Show quit dialog
		showQuitDialog(files: string[]): void {
			update((state) => ({
				...state,
				showQuitDialog: true,
				quitDialogFiles: files,
			}));
		},

		// Hide quit dialog
		hideQuitDialog(): void {
			update((state) => ({
				...state,
				showQuitDialog: false,
				quitDialogFiles: [],
			}));
		},

		// Set horizontal scrollbar state
		setHorizontalScrollbar(hasScrollbar: boolean): void {
			update((state) => ({
				...state,
				hasHorizontalScrollbar: hasScrollbar,
			}));
		},

		// Set viewport dragging state
		setDraggingViewport(isDragging: boolean): void {
			update((state) => ({
				...state,
				isDraggingViewport: isDragging,
			}));
		},

		// Set hovered chunk index
		setHoveredChunkIndex(index: number): void {
			update((state) => ({
				...state,
				hoveredChunkIndex: index,
			}));
		},

		// Reset comparison state
		resetComparisonState(): void {
			update((state) => ({
				...state,
				hasCompletedComparison: false,
			}));
		},

		// Get current state
		getState(): UIState {
			return get({ subscribe });
		},
	};
}

export const uiStore = createUIStore();
