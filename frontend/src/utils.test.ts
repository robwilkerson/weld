import { describe, expect, it, vi } from "vitest";
import {
	computeInlineDiff,
	escapeHtml,
	getLineClass,
	getLineNumberWidth,
} from "./utils/diff.js";
import {
	getModifierKeyName,
	handleKeydown,
	isMacOS,
} from "./utils/keyboard.js";
import {
	getLanguageFromExtension,
	getLanguageFromFilename,
} from "./utils/language.js";
// Import actual utility functions
import {
	expandTildePath,
	getDisplayFileName,
	getDisplayPath,
} from "./utils/path.js";

describe("Path Utilities", () => {
	describe("expandTildePath", () => {
		it("should expand tilde to home directory", () => {
			const originalEnv = process.env.HOME;
			process.env.HOME = "/Users/testuser";

			const result = expandTildePath("~/Documents/test.txt");
			expect(result).toBe("/Users/testuser/Documents/test.txt");

			process.env.HOME = originalEnv;
		});

		it("should return path unchanged if no tilde", () => {
			const result = expandTildePath("/absolute/path/test.txt");
			expect(result).toBe("/absolute/path/test.txt");
		});

		it("should handle empty paths", () => {
			const result = expandTildePath("");
			expect(result).toBe("");
		});
	});

	describe("getDisplayPath", () => {
		it("should return original path if short", () => {
			const result = getDisplayPath("/short/path.txt", "/other/path.txt", true);
			expect(result).toBe("short/path.txt");
		});

		it("should truncate long paths", () => {
			const longPath = "/very/long/path/to/some/deep/directory/file.txt";
			const result = getDisplayPath(longPath, "/other/path.txt", true);
			expect(result).toBe(".../some/deep/directory/file.txt");
		});

		it("should handle empty paths", () => {
			const result = getDisplayPath("", "/other/path.txt", true);
			expect(result).toBe("");
		});

		it("should handle paths with exactly 4 segments", () => {
			const result = getDisplayPath("/a/b/c/file.txt", "/other/path.txt", true);
			expect(result).toBe("a/b/c/file.txt");
		});

		it("should handle right file selection", () => {
			const result = getDisplayPath(
				"/left/path.txt",
				"/very/long/right/path/file.txt",
				false,
			);
			expect(result).toBe(".../long/right/path/file.txt");
		});
	});

	describe("getDisplayFileName", () => {
		it("should extract filename from path", () => {
			const result = getDisplayFileName("/path/to/file.txt");
			expect(result).toBe("file.txt");
		});

		it("should handle paths with no slashes", () => {
			const result = getDisplayFileName("file.txt");
			expect(result).toBe("file.txt");
		});

		it("should handle empty paths", () => {
			const result = getDisplayFileName("");
			expect(result).toBe("");
		});
	});
});

describe("Diff Utilities", () => {
	describe("getLineClass", () => {
		it("should return correct CSS class for line types", () => {
			expect(getLineClass("added")).toBe("line-added");
			expect(getLineClass("removed")).toBe("line-removed");
			expect(getLineClass("modified")).toBe("line-modified");
			expect(getLineClass("same")).toBe("line-same");
			expect(getLineClass("unknown")).toBe("line-same");
		});
	});

	describe("getLineNumberWidth", () => {
		it("should calculate width based on max line number", () => {
			const mockDiffResult = {
				lines: [
					{ leftNumber: 1, rightNumber: 1, type: "same" },
					{ leftNumber: 99, rightNumber: 99, type: "same" },
					{ leftNumber: 100, rightNumber: 100, type: "same" },
				],
			};

			const result = getLineNumberWidth(mockDiffResult);
			expect(result).toBe("38px"); // 3 digits * 6 + 20 = 38px
		});

		it("should return default width for empty result", () => {
			expect(getLineNumberWidth(null)).toBe("32px");
			expect(getLineNumberWidth({ lines: [] })).toBe("32px");
		});

		it("should handle single digit line numbers", () => {
			const mockDiffResult = {
				lines: [
					{ leftNumber: 1, rightNumber: 1, type: "same" },
					{ leftNumber: 5, rightNumber: 5, type: "same" },
				],
			};

			const result = getLineNumberWidth(mockDiffResult);
			expect(result).toBe("32px"); // minimum 2 digits * 6 + 20 = 32px
		});
	});

	describe("escapeHtml", () => {
		it("should escape HTML characters", () => {
			expect(escapeHtml("<script>alert('xss')</script>")).toBe(
				"&lt;script&gt;alert('xss')&lt;/script&gt;",
			);
			expect(escapeHtml("Hello & goodbye")).toBe("Hello &amp; goodbye");
			// Note: textContent doesn't escape quotes, only innerHTML-specific characters
			expect(escapeHtml('"quoted"')).toBe('"quoted"');
		});

		it("should handle empty strings", () => {
			expect(escapeHtml("")).toBe("");
		});

		it("should handle regular text", () => {
			expect(escapeHtml("Hello world")).toBe("Hello world");
		});
	});

	describe("computeInlineDiff", () => {
		it("should highlight differences in similar strings when highlighting enabled", () => {
			const result = computeInlineDiff("const a = 1;", "const a = 2;", true);
			expect(result.left).toContain(
				'<span class="inline-diff-highlight">1</span>',
			);
			expect(result.right).toContain(
				'<span class="inline-diff-highlight">2</span>',
			);
		});

		it("should not highlight differences when highlighting disabled", () => {
			const result = computeInlineDiff("const a = 1;", "const a = 2;", false);
			expect(result.left).not.toContain('<span class="inline-diff-highlight">');
			expect(result.right).not.toContain(
				'<span class="inline-diff-highlight">',
			);
			expect(result.left).toBe("const a = 1;");
			expect(result.right).toBe("const a = 2;");
		});

		it("should handle completely different strings", () => {
			const result = computeInlineDiff("hello", "completely different text");
			// Very different strings (>50% length difference) return escaped versions
			expect(result.left).toBe("hello");
			expect(result.right).toBe("completely different text");
		});

		it("should handle identical strings", () => {
			const result = computeInlineDiff("same", "same");
			expect(result.left).toBe("same");
			expect(result.right).toBe("same");
		});

		it("should handle empty strings", () => {
			const result = computeInlineDiff("", "");
			expect(result.left).toBe("");
			expect(result.right).toBe("");
		});

		it("should handle default parameter for enableHighlighting", () => {
			const result = computeInlineDiff("const a = 1;", "const a = 2;"); // No third parameter
			expect(result.left).not.toContain('<span class="inline-diff-highlight">');
			expect(result.right).not.toContain(
				'<span class="inline-diff-highlight">',
			);
		});
	});
});

describe("Language Utilities", () => {
	describe("getLanguageFromExtension", () => {
		it("should detect common languages", () => {
			expect(getLanguageFromExtension("js")).toBe("javascript");
			expect(getLanguageFromExtension("ts")).toBe("typescript");
			expect(getLanguageFromExtension("py")).toBe("python");
			expect(getLanguageFromExtension("go")).toBe("go");
			expect(getLanguageFromExtension("java")).toBe("java");
		});

		it("should handle case insensitive extensions", () => {
			expect(getLanguageFromExtension("JS")).toBe("javascript");
			expect(getLanguageFromExtension("TS")).toBe("typescript");
		});

		it("should return default for unknown extensions", () => {
			expect(getLanguageFromExtension("unknown")).toBe("text");
			expect(getLanguageFromExtension("")).toBe("text");
		});
	});

	describe("getLanguageFromFilename", () => {
		it("should detect language from file extension", () => {
			expect(getLanguageFromFilename("test.js")).toBe("javascript");
			expect(getLanguageFromFilename("test.ts")).toBe("typescript");
			expect(getLanguageFromFilename("test.py")).toBe("python");
			expect(getLanguageFromFilename("test.go")).toBe("go");
		});

		it("should handle files without extensions", () => {
			expect(getLanguageFromFilename("README")).toBe("text");
			expect(getLanguageFromFilename("Dockerfile")).toBe("text");
		});

		it("should handle empty filenames", () => {
			expect(getLanguageFromFilename("")).toBe("markup");
		});
	});
});

describe("Keyboard Utilities", () => {
	describe("handleKeydown", () => {
		it("should handle Ctrl+S on Windows/Linux", () => {
			const mockSaveLeftFile = vi.fn();
			const mockSaveRightFile = vi.fn();
			const leftFilePath = "/path/to/left.txt";
			const rightFilePath = "/path/to/right.txt";

			// Mock Windows platform
			Object.defineProperty(navigator, "platform", {
				value: "Win32",
				writable: true,
			});

			const mockEvent = {
				key: "s",
				ctrlKey: true,
				metaKey: false,
				preventDefault: vi.fn(),
				// biome-ignore lint/suspicious/noExplicitAny: Mock object for testing
			} as any;

			handleKeydown(
				mockEvent,
				{
					saveLeftFile: mockSaveLeftFile,
					saveRightFile: mockSaveRightFile,
				},
				leftFilePath,
				rightFilePath,
			);

			expect(mockEvent.preventDefault).toHaveBeenCalled();
			expect(mockSaveLeftFile).toHaveBeenCalled();
			expect(mockSaveRightFile).toHaveBeenCalled();
		});

		it("should handle Cmd+S on Mac", () => {
			const mockSaveLeftFile = vi.fn();
			const mockSaveRightFile = vi.fn();
			const leftFilePath = "/path/to/left.txt";
			const rightFilePath = "/path/to/right.txt";

			// Mock Mac platform
			Object.defineProperty(navigator, "platform", {
				value: "MacIntel",
				writable: true,
			});

			const mockEvent = {
				key: "s",
				ctrlKey: false,
				metaKey: true,
				preventDefault: vi.fn(),
				// biome-ignore lint/suspicious/noExplicitAny: Mock object for testing
			} as any;

			handleKeydown(
				mockEvent,
				{
					saveLeftFile: mockSaveLeftFile,
					saveRightFile: mockSaveRightFile,
				},
				leftFilePath,
				rightFilePath,
			);

			expect(mockEvent.preventDefault).toHaveBeenCalled();
			expect(mockSaveLeftFile).toHaveBeenCalled();
			expect(mockSaveRightFile).toHaveBeenCalled();
		});

		it("should not handle other key combinations", () => {
			const mockSaveLeftFile = vi.fn();
			const mockSaveRightFile = vi.fn();

			const mockEvent = {
				key: "a",
				ctrlKey: true,
				metaKey: false,
				preventDefault: vi.fn(),
				// biome-ignore lint/suspicious/noExplicitAny: Mock object for testing
			} as any;

			handleKeydown(
				mockEvent,
				{
					saveLeftFile: mockSaveLeftFile,
					saveRightFile: mockSaveRightFile,
				},
				"/path/left.txt",
				"/path/right.txt",
			);

			// Should not prevent default or save for other keys
			expect(mockEvent.preventDefault).not.toHaveBeenCalled();
			expect(mockSaveLeftFile).not.toHaveBeenCalled();
			expect(mockSaveRightFile).not.toHaveBeenCalled();
		});

		it("should handle Shift+L for copy right to left", () => {
			const mockCopyRightToLeft = vi.fn();
			
			const mockEvent = {
				key: "L",
				shiftKey: true,
				ctrlKey: false,
				metaKey: false,
				altKey: false,
				preventDefault: vi.fn(),
			} as any;

			handleKeydown(
				mockEvent,
				{
					saveLeftFile: vi.fn(),
					saveRightFile: vi.fn(),
					copyCurrentDiffLeftToRight: mockCopyRightToLeft,
				},
				"/path/left.txt",
				"/path/right.txt",
			);

			expect(mockEvent.preventDefault).toHaveBeenCalled();
			expect(mockCopyRightToLeft).toHaveBeenCalled();
		});

		it("should handle Shift+H for copy left to right", () => {
			const mockCopyLeftToRight = vi.fn();
			
			const mockEvent = {
				key: "H",
				shiftKey: true,
				ctrlKey: false,
				metaKey: false,
				altKey: false,
				preventDefault: vi.fn(),
			} as any;

			handleKeydown(
				mockEvent,
				{
					saveLeftFile: vi.fn(),
					saveRightFile: vi.fn(),
					copyCurrentDiffRightToLeft: mockCopyLeftToRight,
				},
				"/path/left.txt",
				"/path/right.txt",
			);

			expect(mockEvent.preventDefault).toHaveBeenCalled();
			expect(mockCopyLeftToRight).toHaveBeenCalled();
		});

		it("should handle ArrowDown for jump to next diff", () => {
			const mockJumpToNext = vi.fn();
			const mockJumpToPrev = vi.fn();
			
			const mockEvent = {
				key: "ArrowDown",
				preventDefault: vi.fn(),
			} as any;

			handleKeydown(
				mockEvent,
				{
					saveLeftFile: vi.fn(),
					saveRightFile: vi.fn(),
					jumpToNextDiff: mockJumpToNext,
					jumpToPrevDiff: mockJumpToPrev,
				},
				"/path/left.txt",
				"/path/right.txt",
			);

			expect(mockEvent.preventDefault).toHaveBeenCalled();
			expect(mockJumpToNext).toHaveBeenCalled();
			expect(mockJumpToPrev).not.toHaveBeenCalled();
		});

		it("should handle j key for jump to next diff", () => {
			const mockJumpToNext = vi.fn();
			const mockJumpToPrev = vi.fn();
			
			const mockEvent = {
				key: "j",
				preventDefault: vi.fn(),
			} as any;

			handleKeydown(
				mockEvent,
				{
					saveLeftFile: vi.fn(),
					saveRightFile: vi.fn(),
					jumpToNextDiff: mockJumpToNext,
					jumpToPrevDiff: mockJumpToPrev,
				},
				"/path/left.txt",
				"/path/right.txt",
			);

			expect(mockEvent.preventDefault).toHaveBeenCalled();
			expect(mockJumpToNext).toHaveBeenCalled();
		});

		it("should handle ArrowUp for jump to previous diff", () => {
			const mockJumpToNext = vi.fn();
			const mockJumpToPrev = vi.fn();
			
			const mockEvent = {
				key: "ArrowUp",
				preventDefault: vi.fn(),
			} as any;

			handleKeydown(
				mockEvent,
				{
					saveLeftFile: vi.fn(),
					saveRightFile: vi.fn(),
					jumpToNextDiff: mockJumpToNext,
					jumpToPrevDiff: mockJumpToPrev,
				},
				"/path/left.txt",
				"/path/right.txt",
			);

			expect(mockEvent.preventDefault).toHaveBeenCalled();
			expect(mockJumpToPrev).toHaveBeenCalled();
			expect(mockJumpToNext).not.toHaveBeenCalled();
		});

		it("should handle k key for jump to previous diff", () => {
			const mockJumpToNext = vi.fn();
			const mockJumpToPrev = vi.fn();
			
			const mockEvent = {
				key: "k",
				preventDefault: vi.fn(),
			} as any;

			handleKeydown(
				mockEvent,
				{
					saveLeftFile: vi.fn(),
					saveRightFile: vi.fn(),
					jumpToNextDiff: mockJumpToNext,
					jumpToPrevDiff: mockJumpToPrev,
				},
				"/path/left.txt",
				"/path/right.txt",
			);

			expect(mockEvent.preventDefault).toHaveBeenCalled();
			expect(mockJumpToPrev).toHaveBeenCalled();
		});

		it("should handle Ctrl+Z for undo on Windows/Linux", () => {
			const mockUndo = vi.fn();
			
			// Mock Windows platform
			Object.defineProperty(navigator, "platform", {
				value: "Win32",
				writable: true,
			});

			const mockEvent = {
				key: "z",
				ctrlKey: true,
				metaKey: false,
				preventDefault: vi.fn(),
			} as any;

			handleKeydown(
				mockEvent,
				{
					saveLeftFile: vi.fn(),
					saveRightFile: vi.fn(),
					undoLastChange: mockUndo,
				},
				"/path/left.txt",
				"/path/right.txt",
			);

			expect(mockEvent.preventDefault).toHaveBeenCalled();
			expect(mockUndo).toHaveBeenCalled();
		});

		it("should handle Cmd+Z for undo on Mac", () => {
			const mockUndo = vi.fn();
			
			// Mock Mac platform
			Object.defineProperty(navigator, "platform", {
				value: "MacIntel",
				writable: true,
			});

			const mockEvent = {
				key: "z",
				ctrlKey: false,
				metaKey: true,
				preventDefault: vi.fn(),
			} as any;

			handleKeydown(
				mockEvent,
				{
					saveLeftFile: vi.fn(),
					saveRightFile: vi.fn(),
					undoLastChange: mockUndo,
				},
				"/path/left.txt",
				"/path/right.txt",
			);

			expect(mockEvent.preventDefault).toHaveBeenCalled();
			expect(mockUndo).toHaveBeenCalled();
		});

		it("should handle u key for undo", () => {
			const mockUndo = vi.fn();
			
			const mockEvent = {
				key: "u",
				preventDefault: vi.fn(),
			} as any;

			handleKeydown(
				mockEvent,
				{
					saveLeftFile: vi.fn(),
					saveRightFile: vi.fn(),
					undoLastChange: mockUndo,
				},
				"/path/left.txt",
				"/path/right.txt",
			);

			expect(mockEvent.preventDefault).toHaveBeenCalled();
			expect(mockUndo).toHaveBeenCalled();
		});

		it("should not call navigation callbacks if they are not provided", () => {
			const mockEvent = {
				key: "j",
				preventDefault: vi.fn(),
			} as any;

			handleKeydown(
				mockEvent,
				{
					saveLeftFile: vi.fn(),
					saveRightFile: vi.fn(),
					// No navigation callbacks provided
				},
				"/path/left.txt",
				"/path/right.txt",
			);

			// Should not prevent default when callbacks are missing
			expect(mockEvent.preventDefault).not.toHaveBeenCalled();
		});

		it("should not save files when paths are empty", () => {
			const mockSaveLeft = vi.fn();
			const mockSaveRight = vi.fn();

			// Mock Windows platform
			Object.defineProperty(navigator, "platform", {
				value: "Win32",
				writable: true,
			});

			const mockEvent = {
				key: "s",
				ctrlKey: true,
				metaKey: false,
				preventDefault: vi.fn(),
			} as any;

			handleKeydown(
				mockEvent,
				{
					saveLeftFile: mockSaveLeft,
					saveRightFile: mockSaveRight,
				},
				"", // Empty left path
				"", // Empty right path
			);

			// preventDefault is called when Ctrl+S is pressed regardless of paths
			expect(mockEvent.preventDefault).toHaveBeenCalled();
			// But save functions should not be called when paths are empty
			expect(mockSaveLeft).not.toHaveBeenCalled();
			expect(mockSaveRight).not.toHaveBeenCalled();
		});
	});

	describe("isMacOS", () => {
		it("should detect macOS platform", () => {
			Object.defineProperty(navigator, "platform", {
				value: "MacIntel",
				writable: true,
			});
			expect(isMacOS()).toBe(true);
		});

		it("should detect non-Mac platforms", () => {
			Object.defineProperty(navigator, "platform", {
				value: "Win32",
				writable: true,
			});
			expect(isMacOS()).toBe(false);
		});
	});

	describe("getModifierKeyName", () => {
		it("should return Cmd for macOS", () => {
			Object.defineProperty(navigator, "platform", {
				value: "MacIntel",
				writable: true,
			});
			expect(getModifierKeyName()).toBe("Cmd");
		});

		it("should return Ctrl for other platforms", () => {
			Object.defineProperty(navigator, "platform", {
				value: "Win32",
				writable: true,
			});
			expect(getModifierKeyName()).toBe("Ctrl");
		});
	});
});
