/**
 * Keyboard event handling utilities
 *
 * Available keyboard shortcuts:
 * - Enter: Compare files (when both files selected)
 * - Escape: Close menu
 * - Cmd/Ctrl + S: Save all files with changes
 * - ArrowDown or j: Jump to next diff
 * - ArrowUp or k: Jump to previous diff
 * - g: Jump to first diff
 * - G: Jump to last diff
 * - Shift + L: Copy current diff from right to left
 * - Shift + H: Copy current diff from left to right
 * - Cmd/Ctrl + Z or u: Undo last change
 * - Cmd/Ctrl + Shift + Z or Ctrl + r: Redo last undone change
 */

export interface KeyboardHandlerCallbacks {
	saveLeftFile: () => void;
	saveRightFile: () => void;
	jumpToNextDiff?: () => void;
	jumpToPrevDiff?: () => void;
	jumpToFirstDiff?: () => void;
	jumpToLastDiff?: () => void;
	copyCurrentDiffLeftToRight?: () => void;
	copyCurrentDiffRightToLeft?: () => void;
	undoLastChange?: () => void;
	redoLastChange?: () => void;
	compareFiles?: () => void;
	closeMenu?: () => void;
}

export interface KeyboardHandlerState {
	leftFilePath: string;
	rightFilePath: string;
	isComparing: boolean;
	hasCompletedComparison: boolean;
	showMenu: boolean;
}

/**
 * Handles all keyboard shortcuts for the application
 */
export function handleKeydown(
	event: KeyboardEvent,
	callbacks: KeyboardHandlerCallbacks,
	state: KeyboardHandlerState,
): void {
	const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
	const isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

	// Handle Escape key to close menu
	if (event.key === "Escape" && state.showMenu && callbacks.closeMenu) {
		event.preventDefault();
		callbacks.closeMenu();
		return;
	}

	// Handle Enter key to trigger comparison when Compare button would be enabled
	if (
		event.key === "Enter" &&
		!event.shiftKey &&
		!event.ctrlKey &&
		!event.metaKey &&
		!event.altKey
	) {
		// Check if Compare button would be enabled
		if (
			state.leftFilePath &&
			state.rightFilePath &&
			!state.isComparing &&
			!state.hasCompletedComparison &&
			callbacks.compareFiles
		) {
			event.preventDefault();
			callbacks.compareFiles();
			return;
		}
	}

	// Handle Shift+L and Shift+H for copying current diff
	if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
		if (event.key === "L" && callbacks.copyCurrentDiffLeftToRight) {
			event.preventDefault();
			callbacks.copyCurrentDiffLeftToRight();
			return;
		} else if (event.key === "H" && callbacks.copyCurrentDiffRightToLeft) {
			event.preventDefault();
			callbacks.copyCurrentDiffRightToLeft();
			return;
		}
	}

	// Save shortcuts
	if (isCtrlOrCmd && event.key === "s") {
		event.preventDefault();

		if (state.leftFilePath) {
			callbacks.saveLeftFile();
		}
		if (state.rightFilePath) {
			callbacks.saveRightFile();
		}
	}

	// Navigation shortcuts: Arrow keys and vim keybindings
	if (callbacks.jumpToNextDiff && callbacks.jumpToPrevDiff) {
		if (event.key === "ArrowDown" || event.key === "j") {
			event.preventDefault();
			callbacks.jumpToNextDiff();
		} else if (event.key === "ArrowUp" || event.key === "k") {
			event.preventDefault();
			callbacks.jumpToPrevDiff();
		}
	}

	// Jump to first/last diff with g/G keys
	if (
		event.key === "g" &&
		!event.shiftKey &&
		!event.ctrlKey &&
		!event.metaKey &&
		!event.altKey
	) {
		if (callbacks.jumpToFirstDiff) {
			event.preventDefault();
			callbacks.jumpToFirstDiff();
		}
	} else if (
		event.key === "G" &&
		!event.ctrlKey &&
		!event.metaKey &&
		!event.altKey
	) {
		if (callbacks.jumpToLastDiff) {
			event.preventDefault();
			callbacks.jumpToLastDiff();
		}
	}

	// Undo shortcuts: Cmd/Ctrl+Z or vim 'u' key
	if (callbacks.undoLastChange) {
		if (
			(isCtrlOrCmd && event.key === "z" && !event.shiftKey) ||
			event.key === "u"
		) {
			event.preventDefault();
			callbacks.undoLastChange();
		}
	}

	// Redo shortcuts: Cmd/Ctrl+Shift+Z or 'r' key (matching 'u' for undo)
	if (callbacks.redoLastChange) {
		if (
			(isCtrlOrCmd && event.key === "z" && event.shiftKey) ||
			event.key === "r"
		) {
			event.preventDefault();
			callbacks.redoLastChange();
		}
	}
}

/**
 * Checks if the current platform is macOS
 */
export function isMacOS(): boolean {
	return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
}

/**
 * Gets the appropriate modifier key name for the platform
 */
export function getModifierKeyName(): string {
	return isMacOS() ? "Cmd" : "Ctrl";
}
