/**
 * Keyboard event handling utilities
 */

/**
 * Handles keyboard shortcuts for save operations
 */
export function handleKeydown(
	event: KeyboardEvent,
	saveLeftFile: () => void,
	saveRightFile: () => void,
	leftPath: string,
	rightPath: string,
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