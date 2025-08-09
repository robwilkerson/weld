/**
 * Type definitions for Svelte component references
 */

/**
 * Interface for components that support scroll synchronization
 */
export interface ScrollableComponent {
	getElement(): HTMLElement;
	setScrollTop(scrollTop: number): void;
	setScrollLeft(scrollLeft: number): void;
}

/**
 * DiffPane component reference type
 */
export type DiffPaneRef = ScrollableComponent;

/**
 * DiffGutter component reference type
 */
export type DiffGutterRef = ScrollableComponent;

/**
 * DiffViewer component reference type
 */
export interface DiffViewerRef {
	scrollToLine(lineIndex: number, chunkIndex?: number): void;
}
