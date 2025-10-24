import {
	BeginOperationGroup,
	CommitOperationGroup,
	CopyToFile,
	RemoveLineFromFile,
	RollbackOperationGroup,
} from "../../wailsjs/go/backend/App.js";
import type { DiffResult, LineChunk } from "../types/diff";

export interface DiffOperationContext {
	leftFilePath: string;
	rightFilePath: string;
	diffResult: DiffResult | null;
	compareBothFiles: (preserveCurrentDiff: boolean) => Promise<void>;
	updateUnsavedChangesStatus: () => Promise<void>;
	refreshUndoRedoState?: () => Promise<void>;
}

export async function copyChunkToRight(
	chunk: LineChunk,
	context: DiffOperationContext,
): Promise<void> {
	const {
		leftFilePath,
		rightFilePath,
		diffResult,
		compareBothFiles,
		updateUnsavedChangesStatus,
	} = context;

	if (!diffResult) {
		throw new Error("No diff result available");
	}

	// Start transaction
	await BeginOperationGroup("Copy chunk to right");

	try {
		// Copy all lines in the chunk from left to right
		for (let i = chunk.startIndex; i <= chunk.endIndex; i++) {
			const line = diffResult.lines[i];
			if (line.type === "removed" && line.leftNumber !== null) {
				await CopyToFile(
					leftFilePath,
					rightFilePath,
					line.leftNumber,
					line.leftLine,
				);
			}
		}

		// Commit transaction
		await CommitOperationGroup();

		// Refresh the diff
		await compareBothFiles(true);
		await updateUnsavedChangesStatus();

		// Update undo state
		if (context.refreshUndoRedoState) {
			await context.refreshUndoRedoState();
		}
	} catch (error) {
		// Rollback on error
		await RollbackOperationGroup();
		throw error;
	}
}

export async function copyChunkToLeft(
	chunk: LineChunk,
	context: DiffOperationContext,
): Promise<void> {
	const {
		leftFilePath,
		rightFilePath,
		diffResult,
		compareBothFiles,
		updateUnsavedChangesStatus,
	} = context;

	if (!diffResult) {
		throw new Error("No diff result available");
	}

	// Start transaction
	await BeginOperationGroup("Copy chunk to left");

	try {
		// Copy all lines in the chunk from right to left
		// First, find the correct insertion position
		let insertPosition = 1; // Default to beginning of file

		// Look for the nearest "same" line above this chunk to determine position
		for (let i = chunk.startIndex - 1; i >= 0; i--) {
			const line = diffResult.lines[i];
			if (line.type === "same" && line.leftNumber !== null) {
				insertPosition = line.leftNumber + 1;
				break;
			}
		}

		// Copy all lines in the chunk
		let currentInsertPosition = insertPosition;
		for (let i = chunk.startIndex; i <= chunk.endIndex; i++) {
			const line = diffResult.lines[i];
			if (line.type === "added" && line.rightNumber !== null) {
				await CopyToFile(
					rightFilePath,
					leftFilePath,
					currentInsertPosition,
					line.rightLine,
				);
				currentInsertPosition++; // Increment for next line in chunk
			}
		}

		// Commit transaction
		await CommitOperationGroup();

		// Refresh the diff
		await compareBothFiles(true);
		await updateUnsavedChangesStatus();

		// Update undo state
		if (context.refreshUndoRedoState) {
			await context.refreshUndoRedoState();
		}
	} catch (error) {
		// Rollback on error
		await RollbackOperationGroup();
		throw error;
	}
}

export async function copyModifiedChunkToRight(
	chunk: LineChunk,
	context: DiffOperationContext,
): Promise<void> {
	const {
		leftFilePath,
		rightFilePath,
		diffResult,
		compareBothFiles,
		updateUnsavedChangesStatus,
	} = context;

	if (!diffResult) {
		throw new Error("No diff result available");
	}

	// Start transaction
	await BeginOperationGroup("Replace modified chunk in right");

	try {
		// For modified chunks, we need to handle lines that have type "modified"
		// These lines have both leftLine and rightLine content
		for (let i = chunk.startIndex; i <= chunk.endIndex; i++) {
			const line = diffResult.lines[i];
			if (
				line.type === "modified" &&
				line.leftNumber !== null &&
				line.rightNumber !== null
			) {
				// First delete the current right line
				await RemoveLineFromFile(rightFilePath, line.rightNumber);
				// Then copy the left line to the right at the same position
				// After deletion, we insert at rightNumber (where we just deleted)
				await CopyToFile(
					leftFilePath,
					rightFilePath,
					line.rightNumber,
					line.leftLine,
				);
			}
		}

		// Commit transaction
		await CommitOperationGroup();

		// Refresh the diff
		await compareBothFiles(true);
		await updateUnsavedChangesStatus();

		// Update undo state
		if (context.refreshUndoRedoState) {
			await context.refreshUndoRedoState();
		}
	} catch (error) {
		// Rollback on error
		await RollbackOperationGroup();
		throw error;
	}
}

export async function copyModifiedChunkToLeft(
	chunk: LineChunk,
	context: DiffOperationContext,
): Promise<void> {
	const {
		leftFilePath,
		rightFilePath,
		diffResult,
		compareBothFiles,
		updateUnsavedChangesStatus,
	} = context;

	if (!diffResult) {
		throw new Error("No diff result available");
	}

	// Start transaction
	await BeginOperationGroup("Replace modified chunk in left");

	try {
		// For modified chunks, we need to handle lines that have type "modified"
		// These lines have both leftLine and rightLine content
		for (let i = chunk.startIndex; i <= chunk.endIndex; i++) {
			const line = diffResult.lines[i];
			if (
				line.type === "modified" &&
				line.leftNumber !== null &&
				line.rightNumber !== null
			) {
				// First delete the current left line
				await RemoveLineFromFile(leftFilePath, line.leftNumber);
				// Then copy the right line to the left at the same position
				// After deletion, we insert at leftNumber (where we just deleted)
				await CopyToFile(
					rightFilePath,
					leftFilePath,
					line.leftNumber,
					line.rightLine,
				);
			}
		}

		// Commit transaction
		await CommitOperationGroup();

		// Refresh the diff
		await compareBothFiles(true);
		await updateUnsavedChangesStatus();

		// Update undo state
		if (context.refreshUndoRedoState) {
			await context.refreshUndoRedoState();
		}
	} catch (error) {
		// Rollback on error
		await RollbackOperationGroup();
		throw error;
	}
}

export async function deleteChunkFromRight(
	chunk: LineChunk,
	context: DiffOperationContext,
): Promise<void> {
	const {
		rightFilePath,
		diffResult,
		compareBothFiles,
		updateUnsavedChangesStatus,
	} = context;

	if (!diffResult) {
		throw new Error("No diff result available");
	}

	// Start transaction
	await BeginOperationGroup("Delete chunk from right");

	try {
		// Collect all line numbers to delete first (in reverse order to avoid index shifting)
		const linesToDelete: number[] = [];
		for (let i = chunk.startIndex; i <= chunk.endIndex; i++) {
			const line = diffResult.lines[i];
			if (line.type === "added" && line.rightNumber !== null) {
				linesToDelete.push(line.rightNumber);
			}
		}

		// Sort in descending order to delete from bottom to top
		linesToDelete.sort((a, b) => b - a);

		// Delete lines from bottom to top to avoid index shifting issues
		for (const lineNumber of linesToDelete) {
			await RemoveLineFromFile(rightFilePath, lineNumber);
		}

		// Commit transaction
		await CommitOperationGroup();

		// Refresh the diff
		await compareBothFiles(true);
		await updateUnsavedChangesStatus();

		// Update undo state
		if (context.refreshUndoRedoState) {
			await context.refreshUndoRedoState();
		}
	} catch (error) {
		// Rollback on error
		await RollbackOperationGroup();
		throw error;
	}
}

export async function deleteChunkFromLeft(
	chunk: LineChunk,
	context: DiffOperationContext,
): Promise<void> {
	const {
		leftFilePath,
		diffResult,
		compareBothFiles,
		updateUnsavedChangesStatus,
	} = context;

	if (!diffResult) {
		throw new Error("No diff result available");
	}

	// Start transaction
	await BeginOperationGroup("Delete chunk from left");

	try {
		// Collect all line numbers to delete first (in reverse order to avoid index shifting)
		const linesToDelete: number[] = [];
		for (let i = chunk.startIndex; i <= chunk.endIndex; i++) {
			const line = diffResult.lines[i];
			if (line.type === "removed" && line.leftNumber !== null) {
				linesToDelete.push(line.leftNumber);
			}
		}

		// Sort in descending order to delete from bottom to top
		linesToDelete.sort((a, b) => b - a);

		// Delete lines from bottom to top to avoid index shifting issues
		for (const lineNumber of linesToDelete) {
			await RemoveLineFromFile(leftFilePath, lineNumber);
		}

		// Commit transaction
		await CommitOperationGroup();

		// Refresh the diff
		await compareBothFiles(true);
		await updateUnsavedChangesStatus();

		// Update undo state
		if (context.refreshUndoRedoState) {
			await context.refreshUndoRedoState();
		}
	} catch (error) {
		// Rollback on error
		await RollbackOperationGroup();
		throw error;
	}
}

export async function deleteLineFromRight(
	lineIndex: number,
	context: DiffOperationContext,
): Promise<void> {
	const {
		rightFilePath,
		diffResult,
		compareBothFiles,
		updateUnsavedChangesStatus,
	} = context;

	if (!diffResult || lineIndex < 0 || lineIndex >= diffResult.lines.length) {
		throw new Error("Invalid line index");
	}

	const line = diffResult.lines[lineIndex];
	if (line.rightNumber !== null && line.rightNumber > 0) {
		await RemoveLineFromFile(rightFilePath, line.rightNumber);

		// Refresh the diff to show the changes
		await compareBothFiles(true);
		await updateUnsavedChangesStatus();
	}
}

export async function deleteLineFromLeft(
	lineIndex: number,
	context: DiffOperationContext,
): Promise<void> {
	const {
		leftFilePath,
		diffResult,
		compareBothFiles,
		updateUnsavedChangesStatus,
	} = context;

	if (!diffResult || lineIndex < 0 || lineIndex >= diffResult.lines.length) {
		throw new Error("Invalid line index");
	}

	const line = diffResult.lines[lineIndex];
	if (line.leftNumber !== null && line.leftNumber > 0) {
		await RemoveLineFromFile(leftFilePath, line.leftNumber);

		// Refresh the diff to show the changes
		await compareBothFiles(true);
		await updateUnsavedChangesStatus();
	}
}

export async function copyLineToRight(
	lineIndex: number,
	context: DiffOperationContext,
): Promise<void> {
	const { leftFilePath, rightFilePath, diffResult } = context;

	if (!diffResult || lineIndex < 0 || lineIndex >= diffResult.lines.length) {
		throw new Error("Invalid line index");
	}

	const clickedLine = diffResult.lines[lineIndex];

	// Determine which line to copy based on the clicked line type
	if (clickedLine.type === "removed" && clickedLine.leftNumber !== null) {
		// Copy from left to right
		await CopyToFile(
			leftFilePath,
			rightFilePath,
			clickedLine.leftNumber,
			clickedLine.leftLine,
		);
	} else if (clickedLine.type === "added") {
		// Delete from right (copy "nothing" from left)
		await deleteLineFromRight(lineIndex, context);
		return; // deleteLineFromRight already handles refresh
	} else if (clickedLine.type === "modified") {
		// For modified lines, we need to replace the right line with the left line
		if (clickedLine.leftNumber !== null && clickedLine.rightNumber !== null) {
			// Since CopyToFile inserts (not replaces), we need to delete first, then insert
			await BeginOperationGroup("Copy modified line to right");
			try {
				// First delete the current right line
				await RemoveLineFromFile(rightFilePath, clickedLine.rightNumber);
				// Then insert the left line at the same position
				// After deletion, the line that was at rightNumber+1 is now at rightNumber
				// So inserting at rightNumber will put our content in the right place
				await CopyToFile(
					leftFilePath,
					rightFilePath,
					clickedLine.rightNumber,
					clickedLine.leftLine,
				);
				await CommitOperationGroup();
			} catch (error) {
				await RollbackOperationGroup();
				throw error;
			}
		}
	}

	// Refresh the diff to show the changes
	await context.compareBothFiles(true);
	await context.updateUnsavedChangesStatus();
}

export async function copyLineToLeft(
	lineIndex: number,
	context: DiffOperationContext,
): Promise<void> {
	const { leftFilePath, rightFilePath, diffResult } = context;

	if (!diffResult || lineIndex < 0 || lineIndex >= diffResult.lines.length) {
		throw new Error("Invalid line index");
	}

	const clickedLine = diffResult.lines[lineIndex];

	// Determine which line to copy based on the clicked line type
	if (clickedLine.type === "added" && clickedLine.rightNumber !== null) {
		// Copy from right to left
		// Find the correct insertion position in the left file
		let insertPosition = 1; // Default to beginning of file

		// Look for the nearest "same" line above this added line to determine position
		for (let i = lineIndex - 1; i >= 0; i--) {
			const line = diffResult.lines[i];
			if (line.type === "same" && line.leftNumber !== null) {
				insertPosition = line.leftNumber + 1;
				break;
			}
		}

		await CopyToFile(
			rightFilePath,
			leftFilePath,
			insertPosition,
			clickedLine.rightLine,
		);
	} else if (clickedLine.type === "removed") {
		// Delete from left (copy "nothing" from right)
		await deleteLineFromLeft(lineIndex, context);
		return; // deleteLineFromLeft already handles refresh
	} else if (clickedLine.type === "modified") {
		// For modified lines, we need to replace the left line with the right line
		if (clickedLine.leftNumber !== null && clickedLine.rightNumber !== null) {
			// Since CopyToFile inserts (not replaces), we need to delete first, then insert
			await BeginOperationGroup("Copy modified line to left");
			try {
				// First delete the current left line
				await RemoveLineFromFile(leftFilePath, clickedLine.leftNumber);
				// Then insert the right line at the same position
				// After deletion, the line that was at leftNumber+1 is now at leftNumber
				// So inserting at leftNumber will put our content in the right place
				await CopyToFile(
					rightFilePath,
					leftFilePath,
					clickedLine.leftNumber,
					clickedLine.rightLine,
				);
				await CommitOperationGroup();
			} catch (error) {
				await RollbackOperationGroup();
				throw error;
			}
		}
	}

	// Refresh the diff to show the changes
	await context.compareBothFiles(true);
	await context.updateUnsavedChangesStatus();
}
