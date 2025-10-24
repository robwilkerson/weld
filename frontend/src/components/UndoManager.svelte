<script lang="ts">
import { createEventDispatcher, onDestroy, onMount } from "svelte";
import {
	CanRedo,
	CanUndo,
	GetLastOperationDescription,
	GetLastRedoOperationDescription,
	RedoLastOperation,
	UndoLastOperation,
} from "../../wailsjs/go/backend/App";
import { EventsOff, EventsOn } from "../../wailsjs/runtime/runtime";

export interface UndoManagerEvents {
	statusUpdate: { message: string };
	undoStateChanged: { canUndo: boolean; description: string };
	redoStateChanged: { canRedo: boolean; description: string };
}

const dispatch = createEventDispatcher<UndoManagerEvents>();

let canUndo = false;
let canRedo = false;
let lastOperationDescription = "";
let lastRedoOperationDescription = "";

// Public API exposed to parent
export async function undo(): Promise<void> {
	try {
		dispatch("statusUpdate", { message: "Undoing last operation..." });

		// Capture description BEFORE undo, so we show what was actually undone
		const undoneDesc = lastOperationDescription;

		await UndoLastOperation();

		// Update state
		await updateUndoRedoState();

		dispatch("statusUpdate", {
			message: undoneDesc ? `Undid: ${undoneDesc}` : "Undo complete",
		});
	} catch (error) {
		console.error("Undo failed:", error);
		dispatch("statusUpdate", {
			message: `Undo failed: ${error}`,
		});
	}
}

export async function redo(): Promise<void> {
	try {
		dispatch("statusUpdate", { message: "Redoing last operation..." });

		await RedoLastOperation();

		// Update state
		await updateUndoRedoState();

		dispatch("statusUpdate", {
			message: lastRedoOperationDescription
				? `Redid: ${lastRedoOperationDescription}`
				: "Redo complete",
		});
	} catch (error) {
		console.error("Redo failed:", error);
		dispatch("statusUpdate", {
			message: `Redo failed: ${error}`,
		});
	}
}

export function getUndoState() {
	return { canUndo, lastOperationDescription };
}

export function getRedoState() {
	return { canRedo, lastRedoOperationDescription };
}

async function updateUndoRedoState() {
	try {
		canUndo = await CanUndo();
		lastOperationDescription = canUndo
			? await GetLastOperationDescription()
			: "";

		canRedo = await CanRedo();
		lastRedoOperationDescription = canRedo
			? await GetLastRedoOperationDescription()
			: "";

		dispatch("undoStateChanged", {
			canUndo,
			description: lastOperationDescription,
		});

		dispatch("redoStateChanged", {
			canRedo,
			description: lastRedoOperationDescription,
		});
	} catch (error) {
		console.error("Failed to update undo/redo state:", error);
	}
}

// Handle menu-triggered undo
async function handleMenuUndo() {
	await undo();
}

// Handle menu-triggered redo
async function handleMenuRedo() {
	await redo();
}

// Update undo/redo state periodically or after operations
export async function refreshUndoState() {
	await updateUndoRedoState();
}

onMount(() => {
	// Listen for menu events
	EventsOn("menu-undo", handleMenuUndo);
	EventsOn("menu-redo", handleMenuRedo);

	// Initial state update
	updateUndoRedoState();
});

onDestroy(() => {
	EventsOff("menu-undo");
	EventsOff("menu-redo");
});
</script>