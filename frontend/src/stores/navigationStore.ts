import { derived, get } from "svelte/store";
import { UpdateDiffNavigationMenuItems } from "../../wailsjs/go/main/App.js";
import { diffChunks, diffStore } from "./diffStore";

interface NavigationCallbacks {
	scrollToLine: (lineIndex: number, chunkIndex?: number) => void;
	playInvalidSound: () => void;
}

function createNavigationStore() {
	let callbacks: NavigationCallbacks | null = null;

	// Jump to next diff
	function jumpToNextDiff(): void {
		const chunks = get(diffChunks);
		const currentIndex = get(diffStore).currentChunkIndex;

		if (!chunks.length) {
			return;
		}

		// Check if we're at the last chunk
		if (currentIndex >= chunks.length - 1) {
			// Already at the last diff, play sound and do nothing
			callbacks?.playInvalidSound();
			return;
		}

		// Find the next chunk
		let nextChunkIndex = -1;
		if (currentIndex === -1) {
			// No current chunk, jump to first
			nextChunkIndex = 0;
		} else {
			// Go to next chunk
			nextChunkIndex = currentIndex + 1;
		}

		diffStore.setCurrentChunkIndex(nextChunkIndex);
		const chunk = chunks[nextChunkIndex];
		callbacks?.scrollToLine(chunk.startIndex, nextChunkIndex);
	}

	// Jump to first diff
	function jumpToFirstDiff(): void {
		const chunks = get(diffChunks);
		const currentIndex = get(diffStore).currentChunkIndex;

		if (!chunks.length) {
			return;
		}

		// Check if we're already at the first chunk
		if (currentIndex === 0) {
			// Already at the first diff, play sound and do nothing
			callbacks?.playInvalidSound();
			return;
		}

		// Jump to first chunk
		diffStore.setCurrentChunkIndex(0);
		const chunk = chunks[0];
		callbacks?.scrollToLine(chunk.startIndex, 0);
	}

	// Jump to last diff
	function jumpToLastDiff(): void {
		const chunks = get(diffChunks);
		const currentIndex = get(diffStore).currentChunkIndex;

		if (!chunks.length) {
			return;
		}

		const lastIndex = chunks.length - 1;

		// Check if we're already at the last chunk
		if (currentIndex === lastIndex) {
			// Already at the last diff, play sound and do nothing
			callbacks?.playInvalidSound();
			return;
		}

		// Jump to last chunk
		diffStore.setCurrentChunkIndex(lastIndex);
		const chunk = chunks[lastIndex];
		callbacks?.scrollToLine(chunk.startIndex, lastIndex);
	}

	// Jump to previous diff
	function jumpToPrevDiff(): void {
		const chunks = get(diffChunks);
		const currentIndex = get(diffStore).currentChunkIndex;

		if (!chunks.length) {
			return;
		}

		// Check if we're at the first chunk
		if (currentIndex === 0) {
			// Already at the first diff, play sound and do nothing
			callbacks?.playInvalidSound();
			return;
		}

		// Find the previous chunk
		let prevChunkIndex = -1;
		if (currentIndex === -1) {
			// No current chunk, jump to last
			prevChunkIndex = chunks.length - 1;
		} else {
			// Go to previous chunk
			prevChunkIndex = currentIndex - 1;
		}

		diffStore.setCurrentChunkIndex(prevChunkIndex);
		const chunk = chunks[prevChunkIndex];
		callbacks?.scrollToLine(chunk.startIndex, prevChunkIndex);
	}

	// Navigate after a copy operation
	function navigateAfterCopy(
		oldChunkIndex: number,
		oldTotalChunks: number,
	): void {
		const chunks = get(diffChunks);

		// If there are no more diff chunks, nothing to do
		if (!chunks || chunks.length === 0) {
			diffStore.setCurrentChunkIndex(-1);
			return;
		}

		// Check if the number of chunks decreased (chunk was removed)
		const chunksRemoved = oldTotalChunks - chunks.length;

		if (chunksRemoved > 0) {
			// Chunk was removed, stay at same index (which moves us forward)
			// unless we're now past the end
			if (oldChunkIndex >= chunks.length) {
				// We were at or past the last chunk, wrap to first
				diffStore.setCurrentChunkIndex(0);
			} else {
				// Stay at same index (effectively moving forward)
				diffStore.setCurrentChunkIndex(oldChunkIndex);
			}
		} else {
			// No chunks removed (e.g., modified chunk was copied)
			// Move to next chunk
			if (oldChunkIndex >= chunks.length - 1) {
				// We were at the last chunk, wrap to first
				diffStore.setCurrentChunkIndex(0);
			} else {
				// Move to next chunk
				diffStore.setCurrentChunkIndex(oldChunkIndex + 1);
			}
		}

		// Scroll to the selected chunk after a delay to ensure DOM updates
		setTimeout(() => {
			const currentChunks = get(diffChunks);
			const currentIndex = get(diffStore).currentChunkIndex;
			if (currentChunks[currentIndex]) {
				callbacks?.scrollToLine(
					currentChunks[currentIndex].startIndex,
					currentIndex,
				);
			}
		}, 150);
	}

	// Set callbacks for navigation
	function setCallbacks(newCallbacks: NavigationCallbacks): void {
		callbacks = newCallbacks;
	}

	// Get current navigation state
	function getState() {
		const chunks = get(diffChunks);
		const currentIndex = get(diffStore).currentChunkIndex;

		return {
			hasChunks: chunks.length > 0,
			currentIndex,
			isFirstChunk: currentIndex === 0,
			isLastChunk: currentIndex === chunks.length - 1,
			canNavigateNext: chunks.length > 0 && currentIndex < chunks.length - 1,
			canNavigatePrev: chunks.length > 0 && currentIndex > 0,
		};
	}

	return {
		jumpToNextDiff,
		jumpToPrevDiff,
		jumpToFirstDiff,
		jumpToLastDiff,
		navigateAfterCopy,
		setCallbacks,
		getState,
	};
}

export const navigationStore = createNavigationStore();

// Derived store for navigation state
export const navigationState = derived(
	[diffStore, diffChunks],
	([$diffStore, $chunks]) => {
		const currentIndex = $diffStore.currentChunkIndex;
		return {
			hasChunks: $chunks.length > 0,
			currentIndex,
			isFirstChunk: currentIndex === 0,
			isLastChunk: currentIndex === $chunks.length - 1,
			canNavigateNext: $chunks.length > 0 && currentIndex < $chunks.length - 1,
			canNavigatePrev: $chunks.length > 0 && currentIndex > 0,
			canNavigateFirst: $chunks.length > 0 && currentIndex !== 0,
			canNavigateLast:
				$chunks.length > 0 && currentIndex !== $chunks.length - 1,
		};
	},
);

// Auto-update menu items when navigation state changes
navigationState.subscribe(($navState) => {
	UpdateDiffNavigationMenuItems(
		$navState.canNavigatePrev,
		$navState.canNavigateNext,
		$navState.canNavigateFirst,
		$navState.canNavigateLast,
	);
});
