import { beforeEach, describe, expect, it, vi } from "vitest";
import { CopyToFile, RemoveLineFromFile } from "../../wailsjs/go/main/App.js";
import type { DiffResult, LineChunk } from "../types";
import * as diffOps from "./diffOperations";

// Mock the Wails API
vi.mock("../../wailsjs/go/main/App.js", () => ({
	CopyToFile: vi.fn(),
	RemoveLineFromFile: vi.fn(),
}));

describe("diffOperations", () => {
	const mockContext: diffOps.DiffOperationContext = {
		leftFilePath: "/path/to/left.txt",
		rightFilePath: "/path/to/right.txt",
		diffResult: null,
		compareBothFiles: vi.fn(),
		updateUnsavedChangesStatus: vi.fn(),
	};

	const mockDiffResult: DiffResult = {
		lines: [
			{
				type: "same",
				leftNumber: 1,
				rightNumber: 1,
				leftLine: "unchanged line",
				rightLine: "unchanged line",
			},
			{
				type: "removed",
				leftNumber: 2,
				rightNumber: null,
				leftLine: "removed line",
				rightLine: "",
			},
			{
				type: "added",
				leftNumber: null,
				rightNumber: 2,
				leftLine: "",
				rightLine: "added line",
			},
			{
				type: "modified",
				leftNumber: 3,
				rightNumber: 3,
				leftLine: "old line",
				rightLine: "new line",
			},
		],
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockContext.diffResult = mockDiffResult;
	});

	describe("copyChunkToRight", () => {
		it("should copy removed lines from left to right", async () => {
			const chunk: LineChunk = {
				type: "removed",
				startIndex: 1,
				endIndex: 1,
				leftStart: 2,
				rightStart: null,
				lines: 1,
			};

			await diffOps.copyChunkToRight(chunk, mockContext);

			expect(CopyToFile).toHaveBeenCalledWith(
				"/path/to/left.txt",
				"/path/to/right.txt",
				2,
				"removed line",
			);
			expect(mockContext.compareBothFiles).toHaveBeenCalledWith(true);
			expect(mockContext.updateUnsavedChangesStatus).toHaveBeenCalled();
		});

		it("should throw error if no diff result", async () => {
			const chunk: LineChunk = {
				type: "removed",
				startIndex: 1,
				endIndex: 1,
				leftStart: 2,
				rightStart: null,
				lines: 1,
			};
			const contextWithoutDiff = { ...mockContext, diffResult: null };

			await expect(
				diffOps.copyChunkToRight(chunk, contextWithoutDiff),
			).rejects.toThrow("No diff result available");
		});
	});

	describe("copyChunkToLeft", () => {
		it("should copy added lines from right to left", async () => {
			const chunk: LineChunk = {
				type: "added",
				startIndex: 2,
				endIndex: 2,
				leftStart: null,
				rightStart: 2,
				lines: 1,
			};

			await diffOps.copyChunkToLeft(chunk, mockContext);

			expect(CopyToFile).toHaveBeenCalledWith(
				"/path/to/right.txt",
				"/path/to/left.txt",
				2,
				"added line",
			);
			expect(mockContext.compareBothFiles).toHaveBeenCalledWith(true);
			expect(mockContext.updateUnsavedChangesStatus).toHaveBeenCalled();
		});
	});

	describe("deleteChunkFromRight", () => {
		it("should delete added lines from right file", async () => {
			const chunk: LineChunk = {
				type: "added",
				startIndex: 2,
				endIndex: 2,
				leftStart: null,
				rightStart: 2,
				lines: 1,
			};

			await diffOps.deleteChunkFromRight(chunk, mockContext);

			expect(RemoveLineFromFile).toHaveBeenCalledWith("/path/to/right.txt", 2);
			expect(mockContext.compareBothFiles).toHaveBeenCalledWith(true);
			expect(mockContext.updateUnsavedChangesStatus).toHaveBeenCalled();
		});
	});

	describe("deleteChunkFromLeft", () => {
		it("should delete removed lines from left file", async () => {
			const chunk: LineChunk = {
				type: "removed",
				startIndex: 1,
				endIndex: 1,
				leftStart: 2,
				rightStart: null,
				lines: 1,
			};

			await diffOps.deleteChunkFromLeft(chunk, mockContext);

			expect(RemoveLineFromFile).toHaveBeenCalledWith("/path/to/left.txt", 2);
			expect(mockContext.compareBothFiles).toHaveBeenCalledWith(true);
			expect(mockContext.updateUnsavedChangesStatus).toHaveBeenCalled();
		});
	});

	describe("deleteLineFromRight", () => {
		it("should delete a line from the right file", async () => {
			await diffOps.deleteLineFromRight(2, mockContext);

			expect(RemoveLineFromFile).toHaveBeenCalledWith("/path/to/right.txt", 2);
			expect(mockContext.compareBothFiles).toHaveBeenCalledWith(true);
			expect(mockContext.updateUnsavedChangesStatus).toHaveBeenCalled();
		});

		it("should throw error for invalid line index", async () => {
			await expect(
				diffOps.deleteLineFromRight(-1, mockContext),
			).rejects.toThrow("Invalid line index");
			await expect(
				diffOps.deleteLineFromRight(999, mockContext),
			).rejects.toThrow("Invalid line index");
		});

		it("should not delete if line has no right number", async () => {
			await diffOps.deleteLineFromRight(1, mockContext); // removed line has no right number

			expect(RemoveLineFromFile).not.toHaveBeenCalled();
		});
	});

	describe("deleteLineFromLeft", () => {
		it("should delete a line from the left file", async () => {
			await diffOps.deleteLineFromLeft(1, mockContext);

			expect(RemoveLineFromFile).toHaveBeenCalledWith("/path/to/left.txt", 2);
			expect(mockContext.compareBothFiles).toHaveBeenCalledWith(true);
			expect(mockContext.updateUnsavedChangesStatus).toHaveBeenCalled();
		});

		it("should not delete if line has no left number", async () => {
			await diffOps.deleteLineFromLeft(2, mockContext); // added line has no left number

			expect(RemoveLineFromFile).not.toHaveBeenCalled();
		});
	});

	describe("copyLineToRight", () => {
		it("should copy removed line from left to right", async () => {
			await diffOps.copyLineToRight(1, mockContext);

			expect(CopyToFile).toHaveBeenCalledWith(
				"/path/to/left.txt",
				"/path/to/right.txt",
				2,
				"removed line",
			);
		});

		it("should delete added line when copying 'nothing' from left", async () => {
			await diffOps.copyLineToRight(2, mockContext);

			expect(RemoveLineFromFile).toHaveBeenCalledWith("/path/to/right.txt", 2);
			expect(CopyToFile).not.toHaveBeenCalled();
		});

		it("should throw error for invalid line index", async () => {
			await expect(diffOps.copyLineToRight(-1, mockContext)).rejects.toThrow(
				"Invalid line index",
			);
		});
	});

	describe("copyLineToLeft", () => {
		it("should copy added line from right to left", async () => {
			await diffOps.copyLineToLeft(2, mockContext);

			expect(CopyToFile).toHaveBeenCalledWith(
				"/path/to/right.txt",
				"/path/to/left.txt",
				2,
				"added line",
			);
		});

		it("should delete removed line when copying 'nothing' from right", async () => {
			await diffOps.copyLineToLeft(1, mockContext);

			expect(RemoveLineFromFile).toHaveBeenCalledWith("/path/to/left.txt", 2);
			expect(CopyToFile).not.toHaveBeenCalled();
		});
	});

	describe("copyModifiedChunkToRight", () => {
		it("should copy removed lines from modified chunk", async () => {
			const modifiedChunk: LineChunk = {
				type: "modified",
				startIndex: 1,
				endIndex: 3,
				leftStart: 2,
				rightStart: 2,
				lines: 3,
			};

			// Add a modified chunk with removed/added pattern
			const extendedDiffResult: DiffResult = {
				lines: [
					...mockDiffResult.lines.slice(0, 1),
					{
						type: "removed",
						leftNumber: 2,
						rightNumber: null,
						leftLine: "old modified line",
						rightLine: "",
					},
					{
						type: "added",
						leftNumber: null,
						rightNumber: 2,
						leftLine: "",
						rightLine: "new modified line",
					},
					...mockDiffResult.lines.slice(3),
				],
			};

			const contextWithModified = {
				...mockContext,
				diffResult: extendedDiffResult,
			};

			await diffOps.copyModifiedChunkToRight(
				modifiedChunk,
				contextWithModified,
			);

			expect(CopyToFile).toHaveBeenCalledWith(
				"/path/to/left.txt",
				"/path/to/right.txt",
				2,
				"old modified line",
			);
		});
	});

	describe("copyModifiedChunkToLeft", () => {
		it("should copy added lines from modified chunk", async () => {
			const modifiedChunk: LineChunk = {
				type: "modified",
				startIndex: 1,
				endIndex: 3,
				leftStart: 2,
				rightStart: 2,
				lines: 3,
			};

			// Add a modified chunk with removed/added pattern
			const extendedDiffResult: DiffResult = {
				lines: [
					...mockDiffResult.lines.slice(0, 1),
					{
						type: "removed",
						leftNumber: 2,
						rightNumber: null,
						leftLine: "old modified line",
						rightLine: "",
					},
					{
						type: "added",
						leftNumber: null,
						rightNumber: 2,
						leftLine: "",
						rightLine: "new modified line",
					},
					...mockDiffResult.lines.slice(3),
				],
			};

			const contextWithModified = {
				...mockContext,
				diffResult: extendedDiffResult,
			};

			await diffOps.copyModifiedChunkToLeft(modifiedChunk, contextWithModified);

			expect(CopyToFile).toHaveBeenCalledWith(
				"/path/to/right.txt",
				"/path/to/left.txt",
				2,
				"new modified line",
			);
		});
	});
});
