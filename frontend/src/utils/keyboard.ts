/**
 * Keyboard event handling utilities
 *
 * Available keyboard shortcuts:
 * - Cmd/Ctrl + S: Save both files
 * - ArrowDown or j: Jump to next diff
 * - ArrowUp or k: Jump to previous diff
 * - Shift + L: Copy current diff from right to left
 * - Shift + H: Copy current diff from left to right
 * - Cmd/Ctrl + Z or u: Undo last change
 */

export interface KeyboardHandlerCallbacks {
	saveLeftFile: () => void;
	saveRightFile: () => void;
	jumpToNextDiff?: () => void;
	jumpToPrevDiff?: () => void;
	copyCurrentDiffLeftToRight?: () => void;
	copyCurrentDiffRightToLeft?: () => void;
	undoLastChange?: () => void;
}

/**
 * Handles all keyboard shortcuts for the application
 */
export function handleKeydown(
	event: KeyboardEvent,
	callbacks: KeyboardHandlerCallbacks,
	leftPath: string,
	rightPath: string,
): void {
	const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
	const isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

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

		if (leftPath) {
			callbacks.saveLeftFile();
		}
		if (rightPath) {
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

	// Undo shortcuts: Cmd/Ctrl+Z or vim 'u' key
	if (callbacks.undoLastChange) {
		if ((isCtrlOrCmd && event.key === "z") || event.key === "u") {
			event.preventDefault();
			callbacks.undoLastChange();
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
