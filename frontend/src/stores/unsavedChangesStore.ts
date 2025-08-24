import { derived, get, writable } from "svelte/store";
import {
	HasUnsavedChanges,
	SaveChanges,
	UpdateSaveMenuItems,
} from "../../wailsjs/go/backend/App.js";
import { fileStore } from "./fileStore";

interface UnsavedChangesState {
	hasUnsavedLeftChanges: boolean;
	hasUnsavedRightChanges: boolean;
}

function createUnsavedChangesStore() {
	const { subscribe, set } = writable<UnsavedChangesState>({
		hasUnsavedLeftChanges: false,
		hasUnsavedRightChanges: false,
	});

	// Update unsaved changes status for both files
	async function updateStatus(): Promise<void> {
		const { leftFilePath, rightFilePath } = get(fileStore);
		try {
			const [hasUnsavedLeft, hasUnsavedRight] = await Promise.all([
				leftFilePath ? HasUnsavedChanges(leftFilePath) : Promise.resolve(false),
				rightFilePath
					? HasUnsavedChanges(rightFilePath)
					: Promise.resolve(false),
			]);

			set({
				hasUnsavedLeftChanges: hasUnsavedLeft,
				hasUnsavedRightChanges: hasUnsavedRight,
			});

			await UpdateSaveMenuItems(hasUnsavedLeft, hasUnsavedRight);
		} catch (e) {
			// Fail safe to a known state and keep the menu consistent
			set({ hasUnsavedLeftChanges: false, hasUnsavedRightChanges: false });
			await UpdateSaveMenuItems(false, false);
			// Optional: surface via a UI store if desired instead of console
			console.error("Failed to update unsaved changes status:", e);
		}
	}

	// Save the left file
	async function saveLeft(): Promise<void> {
		const { leftFilePath } = get(fileStore);
		if (!leftFilePath) return;

		await SaveChanges(leftFilePath);
		await updateStatus();
	}

	// Save the right file
	async function saveRight(): Promise<void> {
		const { rightFilePath } = get(fileStore);
		if (!rightFilePath) return;

		await SaveChanges(rightFilePath);
		await updateStatus();
	}

	// Save all files with unsaved changes
	async function saveAll(): Promise<void> {
		const state = get({ subscribe });
		const { leftFilePath, rightFilePath } = get(fileStore);

		const ops: Array<Promise<unknown>> = [];
		if (state.hasUnsavedLeftChanges && leftFilePath) {
			ops.push(SaveChanges(leftFilePath));
		}
		if (state.hasUnsavedRightChanges && rightFilePath) {
			ops.push(SaveChanges(rightFilePath));
		}
		await Promise.allSettled(ops);
		await updateStatus();
	}

	// Get current state
	function getState(): UnsavedChangesState {
		return get({ subscribe });
	}

	return {
		subscribe,
		updateStatus,
		saveLeft,
		saveRight,
		saveAll,
		getState,
	};
}

export const unsavedChangesStore = createUnsavedChangesStore();

// Derived stores for individual status
export const hasUnsavedLeftChanges = derived(
	unsavedChangesStore,
	($unsavedChanges) => $unsavedChanges.hasUnsavedLeftChanges,
);

export const hasUnsavedRightChanges = derived(
	unsavedChangesStore,
	($unsavedChanges) => $unsavedChanges.hasUnsavedRightChanges,
);

// Derived store for any unsaved changes
export const hasAnyUnsavedChanges = derived(
	unsavedChangesStore,
	($unsavedChanges) =>
		$unsavedChanges.hasUnsavedLeftChanges ||
		$unsavedChanges.hasUnsavedRightChanges,
);
