/**
 * Shared type definitions for diff functionality
 */

// Re-export base types from Wails
export type { DiffLine, DiffResult } from "../../../wailsjs/go/backend/App";

// Extended type for highlighted diff lines
export type HighlightedDiffLine =
	import("../../../wailsjs/go/backend/App").DiffLine & {
		leftLineHighlighted?: string;
		rightLineHighlighted?: string;
	};

// Highlighted diff result for template rendering
export type HighlightedDiffResult = {
	lines: HighlightedDiffLine[];
};

// Chunk information for grouping consecutive lines
export interface LineChunk {
	startIndex: number;
	endIndex: number;
	type: string;
	lines: number;
}

// Type for which side a pane represents
export type PaneSide = "left" | "right";

// Props interface for DiffViewer component
export interface DiffViewerProps {
	leftFilePath: string;
	rightFilePath: string;
	diffResult: HighlightedDiffResult | null;
	hasUnsavedLeftChanges: boolean;
	hasUnsavedRightChanges: boolean;
	currentDiffChunkIndex: number;
	hoveredChunkIndex: number;
	showMinimap: boolean;
	isDarkMode: boolean;
	isComparing: boolean;
	hasCompletedComparison: boolean;
	lineNumberWidth: string;
}

// Events emitted by DiffViewer
export interface DiffViewerEvents {
	saveLeft: undefined;
	saveRight: undefined;
	copyLineToLeft: number; // line index
	copyLineToRight: number; // line index
	copyChunkToLeft: LineChunk;
	copyChunkToRight: LineChunk;
	copyModifiedChunkToLeft: LineChunk;
	copyModifiedChunkToRight: LineChunk;
	deleteChunkFromLeft: LineChunk;
	deleteChunkFromRight: LineChunk;
	chunkClick: number; // line index
	chunkHover: number; // line index
	chunkLeave: undefined;
	scrollSync: undefined;
	minimapClick: MouseEvent;
	viewportMouseDown: MouseEvent;
}
