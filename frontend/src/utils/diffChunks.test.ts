import { describe, expect, it } from "vitest";
import type { HighlightedDiffLine } from "../types/diff";
import { calculateDiffChunks } from "./diffChunks";

describe("calculateDiffChunks", () => {
	it("should return empty array for empty input", () => {
		expect(calculateDiffChunks([])).toEqual([]);
	});

	it("should return empty array for null input", () => {
		// Testing null input - TypeScript will catch this in production
		expect(
			calculateDiffChunks(null as unknown as HighlightedDiffLine[]),
		).toEqual([]);
	});

	it("should return empty array for file with only same lines", () => {
		const lines: HighlightedDiffLine[] = [
			{ type: "same", leftLine: "line1", rightLine: "line1" },
			{ type: "same", leftLine: "line2", rightLine: "line2" },
			{ type: "same", leftLine: "line3", rightLine: "line3" },
		] as HighlightedDiffLine[];

		expect(calculateDiffChunks(lines)).toEqual([]);
	});

	it("should identify single diff chunk", () => {
		const lines: HighlightedDiffLine[] = [
			{ type: "same", leftLine: "line1", rightLine: "line1" },
			{ type: "added", leftLine: "", rightLine: "added" },
			{ type: "same", leftLine: "line3", rightLine: "line3" },
		] as HighlightedDiffLine[];

		expect(calculateDiffChunks(lines)).toEqual([
			{ startIndex: 1, endIndex: 1 },
		]);
	});

	it("should group consecutive diff lines into single chunk", () => {
		const lines: HighlightedDiffLine[] = [
			{ type: "same", leftLine: "line1", rightLine: "line1" },
			{ type: "removed", leftLine: "removed1", rightLine: "" },
			{ type: "removed", leftLine: "removed2", rightLine: "" },
			{ type: "added", leftLine: "", rightLine: "added1" },
			{ type: "added", leftLine: "", rightLine: "added2" },
			{ type: "same", leftLine: "line6", rightLine: "line6" },
		] as HighlightedDiffLine[];

		expect(calculateDiffChunks(lines)).toEqual([
			{ startIndex: 1, endIndex: 4 },
		]);
	});

	it("should identify multiple separate diff chunks", () => {
		const lines: HighlightedDiffLine[] = [
			{ type: "same", leftLine: "line1", rightLine: "line1" },
			{ type: "modified", leftLine: "old", rightLine: "new" },
			{ type: "same", leftLine: "line3", rightLine: "line3" },
			{ type: "same", leftLine: "line4", rightLine: "line4" },
			{ type: "added", leftLine: "", rightLine: "added" },
			{ type: "same", leftLine: "line6", rightLine: "line6" },
		] as HighlightedDiffLine[];

		expect(calculateDiffChunks(lines)).toEqual([
			{ startIndex: 1, endIndex: 1 },
			{ startIndex: 4, endIndex: 4 },
		]);
	});

	it("should handle diff at start of file", () => {
		const lines: HighlightedDiffLine[] = [
			{ type: "added", leftLine: "", rightLine: "added1" },
			{ type: "added", leftLine: "", rightLine: "added2" },
			{ type: "same", leftLine: "line3", rightLine: "line3" },
		] as HighlightedDiffLine[];

		expect(calculateDiffChunks(lines)).toEqual([
			{ startIndex: 0, endIndex: 1 },
		]);
	});

	it("should handle diff at end of file", () => {
		const lines: HighlightedDiffLine[] = [
			{ type: "same", leftLine: "line1", rightLine: "line1" },
			{ type: "removed", leftLine: "removed", rightLine: "" },
			{ type: "added", leftLine: "", rightLine: "added" },
		] as HighlightedDiffLine[];

		expect(calculateDiffChunks(lines)).toEqual([
			{ startIndex: 1, endIndex: 2 },
		]);
	});

	it("should handle file with all diff lines", () => {
		const lines: HighlightedDiffLine[] = [
			{ type: "removed", leftLine: "removed1", rightLine: "" },
			{ type: "added", leftLine: "", rightLine: "added1" },
			{ type: "modified", leftLine: "old", rightLine: "new" },
		] as HighlightedDiffLine[];

		expect(calculateDiffChunks(lines)).toEqual([
			{ startIndex: 0, endIndex: 2 },
		]);
	});
});
