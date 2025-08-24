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
	CanUndo: vi.fn(),
	GetLastOperationDescription: vi.fn(),
}));

import {
	CanUndo,
	GetLastOperationDescription,
	UndoLastOperation,
} from "../../wailsjs/go/backend/App";

describe("UndoManager", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockEventHandlers.clear();
		// Set default return values
		vi.mocked(CanUndo).mockResolvedValue(false);
		vi.mocked(GetLastOperationDescription).mockResolvedValue("");
	});

	it("should expose public API methods", () => {
		const { component } = render(UndoManager);

		expect(typeof component.undo).toBe("function");
		expect(typeof component.getUndoState).toBe("function");
		expect(typeof component.refreshUndoState).toBe("function");
	});

	it("should initialize with default state", () => {
		const { component } = render(UndoManager);

		const state = component.getUndoState();
		expect(state.canUndo).toBe(false);
		expect(state.lastOperationDescription).toBe("");
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
});
