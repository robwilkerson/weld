/**
 * Utilities for synchronizing scroll positions between diff panes
 */

export interface ScrollElements {
	leftPane: HTMLElement | null;
	rightPane: HTMLElement | null;
	centerGutter: HTMLElement | null;
}

export interface ScrollSyncOptions {
	isInitialScroll?: boolean;
	onSyncComplete?: () => void;
}

/**
 * Creates a scroll synchronizer for the diff viewer panes
 */
export function createScrollSynchronizer() {
	let isScrollSyncing = false;
	let elements: ScrollElements = {
		leftPane: null,
		rightPane: null,
		centerGutter: null,
	};

	/**
	 * Updates the elements to sync
	 */
	function setElements(newElements: ScrollElements) {
		elements = newElements;
	}

	/**
	 * Syncs scroll from left pane to other panes
	 */
	function syncFromLeft(options: ScrollSyncOptions = {}) {
		const { leftPane, rightPane, centerGutter } = elements;
		if (
			isScrollSyncing ||
			options.isInitialScroll ||
			!leftPane ||
			!rightPane ||
			!centerGutter
		) {
			return;
		}

		isScrollSyncing = true;

		// Sync vertical scrolling to all panes
		const scrollTop = leftPane.scrollTop;
		rightPane.scrollTop = scrollTop;
		centerGutter.scrollTop = scrollTop;

		// Only sync horizontal scroll between content panes
		rightPane.scrollLeft = leftPane.scrollLeft;

		requestAnimationFrame(() => {
			isScrollSyncing = false;
			options.onSyncComplete?.();
		});
	}

	/**
	 * Syncs scroll from right pane to other panes
	 */
	function syncFromRight(options: ScrollSyncOptions = {}) {
		const { leftPane, rightPane, centerGutter } = elements;
		if (
			isScrollSyncing ||
			options.isInitialScroll ||
			!leftPane ||
			!rightPane ||
			!centerGutter
		) {
			return;
		}

		isScrollSyncing = true;

		// Sync vertical scrolling to all panes
		const scrollTop = rightPane.scrollTop;
		leftPane.scrollTop = scrollTop;
		centerGutter.scrollTop = scrollTop;

		// Only sync horizontal scroll between content panes
		leftPane.scrollLeft = rightPane.scrollLeft;

		requestAnimationFrame(() => {
			isScrollSyncing = false;
			options.onSyncComplete?.();
		});
	}

	/**
	 * Syncs scroll from center gutter to content panes
	 */
	function syncFromCenter(options: ScrollSyncOptions = {}) {
		const { leftPane, rightPane, centerGutter } = elements;
		if (
			isScrollSyncing ||
			options.isInitialScroll ||
			!leftPane ||
			!rightPane ||
			!centerGutter
		) {
			return;
		}

		isScrollSyncing = true;

		// Sync center gutter scroll to both content panes
		leftPane.scrollTop = centerGutter.scrollTop;
		rightPane.scrollTop = centerGutter.scrollTop;

		setTimeout(() => {
			isScrollSyncing = false;
			options.onSyncComplete?.();
		}, 10);
	}

	/**
	 * Scrolls all panes to a specific position
	 */
	function scrollToPosition(
		scrollTop: number,
		options: { animate?: boolean } = {},
	): Promise<void> {
		return new Promise((resolve) => {
			const { leftPane, rightPane, centerGutter } = elements;
			if (!leftPane || !rightPane || !centerGutter) {
				resolve();
				return;
			}

			isScrollSyncing = true;

			if (options.animate) {
				requestAnimationFrame(() => {
					leftPane.scrollTop = scrollTop;
					rightPane.scrollTop = scrollTop;
					centerGutter.scrollTop = scrollTop;

					requestAnimationFrame(() => {
						isScrollSyncing = false;
						resolve();
					});
				});
			} else {
				leftPane.scrollTop = scrollTop;
				rightPane.scrollTop = scrollTop;
				centerGutter.scrollTop = scrollTop;
				isScrollSyncing = false;
				resolve();
			}
		});
	}

	/**
	 * Gets the current sync state
	 */
	function isSyncing() {
		return isScrollSyncing;
	}

	/**
	 * Forces sync state (use with caution)
	 */
	function setSyncing(value: boolean) {
		isScrollSyncing = value;
	}

	return {
		setElements,
		syncFromLeft,
		syncFromRight,
		syncFromCenter,
		scrollToPosition,
		isSyncing,
		setSyncing,
	};
}

/**
 * Calculates scroll position to center a line in the viewport
 */
export function calculateScrollToCenterLine(
	lineIndex: number,
	lineHeight: number,
	viewportHeight: number,
	scrollHeight?: number,
): number {
	// Calculate the position of the middle of the target line
	const linePosition = lineIndex * lineHeight + lineHeight / 2;
	const middleOfViewport = viewportHeight / 2;
	// Calculate ideal scroll position to center the line
	const idealScrollPosition = linePosition - middleOfViewport;

	// Clamp to valid scroll range
	let scrollPosition = Math.max(0, idealScrollPosition);

	// If scrollHeight is provided, also clamp to maximum scroll
	if (scrollHeight !== undefined) {
		const maxScroll = Math.max(0, scrollHeight - viewportHeight);
		scrollPosition = Math.min(scrollPosition, maxScroll);
	}

	return scrollPosition;
}

/**
 * Clamps scroll position to valid range
 */
export function clampScrollPosition(
	scrollTop: number,
	scrollHeight: number,
	clientHeight: number,
): number {
	const maxScroll = scrollHeight - clientHeight;
	return Math.max(0, Math.min(scrollTop, maxScroll));
}
