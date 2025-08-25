import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	BeginOperationGroup,
	CommitOperationGroup,
	CopyToFile,
	RemoveLineFromFile,
	RollbackOperationGroup,
} from "../../wailsjs/go/backend/App.js";
import type { DiffResult, LineChunk } from "../types/diff";
import * as diffOps from "./diffOperations";

// Mock the Wails API
vi.mock("../../wailsjs/go/backend/App.js", () => ({
	CopyToFile: vi.fn(),
	RemoveLineFromFile: vi.fn(),
	BeginOperationGroup: vi.fn(),
	CommitOperationGroup: vi.fn(),
	RollbackOperationGroup: vi.fn(),
}));

describe("diffOperations", () => {
	const mockContext: diffOps.DiffOperationContext = {
		leftFilePath: "/path/to/left.txt",
		rightFilePath: "/path/to/right.txt",
		diffResult: null,
		compareBothFiles: vi.fn(),
		updateUnsavedChangesStatus: vi.fn(),
		refreshUndoState: vi.fn(),
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
		// Set up default mock behavior for transaction methods
		vi.mocked(BeginOperationGroup).mockResolvedValue("transaction-id");
		vi.mocked(CommitOperationGroup).mockResolvedValue(undefined);
		vi.mocked(RollbackOperationGroup).mockResolvedValue(undefined);
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

		it("should replace modified line when copying from left to right", async () => {
			await diffOps.copyLineToRight(3, mockContext);

			// Should use transaction for modified lines
			expect(BeginOperationGroup).toHaveBeenCalledWith(
				"Copy modified line to right",
			);

			// Should first delete the right line
			expect(RemoveLineFromFile).toHaveBeenCalledWith("/path/to/right.txt", 3);

			// Then copy the left line to the same position
			expect(CopyToFile).toHaveBeenCalledWith(
				"/path/to/left.txt",
				"/path/to/right.txt",
				3,
				"old line",
			);

			expect(CommitOperationGroup).toHaveBeenCalled();
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

		it("should replace modified line when copying from right to left", async () => {
			await diffOps.copyLineToLeft(3, mockContext);

			// Should use transaction for modified lines
			expect(BeginOperationGroup).toHaveBeenCalledWith(
				"Copy modified line to left",
			);

			// Should first delete the left line
			expect(RemoveLineFromFile).toHaveBeenCalledWith("/path/to/left.txt", 3);

			// Then copy the right line to the same position
			expect(CopyToFile).toHaveBeenCalledWith(
				"/path/to/right.txt",
				"/path/to/left.txt",
				3,
				"new line",
			);

			expect(CommitOperationGroup).toHaveBeenCalled();
		});
	});

	describe("copyModifiedChunkToRight", () => {
		it("should copy modified lines from left to right", async () => {
			const modifiedChunk: LineChunk = {
				type: "modified",
				startIndex: 3,
				endIndex: 3,
				leftStart: 3,
				rightStart: 3,
				lines: 1,
			};

			// Add a line with type "modified" directly
			const extendedDiffResult: DiffResult = {
				lines: [
					...mockDiffResult.lines.slice(0, 3),
					{
						type: "modified",
						leftNumber: 3,
						rightNumber: 3,
						leftLine: "old line",
						rightLine: "new line",
					},
					...mockDiffResult.lines.slice(4),
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

			// Should first delete the right line
			expect(RemoveLineFromFile).toHaveBeenCalledWith("/path/to/right.txt", 3);

			// Then copy the left line
			expect(CopyToFile).toHaveBeenCalledWith(
				"/path/to/left.txt",
				"/path/to/right.txt",
				3,
				"old line",
			);
		});
	});

	describe("copyModifiedChunkToLeft", () => {
		it("should copy modified lines from right to left", async () => {
			const modifiedChunk: LineChunk = {
				type: "modified",
				startIndex: 3,
				endIndex: 3,
				leftStart: 3,
				rightStart: 3,
				lines: 1,
			};

			// Add a line with type "modified" directly
			const extendedDiffResult: DiffResult = {
				lines: [
					...mockDiffResult.lines.slice(0, 3),
					{
						type: "modified",
						leftNumber: 3,
						rightNumber: 3,
						leftLine: "old line",
						rightLine: "new line",
					},
					...mockDiffResult.lines.slice(4),
				],
			};

			const contextWithModified = {
				...mockContext,
				diffResult: extendedDiffResult,
			};

			await diffOps.copyModifiedChunkToLeft(modifiedChunk, contextWithModified);

			// Should first delete the left line
			expect(RemoveLineFromFile).toHaveBeenCalledWith("/path/to/left.txt", 3);

			// Then copy the right line
			expect(CopyToFile).toHaveBeenCalledWith(
				"/path/to/right.txt",
				"/path/to/left.txt",
				3,
				"new line",
			);
		});
	});

	describe("Transaction Management", () => {
		it("should begin and commit transaction for copyChunkToRight", async () => {
			const chunk: LineChunk = {
				startIndex: 1,
				endIndex: 1,
				type: "removed",
			};

			await diffOps.copyChunkToRight(chunk, mockContext);

			expect(BeginOperationGroup).toHaveBeenCalledWith("Copy chunk to right");
			expect(CommitOperationGroup).toHaveBeenCalled();
			expect(RollbackOperationGroup).not.toHaveBeenCalled();
		});

		it("should rollback transaction on error in copyChunkToRight", async () => {
			const chunk: LineChunk = {
				startIndex: 1,
				endIndex: 1,
				type: "removed",
			};

			// Make CopyToFile throw an error
			vi.mocked(CopyToFile).mockRejectedValueOnce(new Error("Copy failed"));

			await expect(
				diffOps.copyChunkToRight(chunk, mockContext),
			).rejects.toThrow("Copy failed");

			expect(BeginOperationGroup).toHaveBeenCalled();
			expect(RollbackOperationGroup).toHaveBeenCalled();
			expect(CommitOperationGroup).not.toHaveBeenCalled();
		});

		it("should refresh undo state after successful operation", async () => {
			const chunk: LineChunk = {
				startIndex: 1,
				endIndex: 1,
				type: "removed",
			};

			await diffOps.copyChunkToRight(chunk, mockContext);

			expect(mockContext.refreshUndoState).toHaveBeenCalled();
		});

		it("should begin and commit transaction for deleteChunkFromRight", async () => {
			const chunk: LineChunk = {
				startIndex: 2,
				endIndex: 2,
				type: "added",
			};

			await diffOps.deleteChunkFromRight(chunk, mockContext);

			expect(BeginOperationGroup).toHaveBeenCalledWith(
				"Delete chunk from right",
			);
			expect(CommitOperationGroup).toHaveBeenCalled();
			expect(RollbackOperationGroup).not.toHaveBeenCalled();
		});

		it("should rollback transaction on error in deleteChunkFromLeft", async () => {
			const chunk: LineChunk = {
				startIndex: 1,
				endIndex: 1,
				type: "removed",
			};

			// Make RemoveLineFromFile throw an error
			vi.mocked(RemoveLineFromFile).mockRejectedValueOnce(
				new Error("Remove failed"),
			);

			await expect(
				diffOps.deleteChunkFromLeft(chunk, mockContext),
			).rejects.toThrow("Remove failed");

			expect(BeginOperationGroup).toHaveBeenCalled();
			expect(RollbackOperationGroup).toHaveBeenCalled();
			expect(CommitOperationGroup).not.toHaveBeenCalled();
		});

		it("should handle multiple operations in a transaction", async () => {
			const chunk: LineChunk = {
				startIndex: 3,
				endIndex: 3,
				type: "modified",
			};

			await diffOps.copyModifiedChunkToRight(chunk, mockContext);

			expect(BeginOperationGroup).toHaveBeenCalledWith(
				"Replace modified chunk in right",
			);
			expect(RemoveLineFromFile).toHaveBeenCalled();
			expect(CopyToFile).toHaveBeenCalled();
			expect(CommitOperationGroup).toHaveBeenCalled();
			expect(RollbackOperationGroup).not.toHaveBeenCalled();
		});

		it("should handle refreshUndoState being optional", async () => {
			const contextWithoutRefresh = {
				...mockContext,
				refreshUndoState: undefined,
			};

			const chunk: LineChunk = {
				startIndex: 1,
				endIndex: 1,
				type: "removed",
			};

			// Should not throw when refreshUndoState is undefined
			await expect(
				diffOps.copyChunkToRight(chunk, contextWithoutRefresh),
			).resolves.not.toThrow();
		});
	});
});
