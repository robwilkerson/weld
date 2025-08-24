<script lang="ts">
import { createEventDispatcher, onDestroy, onMount } from "svelte";
import {
	CanUndo,
	GetLastOperationDescription,
	UndoLastOperation,
} from "../../wailsjs/go/backend/App";
import { EventsOff, EventsOn } from "../../wailsjs/runtime/runtime";

export interface UndoManagerEvents {
	statusUpdate: { message: string };
	undoStateChanged: { canUndo: boolean; description: string };
}

const dispatch = createEventDispatcher<UndoManagerEvents>();

let canUndo = false;
let lastOperationDescription = "";

// Public API exposed to parent
export async function undo(): Promise<void> {
	try {
		dispatch("statusUpdate", { message: "Undoing last operation..." });

		await UndoLastOperation();

		// Update state
		await updateUndoState();

		dispatch("statusUpdate", {
			message: lastOperationDescription
				? `Undid: ${lastOperationDescription}`
				: "Undo complete",
		});
	} catch (error) {
		console.error("Undo failed:", error);
		dispatch("statusUpdate", {
			message: `Undo failed: ${error}`,
		});
	}
}

export function getUndoState() {
	return { canUndo, lastOperationDescription };
}

async function updateUndoState() {
	try {
		canUndo = await CanUndo();
		lastOperationDescription = canUndo
			? await GetLastOperationDescription()
			: "";

		dispatch("undoStateChanged", {
			canUndo,
			description: lastOperationDescription,
		});
	} catch (error) {
		console.error("Failed to update undo state:", error);
	}
}

// Handle menu-triggered undo
async function handleMenuUndo() {
	await undo();
}

// Update undo state periodically or after operations
export async function refreshUndoState() {
	await updateUndoState();
}

onMount(() => {
	// Listen for menu events
	EventsOn("menu-undo", handleMenuUndo);

	// Initial state update
	updateUndoState();
});

onDestroy(() => {
	EventsOff("menu-undo");
});
</script>