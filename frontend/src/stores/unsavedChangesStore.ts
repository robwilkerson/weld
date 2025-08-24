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
		let hasUnsavedLeft = false;
		let hasUnsavedRight = false;

		if (leftFilePath) {
			hasUnsavedLeft = await HasUnsavedChanges(leftFilePath);
		}
		if (rightFilePath) {
			hasUnsavedRight = await HasUnsavedChanges(rightFilePath);
		}

		set({
			hasUnsavedLeftChanges: hasUnsavedLeft,
			hasUnsavedRightChanges: hasUnsavedRight,
		});

		// Update the menu items
		await UpdateSaveMenuItems(hasUnsavedLeft, hasUnsavedRight);
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

		if (state.hasUnsavedLeftChanges && leftFilePath) {
			await SaveChanges(leftFilePath);
		}
		if (state.hasUnsavedRightChanges && rightFilePath) {
			await SaveChanges(rightFilePath);
		}

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
