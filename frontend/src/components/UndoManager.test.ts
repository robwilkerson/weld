import { render } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UndoManager from "./UndoManager.svelte";

// Mock the Wails runtime
const mockEventHandlers = new Map<string, () => void>();

vi.mock("../../wailsjs/runtime/runtime", () => ({
	EventsOn: vi.fn((event: string, handler: () => void) => {
		mockEventHandlers.set(event, handler);
	}),
	EventsOff: vi.fn((event: string) => {
		mockEventHandlers.delete(event);
	}),
}));

// Mock the App functions
vi.mock("../../wailsjs/go/backend/App", () => ({
	UndoLastOperation: vi.fn(),
	RedoLastOperation: vi.fn(),
	CanUndo: vi.fn(),
	CanRedo: vi.fn(),
	GetLastOperationDescription: vi.fn(),
	GetLastRedoOperationDescription: vi.fn(),
}));

import {
	CanRedo,
	CanUndo,
	GetLastOperationDescription,
	GetLastRedoOperationDescription,
	RedoLastOperation,
	UndoLastOperation,
} from "../../wailsjs/go/backend/App";

describe("UndoManager", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockEventHandlers.clear();
		// Set default return values
		vi.mocked(CanUndo).mockResolvedValue(false);
		vi.mocked(CanRedo).mockResolvedValue(false);
		vi.mocked(GetLastOperationDescription).mockResolvedValue("");
		vi.mocked(GetLastRedoOperationDescription).mockResolvedValue("");
	});

	it("should expose public API methods", () => {
		const { component } = render(UndoManager);

		expect(typeof component.undo).toBe("function");
		expect(typeof component.redo).toBe("function");
		expect(typeof component.getUndoState).toBe("function");
		expect(typeof component.getRedoState).toBe("function");
		expect(typeof component.refreshUndoState).toBe("function");
	});

	it("should initialize with default state", () => {
		const { component } = render(UndoManager);

		const undoState = component.getUndoState();
		expect(undoState.canUndo).toBe(false);
		expect(undoState.lastOperationDescription).toBe("");

		const redoState = component.getRedoState();
		expect(redoState.canRedo).toBe(false);
		expect(redoState.lastRedoOperationDescription).toBe("");
	});

	it("should update undo state", async () => {
		vi.mocked(CanUndo).mockResolvedValue(true);
		vi.mocked(GetLastOperationDescription).mockResolvedValue(
			"Copy chunk to right",
		);

		const { component } = render(UndoManager);

		const undoStateChangedHandler = vi.fn();
		component.$on("undoStateChanged", undoStateChangedHandler);

		await component.refreshUndoState();

		expect(CanUndo).toHaveBeenCalled();
		expect(GetLastOperationDescription).toHaveBeenCalled();

		const state = component.getUndoState();
		expect(state.canUndo).toBe(true);
		expect(state.lastOperationDescription).toBe("Copy chunk to right");

		expect(undoStateChangedHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: { canUndo: true, description: "Copy chunk to right" },
			}),
		);
	});

	it("should handle undo operation", async () => {
		vi.mocked(CanUndo).mockResolvedValue(true);
		vi.mocked(GetLastOperationDescription).mockResolvedValue(
			"Copy chunk to right",
		);
		vi.mocked(UndoLastOperation).mockResolvedValue(undefined);

		const { component } = render(UndoManager);

		// First update state
		await component.refreshUndoState();

		const statusUpdateHandler = vi.fn();
		component.$on("statusUpdate", statusUpdateHandler);

		await component.undo();

		expect(UndoLastOperation).toHaveBeenCalled();
		expect(statusUpdateHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: { message: "Undoing last operation..." },
			}),
		);
		expect(statusUpdateHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: { message: "Undid: Copy chunk to right" },
			}),
		);
	});

	it("should handle undo error", async () => {
		const error = new Error("Undo failed");
		vi.mocked(UndoLastOperation).mockRejectedValue(error);

		const { component } = render(UndoManager);

		const statusUpdateHandler = vi.fn();
		component.$on("statusUpdate", statusUpdateHandler);

		await component.undo();

		expect(statusUpdateHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: { message: "Undo failed: Error: Undo failed" },
			}),
		);
	});

	it("should handle refreshUndoState error gracefully", async () => {
		vi.mocked(CanUndo).mockRejectedValue(new Error("API error"));

		const { component } = render(UndoManager);

		// Should not throw
		await expect(component.refreshUndoState()).resolves.not.toThrow();

		// State should remain unchanged
		const state = component.getUndoState();
		expect(state.canUndo).toBe(false);
		expect(state.lastOperationDescription).toBe("");
	});

	it("should handle state when canUndo is false", async () => {
		vi.mocked(CanUndo).mockResolvedValue(false);

		const { component } = render(UndoManager);

		await component.refreshUndoState();

		expect(GetLastOperationDescription).not.toHaveBeenCalled();

		const state = component.getUndoState();
		expect(state.canUndo).toBe(false);
		expect(state.lastOperationDescription).toBe("");
	});

	it("should dispatch undoStateChanged event", async () => {
		vi.mocked(CanUndo).mockResolvedValue(true);
		vi.mocked(GetLastOperationDescription).mockResolvedValue("Delete chunk");

		const { component } = render(UndoManager);

		const undoStateChangedHandler = vi.fn();
		component.$on("undoStateChanged", undoStateChangedHandler);

		await component.refreshUndoState();

		expect(undoStateChangedHandler).toHaveBeenCalledTimes(1);
		expect(undoStateChangedHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: { canUndo: true, description: "Delete chunk" },
			}),
		);
	});

	// Redo tests
	it("should update redo state", async () => {
		vi.mocked(CanRedo).mockResolvedValue(true);
		vi.mocked(GetLastRedoOperationDescription).mockResolvedValue(
			"Copy chunk to left",
		);

		const { component } = render(UndoManager);

		const redoStateChangedHandler = vi.fn();
		component.$on("redoStateChanged", redoStateChangedHandler);

		await component.refreshUndoState();

		expect(CanRedo).toHaveBeenCalled();
		expect(GetLastRedoOperationDescription).toHaveBeenCalled();

		const state = component.getRedoState();
		expect(state.canRedo).toBe(true);
		expect(state.lastRedoOperationDescription).toBe("Copy chunk to left");

		expect(redoStateChangedHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: { canRedo: true, description: "Copy chunk to left" },
			}),
		);
	});

	it("should handle redo operation", async () => {
		vi.mocked(CanRedo).mockResolvedValue(true);
		vi.mocked(GetLastRedoOperationDescription).mockResolvedValue(
			"Copy chunk to left",
		);
		vi.mocked(RedoLastOperation).mockResolvedValue(undefined);

		const { component } = render(UndoManager);

		// First update state
		await component.refreshUndoState();

		const statusUpdateHandler = vi.fn();
		component.$on("statusUpdate", statusUpdateHandler);

		await component.redo();

		expect(RedoLastOperation).toHaveBeenCalled();
		expect(statusUpdateHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: { message: "Redoing last operation..." },
			}),
		);
		expect(statusUpdateHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: { message: "Redid: Copy chunk to left" },
			}),
		);
	});

	it("should handle redo error", async () => {
		const error = new Error("Redo failed");
		vi.mocked(RedoLastOperation).mockRejectedValue(error);

		const { component } = render(UndoManager);

		const statusUpdateHandler = vi.fn();
		component.$on("statusUpdate", statusUpdateHandler);

		await component.redo();

		expect(statusUpdateHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: { message: "Redo failed: Error: Redo failed" },
			}),
		);
	});

	it("should handle state when canRedo is false", async () => {
		vi.mocked(CanRedo).mockResolvedValue(false);

		const { component } = render(UndoManager);

		await component.refreshUndoState();

		expect(GetLastRedoOperationDescription).not.toHaveBeenCalled();

		const state = component.getRedoState();
		expect(state.canRedo).toBe(false);
		expect(state.lastRedoOperationDescription).toBe("");
	});

	it("should dispatch redoStateChanged event", async () => {
		vi.mocked(CanRedo).mockResolvedValue(true);
		vi.mocked(GetLastRedoOperationDescription).mockResolvedValue(
			"Remove chunk",
		);

		const { component } = render(UndoManager);

		const redoStateChangedHandler = vi.fn();
		component.$on("redoStateChanged", redoStateChangedHandler);

		await component.refreshUndoState();

		expect(redoStateChangedHandler).toHaveBeenCalledTimes(1);
		expect(redoStateChangedHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: { canRedo: true, description: "Remove chunk" },
			}),
		);
	});

	it("should handle undo/redo cycle", async () => {
		// Setup: operation exists, can undo
		vi.mocked(CanUndo).mockResolvedValue(true);
		vi.mocked(GetLastOperationDescription).mockResolvedValue("Test operation");
		vi.mocked(UndoLastOperation).mockResolvedValue(undefined);

		const { component } = render(UndoManager);
		await component.refreshUndoState();

		// Undo - should create redo possibility
		await component.undo();

		// After undo, can redo
		vi.mocked(CanUndo).mockResolvedValue(false);
		vi.mocked(CanRedo).mockResolvedValue(true);
		vi.mocked(GetLastRedoOperationDescription).mockResolvedValue(
			"Test operation",
		);
		vi.mocked(RedoLastOperation).mockResolvedValue(undefined);

		await component.refreshUndoState();

		const state = component.getRedoState();
		expect(state.canRedo).toBe(true);

		// Redo the operation
		await component.redo();

		expect(RedoLastOperation).toHaveBeenCalled();
	});
});
