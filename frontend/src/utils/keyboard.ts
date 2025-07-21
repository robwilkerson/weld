/**
 * Keyboard event handling utilities
 */

/**
 * Handles keyboard shortcuts for save operations and navigation
 */
export function handleKeydown(
	event: KeyboardEvent,
	saveLeftFile: () => void,
	saveRightFile: () => void,
	leftPath: string,
	rightPath: string,
	jumpToNextDiff?: () => void,
	jumpToPrevDiff?: () => void,
): void {
	const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
	const isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

	if (isCtrlOrCmd && event.key === "s") {
		event.preventDefault();

		if (leftPath) {
			saveLeftFile();
		}
		if (rightPath) {
			saveRightFile();
		}
	}

	// Navigation shortcuts: Arrow keys and vim keybindings
	if (jumpToNextDiff && jumpToPrevDiff) {
		if (event.key === "ArrowDown" || event.key === "j") {
			event.preventDefault();
			jumpToNextDiff();
		} else if (event.key === "ArrowUp" || event.key === "k") {
			event.preventDefault();
			jumpToPrevDiff();
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
