import { describe, expect, it, vi } from "vitest";

// Test utility functions that would be extracted from App.svelte
describe("Utility Functions", () => {
	describe("expandTildePath", () => {
		it("should expand tilde to home directory", () => {
			const originalEnv = process.env.HOME;
			process.env.HOME = "/Users/testuser";

			function expandTildePath(path: string): string {
				if (path.startsWith("~/")) {
					const home = process.env.HOME || process.env.USERPROFILE || "";
					return path.replace("~", home);
				}
				return path;
			}

			const result = expandTildePath("~/Documents/test.txt");
			expect(result).toBe("/Users/testuser/Documents/test.txt");

			process.env.HOME = originalEnv;
		});

		it("should return path unchanged if no tilde", () => {
			function expandTildePath(path: string): string {
				if (path.startsWith("~/")) {
					const home = process.env.HOME || process.env.USERPROFILE || "";
					return path.replace("~", home);
				}
				return path;
			}

			const result = expandTildePath("/absolute/path/test.txt");
			expect(result).toBe("/absolute/path/test.txt");
		});
	});

	describe("getDisplayPath", () => {
		it("should return original path if short", () => {
			function getDisplayPath(
				leftPath: string,
				rightPath: string,
				isLeft: boolean,
			): string {
				const targetPath = isLeft ? leftPath : rightPath;
				const otherPath = isLeft ? rightPath : leftPath;

				if (!targetPath || !otherPath) return targetPath || "";

				const targetSegments = targetPath.split("/").filter((s) => s !== "");
				const otherSegments = otherPath.split("/").filter((s) => s !== "");

				if (targetSegments.length === 0) return targetPath;

				const totalSegmentsToShow = 4;

				if (targetSegments.length <= totalSegmentsToShow) {
					return targetSegments.join("/");
				}

				const segments = targetSegments.slice(-totalSegmentsToShow);
				return ".../" + segments.join("/");
			}

			const result = getDisplayPath("/short/path.txt", "/other/path.txt", true);
			expect(result).toBe("short/path.txt");
		});

		it("should truncate long paths", () => {
			function getDisplayPath(
				leftPath: string,
				rightPath: string,
				isLeft: boolean,
			): string {
				const targetPath = isLeft ? leftPath : rightPath;
				const otherPath = isLeft ? rightPath : leftPath;

				if (!targetPath || !otherPath) return targetPath || "";

				const targetSegments = targetPath.split("/").filter((s) => s !== "");
				const otherSegments = otherPath.split("/").filter((s) => s !== "");

				if (targetSegments.length === 0) return targetPath;

				const totalSegmentsToShow = 4;

				if (targetSegments.length <= totalSegmentsToShow) {
					return targetSegments.join("/");
				}

				const segments = targetSegments.slice(-totalSegmentsToShow);
				return ".../" + segments.join("/");
			}

			const longPath = "/very/long/path/to/some/deep/directory/file.txt";
			const result = getDisplayPath(longPath, "/other/path.txt", true);
			expect(result).toBe(".../some/deep/directory/file.txt");
		});

		it("should handle empty paths", () => {
			function getDisplayPath(
				leftPath: string,
				rightPath: string,
				isLeft: boolean,
			): string {
				const targetPath = isLeft ? leftPath : rightPath;
				const otherPath = isLeft ? rightPath : leftPath;

				if (!targetPath || !otherPath) return targetPath || "";

				const targetSegments = targetPath.split("/").filter((s) => s !== "");
				const otherSegments = otherPath.split("/").filter((s) => s !== "");

				if (targetSegments.length === 0) return targetPath;

				const totalSegmentsToShow = 4;

				if (targetSegments.length <= totalSegmentsToShow) {
					return targetSegments.join("/");
				}

				const segments = targetSegments.slice(-totalSegmentsToShow);
				return ".../" + segments.join("/");
			}

			const result = getDisplayPath("", "/other/path.txt", true);
			expect(result).toBe("");
		});
	});

	describe("getLineClass", () => {
		it("should return correct CSS class for line types", () => {
			function getLineClass(type: string): string {
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

			function getLineNumberWidth(diffResult: any): string {
				if (!diffResult || !diffResult.lines.length) return "32px";

				const maxLineNumber = Math.max(
					...diffResult.lines.map((line: any) =>
						Math.max(line.leftNumber || 0, line.rightNumber || 0),
					),
				);

				const digits = Math.max(2, maxLineNumber.toString().length);
				const width = digits * 6 + 8;

				return `${width}px`;
			}

			const result = getLineNumberWidth(mockDiffResult);
			expect(result).toBe("26px"); // 3 digits * 6 + 8 = 26px
		});

		it("should return default width for empty result", () => {
			function getLineNumberWidth(diffResult: any): string {
				if (!diffResult || !diffResult.lines.length) return "32px";

				const maxLineNumber = Math.max(
					...diffResult.lines.map((line: any) =>
						Math.max(line.leftNumber || 0, line.rightNumber || 0),
					),
				);

				const digits = Math.max(2, maxLineNumber.toString().length);
				const width = digits * 6 + 8;

				return `${width}px`;
			}

			expect(getLineNumberWidth(null)).toBe("32px");
			expect(getLineNumberWidth({ lines: [] })).toBe("32px");
		});
	});

	describe("getLanguageFromFilename", () => {
		it("should detect language from file extension", () => {
			function getLanguageFromFilename(filename: string): string {
				if (!filename) return "markup";

				const ext = filename.split(".").pop()?.toLowerCase();

				const languageMap: Record<string, string> = {
					js: "javascript",
					jsx: "javascript",
					ts: "typescript",
					tsx: "typescript",
					java: "java",
					go: "go",
					py: "python",
					php: "php",
					rb: "ruby",
					cs: "csharp",
					css: "css",
					scss: "css",
					sass: "css",
					json: "json",
					md: "markdown",
					sh: "bash",
					bash: "bash",
					zsh: "bash",
					c: "c",
					cpp: "cpp",
					h: "c",
					hpp: "cpp",
				};

				return languageMap[ext] || "markup";
			}

			expect(getLanguageFromFilename("test.js")).toBe("javascript");
			expect(getLanguageFromFilename("test.ts")).toBe("typescript");
			expect(getLanguageFromFilename("test.py")).toBe("python");
			expect(getLanguageFromFilename("test.go")).toBe("go");
			expect(getLanguageFromFilename("test.unknown")).toBe("markup");
			expect(getLanguageFromFilename("")).toBe("markup");
		});
	});

	describe("handleKeydown", () => {
		it("should handle Ctrl+S on Windows/Linux", () => {
			const mockSaveLeftFile = vi.fn();
			const mockSaveRightFile = vi.fn();
			const leftFilePath = "/path/to/left.txt";
			const rightFilePath = "/path/to/right.txt";

			function handleKeydown(
				event: any,
				saveLeftFile: () => void,
				saveRightFile: () => void,
				leftPath: string,
				rightPath: string,
			): void {
				const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
				const isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

				if (isCtrlOrCmd && event.key === "s") {
					event.preventDefault();

					if (leftPath) {
						saveLeftFile();
					}
					if (rightPath) {
						saveRightFile();
					}
				}
			}

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
			};

			handleKeydown(
				mockEvent,
				mockSaveLeftFile,
				mockSaveRightFile,
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

			function handleKeydown(
				event: any,
				saveLeftFile: () => void,
				saveRightFile: () => void,
				leftPath: string,
				rightPath: string,
			): void {
				const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
				const isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

				if (isCtrlOrCmd && event.key === "s") {
					event.preventDefault();

					if (leftPath) {
						saveLeftFile();
					}
					if (rightPath) {
						saveRightFile();
					}
				}
			}

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
			};

			handleKeydown(
				mockEvent,
				mockSaveLeftFile,
				mockSaveRightFile,
				leftFilePath,
				rightFilePath,
			);

			expect(mockEvent.preventDefault).toHaveBeenCalled();
			expect(mockSaveLeftFile).toHaveBeenCalled();
			expect(mockSaveRightFile).toHaveBeenCalled();
		});
	});
});
