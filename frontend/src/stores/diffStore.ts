import { derived, get, writable } from "svelte/store";
import type {
	DiffResult,
	HighlightedDiffResult,
	LineChunk,
} from "../types/diff";
import { getLineNumberWidth } from "../utils/diff";
import { calculateDiffChunks } from "../utils/diffChunks";

interface DiffState {
	rawDiff: DiffResult | null;
	highlightedDiff: HighlightedDiffResult | null;
	currentChunkIndex: number;
	lineChunks: LineChunk[];
}

function createDiffStore() {
	const { subscribe, set, update } = writable<DiffState>({
		rawDiff: null,
		highlightedDiff: null,
		currentChunkIndex: -1,
		lineChunks: [],
	});

	return {
		subscribe,

		// Set the raw diff result from backend
		setRawDiff(diff: DiffResult | null): void {
			update((state) => ({
				...state,
				rawDiff: diff,
				// Reset current chunk when setting new diff
				currentChunkIndex: -1,
			}));
		},

		// Set the highlighted diff result
		setHighlightedDiff(diff: HighlightedDiffResult | null): void {
			update((state) => ({
				...state,
				highlightedDiff: diff,
			}));
		},

		// Set the current diff chunk index
		setCurrentChunkIndex(index: number): void {
			update((state) => ({
				...state,
				currentChunkIndex: index,
			}));
		},

		// Set line chunks
		setLineChunks(chunks: LineChunk[]): void {
			update((state) => ({
				...state,
				lineChunks: chunks,
			}));
		},

		// Navigate to next diff chunk
		goToNextChunk(): boolean {
			const state = get({ subscribe });
			const chunks = get(diffChunks);

			if (!chunks || chunks.length === 0) return false;

			const nextIndex = state.currentChunkIndex + 1;
			if (nextIndex >= chunks.length) return false;

			this.setCurrentChunkIndex(nextIndex);
			return true;
		},

		// Navigate to previous diff chunk
		goToPreviousChunk(): boolean {
			const state = get({ subscribe });
			const chunks = get(diffChunks);

			if (!chunks || chunks.length === 0) return false;

			const prevIndex = state.currentChunkIndex - 1;
			if (prevIndex < 0) return false;

			this.setCurrentChunkIndex(prevIndex);
			return true;
		},

		// Reset diff state
		clear(): void {
			set({
				rawDiff: null,
				highlightedDiff: null,
				currentChunkIndex: -1,
				lineChunks: [],
			});
		},

		// Get current state
		getState(): DiffState {
			return get({ subscribe });
		},
	};
}

export const diffStore = createDiffStore();

// Derived store for diff chunks
export const diffChunks = derived(diffStore, ($diffStore) => {
	if (!$diffStore.highlightedDiff) return [];
	return calculateDiffChunks($diffStore.highlightedDiff.lines);
});

// Derived store for line number width
export const lineNumberWidth = derived(diffStore, ($diffStore) =>
	getLineNumberWidth($diffStore.rawDiff),
);

// Derived store for navigation state
export const diffNavigation = derived(
	[diffStore, diffChunks],
	([$diffStore, $chunks]) => {
		const hasPrevDiff = $chunks.length > 0 && $diffStore.currentChunkIndex > 0;
		const hasNextDiff =
			$chunks.length > 0 && $diffStore.currentChunkIndex < $chunks.length - 1;
		const isFirstChunk = $diffStore.currentChunkIndex === 0;
		const isLastChunk = $diffStore.currentChunkIndex === $chunks.length - 1;
		const hasChunks = $chunks.length > 0;
		const currentChunk = $chunks[$diffStore.currentChunkIndex] || null;

		return {
			hasPrevDiff,
			hasNextDiff,
			isFirstChunk,
			isLastChunk,
			hasChunks,
			currentChunk,
			chunkCount: $chunks.length,
			currentIndex: $diffStore.currentChunkIndex,
		};
	},
);
