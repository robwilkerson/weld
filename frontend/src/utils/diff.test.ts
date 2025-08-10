import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { DiffResult } from "../types/diff";
import {
	computeInlineDiff,
	escapeHtml,
	getDisplayPath,
	getLineClass,
	getLineNumberWidth,
} from "./diff";

// Mock document.createElement for escapeHtml function
beforeAll(() => {
	// @ts-expect-error - Mocking document for testing
	global.document = {
		createElement: vi.fn(() => ({
			textContent: "",
			get innerHTML() {
				// Simple HTML escaping
				return this.textContent
					.replace(/&/g, "&amp;")
					.replace(/</g, "&lt;")
					.replace(/>/g, "&gt;");
			},
			set innerHTML(value: string) {
				this.textContent = value;
			},
		})),
	};
});

afterAll(() => {
	// @ts-expect-error - Cleaning up mock
	delete global.document;
});

describe("diff utilities", () => {
	describe("getDisplayPath", () => {
		it("returns just filename when files are in same directory", () => {
			const left = "/home/user/project/file1.js";
			const right = "/home/user/project/file2.js";

			expect(getDisplayPath(left, right, true)).toBe("file1.js");
			expect(getDisplayPath(left, right, false)).toBe("file2.js");
		});

		it("returns relative path from common prefix", () => {
			const left = "/home/user/project/src/file1.js";
			const right = "/home/user/project/tests/file2.js";

			expect(getDisplayPath(left, right, true)).toBe("src/file1.js");
			expect(getDisplayPath(left, right, false)).toBe("tests/file2.js");
		});

		it("returns full path when no common prefix", () => {
			const left = "/home/user/file1.js";
			const right = "/var/log/file2.js";

			// When no common prefix, returns path without leading slash
			expect(getDisplayPath(left, right, true)).toBe("home/user/file1.js");
			expect(getDisplayPath(left, right, false)).toBe("var/log/file2.js");
		});

		it("returns path when common prefix check stops early", () => {
			// Edge case where loop exits due to length mismatch before finding difference
			const left = "a/file1.js";
			const right = "b/c/d/file2.js";

			expect(getDisplayPath(left, right, true)).toBe("a/file1.js");
			expect(getDisplayPath(left, right, false)).toBe("b/c/d/file2.js");
		});

		it("handles Windows-style paths", () => {
			const left = "C:/Users/user/project/file1.js";
			const right = "C:/Users/user/project/file2.js";

			expect(getDisplayPath(left, right, true)).toBe("file1.js");
			expect(getDisplayPath(left, right, false)).toBe("file2.js");
		});

		it("handles paths with different depths", () => {
			const left = "/home/user/a.js";
			const right = "/home/user/deep/nested/path/b.js";

			expect(getDisplayPath(left, right, true)).toBe("a.js");
			expect(getDisplayPath(left, right, false)).toBe("deep/nested/path/b.js");
		});

		it("handles empty paths", () => {
			expect(getDisplayPath("", "", true)).toBe("");
			expect(getDisplayPath("file.js", "", false)).toBe("");
		});

		it("handles single file paths without directory", () => {
			expect(getDisplayPath("file1.js", "file2.js", true)).toBe("file1.js");
			expect(getDisplayPath("file1.js", "file2.js", false)).toBe("file2.js");
		});

		it("handles paths with trailing slashes", () => {
			const left = "/home/user/project/";
			const right = "/home/user/project/file.js";

			// Path with trailing slash returns as-is since it has no filename
			expect(getDisplayPath(left, right, true)).toBe("/home/user/project/");
			expect(getDisplayPath(left, right, false)).toBe("file.js");
		});

		it("handles deeply nested common paths", () => {
			const left = "/a/b/c/d/e/f/file1.js";
			const right = "/a/b/c/d/e/g/file2.js";

			expect(getDisplayPath(left, right, true)).toBe("f/file1.js");
			expect(getDisplayPath(left, right, false)).toBe("g/file2.js");
		});

		it("handles root level files", () => {
			const left = "/file1.js";
			const right = "/file2.js";

			expect(getDisplayPath(left, right, true)).toBe("file1.js");
			expect(getDisplayPath(left, right, false)).toBe("file2.js");
		});
	});

	describe("computeInlineDiff edge cases", () => {
		it("handles strings with very different lengths (>50% difference)", () => {
			const left = "short";
			const right =
				"this is a much longer string that is more than 50% different";

			const result = computeInlineDiff(left, right, true);
			// Should just return escaped versions without highlighting
			expect(result.left).toBe("short");
			expect(result.right).toBe(escapeHtml(right));
			expect(result.left).not.toContain("inline-diff-highlight");
			expect(result.right).not.toContain("inline-diff-highlight");
		});

		it("handles strings with special HTML characters", () => {
			const left = "const a = <div>";
			const right = "const b = <div>";

			const result = computeInlineDiff(left, right, true);
			expect(result.left).toContain("&lt;div&gt;");
			expect(result.right).toContain("&lt;div&gt;");
			expect(result.left).toContain('inline-diff-highlight">a</span>');
			expect(result.right).toContain('inline-diff-highlight">b</span>');
		});

		it("handles strings with only prefix differences", () => {
			const left = "prefixA rest of the string";
			const right = "prefixB rest of the string";

			const result = computeInlineDiff(left, right, true);
			expect(result.left).toContain('inline-diff-highlight">A</span>');
			expect(result.right).toContain('inline-diff-highlight">B</span>');
		});

		it("handles strings with only suffix differences", () => {
			const left = "start of the string suffixA";
			const right = "start of the string suffixB";

			const result = computeInlineDiff(left, right, true);
			expect(result.left).toContain('inline-diff-highlight">A</span>');
			expect(result.right).toContain('inline-diff-highlight">B</span>');
		});

		it("handles empty diff sections", () => {
			const left = "prefix suffix";
			const right = "prefixsuffix"; // Removed space

			const result = computeInlineDiff(left, right, true);
			expect(result.left).toContain('inline-diff-highlight"> </span>');
			expect(result.right).toBe("prefixsuffix"); // No highlight when diff is empty
		});

		it("handles completely identical strings with highlighting enabled", () => {
			const left = "identical string";
			const right = "identical string";

			const result = computeInlineDiff(left, right, true);
			expect(result.left).toBe("identical string");
			expect(result.right).toBe("identical string");
			expect(result.left).not.toContain("inline-diff-highlight");
		});

		it("escapes HTML in all parts of the string", () => {
			const left = "<tag>prefix</tag> <diff1> <tag>suffix</tag>";
			const right = "<tag>prefix</tag> <diff2> <tag>suffix</tag>";

			const result = computeInlineDiff(left, right, true);
			expect(result.left).not.toContain("<tag>");
			expect(result.right).not.toContain("<tag>");
			expect(result.left).toContain("&lt;tag&gt;");
			expect(result.right).toContain("&lt;tag&gt;");
		});
	});

	describe("getLineNumberWidth", () => {
		it("handles null diff result", () => {
			expect(getLineNumberWidth(null)).toBe("32px");
		});

		it("handles empty diff result", () => {
			const diff: DiffResult = { lines: [] };
			expect(getLineNumberWidth(diff)).toBe("32px");
		});

		it("calculates correct width for single digit line numbers", () => {
			const diff: DiffResult = {
				lines: [
					{
						type: "same",
						leftNumber: 1,
						rightNumber: 1,
						leftLine: "",
						rightLine: "",
					},
					{
						type: "same",
						leftNumber: 9,
						rightNumber: 9,
						leftLine: "",
						rightLine: "",
					},
				],
			};
			// 2 digits minimum * 6px + 20px padding = 32px
			expect(getLineNumberWidth(diff)).toBe("32px");
		});

		it("calculates correct width for multi-digit line numbers", () => {
			const diff: DiffResult = {
				lines: [
					{
						type: "same",
						leftNumber: 99,
						rightNumber: 99,
						leftLine: "",
						rightLine: "",
					},
					{
						type: "same",
						leftNumber: 100,
						rightNumber: 100,
						leftLine: "",
						rightLine: "",
					},
				],
			};
			// 3 digits * 6px + 20px padding = 38px
			expect(getLineNumberWidth(diff)).toBe("38px");
		});

		it("handles null line numbers correctly", () => {
			const diff: DiffResult = {
				lines: [
					{
						type: "added",
						leftNumber: null,
						rightNumber: 50,
						leftLine: "",
						rightLine: "new",
					},
					{
						type: "removed",
						leftNumber: 100,
						rightNumber: null,
						leftLine: "old",
						rightLine: "",
					},
				],
			};
			// 3 digits * 6px + 20px padding = 38px
			expect(getLineNumberWidth(diff)).toBe("38px");
		});
	});

	describe("getLineClass", () => {
		it("returns correct class for each line type", () => {
			expect(getLineClass("same")).toBe("line-same");
			expect(getLineClass("added")).toBe("line-added");
			expect(getLineClass("removed")).toBe("line-removed");
			expect(getLineClass("modified")).toBe("line-modified");
		});

		it("handles undefined type", () => {
			// @ts-expect-error - Testing edge case
			expect(getLineClass(undefined)).toBe("line-same");
		});

		it("handles unknown type", () => {
			expect(getLineClass("unknown")).toBe("line-same");
		});
	});

	describe("escapeHtml", () => {
		it("escapes common HTML entities", () => {
			expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
			// innerHTML doesn't escape quotes by default
			expect(escapeHtml('"text"')).toBe('"text"');
			expect(escapeHtml("'text'")).toBe("'text'");
			expect(escapeHtml("&amp;")).toBe("&amp;amp;");
		});

		it("handles empty string", () => {
			expect(escapeHtml("")).toBe("");
		});

		it("handles strings without special characters", () => {
			expect(escapeHtml("normal text")).toBe("normal text");
		});

		it("escapes multiple occurrences", () => {
			expect(escapeHtml("<tag><tag>")).toBe("&lt;tag&gt;&lt;tag&gt;");
		});
	});
});
