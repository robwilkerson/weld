/**
 * Diff-related utility functions
 */

import type { DiffLine, DiffResult } from "../../wailsjs/go/main/App";

/**
 * Gets CSS class name for diff line type
 */
export function getLineClass(type: string): string {
	switch (type) {
		case "added":
			return "line-added";
		case "removed":
			return "line-removed";
		case "modified":
			return "line-modified";
		default:
			return "line-same";
	}
}

/**
 * Calculates width for line numbers based on max line number
 */
export function getLineNumberWidth(diffResult: DiffResult | null): string {
	if (!diffResult || !diffResult.lines.length) return "32px";

	const maxLineNumber = Math.max(
		...diffResult.lines.map((line: DiffLine) =>
			Math.max(line.leftNumber || 0, line.rightNumber || 0),
		),
	);

	const digits = Math.max(2, maxLineNumber.toString().length);
	const width = digits * 6 + 20; // ~6px per digit + 20px padding (15px left + 5px right)

	return `${width}px`;
}

/**
 * Escapes HTML characters in text
 */
export function escapeHtml(text: string): string {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

/**
 * Gets display path for file - shows relative path if files share a common directory
 */
export function getDisplayPath(
	leftPath: string,
	rightPath: string,
	isLeft: boolean,
): string {
	const path = isLeft ? leftPath : rightPath;

	// Find common directory prefix
	const leftParts = leftPath.split("/");
	const rightParts = rightPath.split("/");

	let commonPrefixLength = 0;
	for (
		let i = 0;
		i < Math.min(leftParts.length - 1, rightParts.length - 1);
		i++
	) {
		if (leftParts[i] === rightParts[i]) {
			commonPrefixLength++;
		} else {
			break;
		}
	}

	// If files are in same directory, just show filename
	if (
		commonPrefixLength === leftParts.length - 1 &&
		commonPrefixLength === rightParts.length - 1
	) {
		return path.split("/").pop() || path;
	}

	// Otherwise show relative path from common prefix
	if (commonPrefixLength > 0) {
		const parts = path.split("/");
		return parts.slice(commonPrefixLength).join("/");
	}

	// No common prefix, show full path
	return path;
}

/**
 * Computes inline diff highlights for modified lines
 * @param left - Left side text
 * @param right - Right side text
 * @param enableHighlighting - Whether to apply inline highlighting (default: false)
 */
export function computeInlineDiff(
	left: string,
	right: string,
	enableHighlighting: boolean = false,
): { left: string; right: string } {
	// For very different strings, just return escaped versions
	if (Math.abs(left.length - right.length) > left.length * 0.5) {
		return { left: escapeHtml(left), right: escapeHtml(right) };
	}

	// Find common prefix
	let prefixLen = 0;
	while (
		prefixLen < left.length &&
		prefixLen < right.length &&
		left[prefixLen] === right[prefixLen]
	) {
		prefixLen++;
	}

	// Find common suffix
	let suffixLen = 0;
	while (
		suffixLen < left.length - prefixLen &&
		suffixLen < right.length - prefixLen &&
		left[left.length - 1 - suffixLen] === right[right.length - 1 - suffixLen]
	) {
		suffixLen++;
	}

	// Extract the different parts
	const leftPrefix = left.substring(0, prefixLen);
	const leftDiff = left.substring(prefixLen, left.length - suffixLen);
	const leftSuffix = left.substring(left.length - suffixLen);

	const rightPrefix = right.substring(0, prefixLen);
	const rightDiff = right.substring(prefixLen, right.length - suffixLen);
	const rightSuffix = right.substring(right.length - suffixLen);

	if (enableHighlighting) {
		// Build highlighted strings with inline diff highlighting
		const leftHighlighted =
			escapeHtml(leftPrefix) +
			(leftDiff
				? `<span class="inline-diff-highlight">${escapeHtml(leftDiff)}</span>`
				: "") +
			escapeHtml(leftSuffix);

		const rightHighlighted =
			escapeHtml(rightPrefix) +
			(rightDiff
				? `<span class="inline-diff-highlight">${escapeHtml(rightDiff)}</span>`
				: "") +
			escapeHtml(rightSuffix);

		return { left: leftHighlighted, right: rightHighlighted };
	} else {
		// Build strings without inline highlighting
		const leftHighlighted =
			escapeHtml(leftPrefix) +
			(leftDiff ? escapeHtml(leftDiff) : "") +
			escapeHtml(leftSuffix);

		const rightHighlighted =
			escapeHtml(rightPrefix) +
			(rightDiff ? escapeHtml(rightDiff) : "") +
			escapeHtml(rightSuffix);

		return { left: leftHighlighted, right: rightHighlighted };
	}
}
