import type { HighlightedDiffLine } from "../types/diff";

export interface DiffChunk {
	startIndex: number;
	endIndex: number;
}

/**
 * Calculates diff chunks from highlighted diff lines.
 * Groups consecutive lines that are not "same" into chunks.
 *
 * @param lines - Array of highlighted diff lines
 * @returns Array of diff chunks with start and end indices
 */
export function calculateDiffChunks(lines: HighlightedDiffLine[]): DiffChunk[] {
	if (!lines || lines.length === 0) {
		return [];
	}

	const chunks: DiffChunk[] = [];
	let inDiff = false;
	let startIndex = -1;

	lines.forEach((line, index) => {
		if (line.type !== "same") {
			if (!inDiff) {
				// Start of a new diff chunk
				inDiff = true;
				startIndex = index;
			}
		} else {
			if (inDiff) {
				// End of diff chunk
				chunks.push({ startIndex, endIndex: index - 1 });
				inDiff = false;
			}
		}
	});

	// Handle case where file ends with a diff
	if (inDiff && startIndex !== -1) {
		chunks.push({
			startIndex,
			endIndex: lines.length - 1,
		});
	}

	return chunks;
}
