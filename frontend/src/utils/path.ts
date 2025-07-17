/**
 * Path manipulation utilities
 */

/**
 * Expands tilde (~) to home directory path
 */
export function expandTildePath(path: string): string {
	if (path.startsWith("~/")) {
		const home = process.env.HOME || process.env.USERPROFILE || "";
		return path.replace("~", home);
	}
	return path;
}

/**
 * Gets a display path for UI, truncating long paths
 */
export function getDisplayPath(
	leftPath: string,
	rightPath: string,
	isLeft: boolean,
): string {
	const targetPath = isLeft ? leftPath : rightPath;
	const otherPath = isLeft ? rightPath : leftPath;

	if (!targetPath || !otherPath) return targetPath || "";

	const targetSegments = targetPath.split("/").filter((s) => s !== "");

	if (targetSegments.length === 0) return targetPath;

	const totalSegmentsToShow = 4;

	if (targetSegments.length <= totalSegmentsToShow) {
		return targetSegments.join("/");
	}

	// Show the last 4 segments (3 directories + filename)
	const segments = targetSegments.slice(-totalSegmentsToShow);
	return `.../${segments.join("/")}`;
}

/**
 * Extracts filename from a path
 */
export function getDisplayFileName(filepath: string): string {
	return filepath.split("/").pop() || filepath;
}