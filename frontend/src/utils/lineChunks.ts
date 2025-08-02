import type { HighlightedDiffLine, LineChunk } from "../types/diff";

/**
 * Detects line chunks by grouping consecutive lines of the same type.
 * This is different from diffChunks which groups consecutive non-"same" lines.
 *
 * @param lines - Array of highlighted diff lines
 * @returns Array of line chunks with type information
 */
export function detectLineChunks(lines: HighlightedDiffLine[]): LineChunk[] {
	const chunks: LineChunk[] = [];
	let currentChunk: LineChunk | null = null;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (!currentChunk || currentChunk.type !== line.type) {
			// Start a new chunk
			if (currentChunk) {
				chunks.push(currentChunk);
			}
			currentChunk = {
				startIndex: i,
				endIndex: i,
				type: line.type,
				lines: 1,
			};
		} else {
			// Continue current chunk
			currentChunk.endIndex = i;
			currentChunk.lines++;
		}
	}

	// Don't forget the last chunk
	if (currentChunk) {
		chunks.push(currentChunk);
	}

	return chunks;
}
