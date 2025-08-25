import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fileStore } from "./fileStore.js";
import {
	hasAnyUnsavedChanges,
	hasUnsavedLeftChanges,
	hasUnsavedRightChanges,
	unsavedChangesStore,
} from "./unsavedChangesStore.js";

// Mock the Wails functions
vi.mock("../../wailsjs/go/backend/App.js", () => ({
	HasUnsavedChanges: vi.fn(),
	SaveChanges: vi.fn(),
	UpdateSaveMenuItems: vi.fn(),
}));

import {
	HasUnsavedChanges,
	SaveChanges,
	UpdateSaveMenuItems,
} from "../../wailsjs/go/backend/App.js";

describe("unsavedChangesStore", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		fileStore.clear();
	});

	it("should have initial state with no unsaved changes", () => {
		const state = unsavedChangesStore.getState();
		expect(state.hasUnsavedLeftChanges).toBe(false);
		expect(state.hasUnsavedRightChanges).toBe(false);
	});

	it("should check unsaved status for both files", async () => {
		// Set up mocks
		vi.mocked(HasUnsavedChanges).mockImplementation(async (path: string) => {
			if (path === "/path/to/left.txt") return true;
			if (path === "/path/to/right.txt") return false;
			return false;
		});

		// Set up file paths
		fileStore.setLeftFile("/path/to/left.txt");
		fileStore.setRightFile("/path/to/right.txt");

		await unsavedChangesStore.updateStatus();

		expect(HasUnsavedChanges).toHaveBeenCalledWith("/path/to/left.txt");
		expect(HasUnsavedChanges).toHaveBeenCalledWith("/path/to/right.txt");
		expect(UpdateSaveMenuItems).toHaveBeenCalledWith(true, false);

		const state = unsavedChangesStore.getState();
		expect(state.hasUnsavedLeftChanges).toBe(true);
		expect(state.hasUnsavedRightChanges).toBe(false);
	});

	it("should save left file and update status", async () => {
		vi.mocked(SaveChanges).mockResolvedValue(undefined);
		vi.mocked(HasUnsavedChanges).mockResolvedValue(false);

		fileStore.setLeftFile("/path/to/left.txt");
		await unsavedChangesStore.saveLeft();

		expect(SaveChanges).toHaveBeenCalledWith("/path/to/left.txt");
		expect(HasUnsavedChanges).toHaveBeenCalled();
		expect(UpdateSaveMenuItems).toHaveBeenCalled();
	});

	it("should save all files with unsaved changes", async () => {
		// Set up unsaved status
		vi.mocked(HasUnsavedChanges).mockImplementation(async (path: string) => {
			if (path === "/path/to/left.txt") return true;
			if (path === "/path/to/right.txt") return true;
			return false;
		});
		vi.mocked(SaveChanges).mockResolvedValue(undefined);

		fileStore.setLeftFile("/path/to/left.txt");
		fileStore.setRightFile("/path/to/right.txt");

		// Update status first to set unsaved flags
		await unsavedChangesStore.updateStatus();

		// Clear mocks before save
		vi.clearAllMocks();

		// Now save all
		await unsavedChangesStore.saveAll();

		expect(SaveChanges).toHaveBeenCalledWith("/path/to/left.txt");
		expect(SaveChanges).toHaveBeenCalledWith("/path/to/right.txt");
		expect(SaveChanges).toHaveBeenCalledTimes(2);
	});

	it("should update derived stores correctly", async () => {
		vi.mocked(HasUnsavedChanges).mockImplementation(async (path: string) => {
			if (path === "/path/to/left.txt") return true;
			if (path === "/path/to/right.txt") return false;
			return false;
		});

		fileStore.setLeftFile("/path/to/left.txt");
		fileStore.setRightFile("/path/to/right.txt");

		await unsavedChangesStore.updateStatus();

		expect(get(hasUnsavedLeftChanges)).toBe(true);
		expect(get(hasUnsavedRightChanges)).toBe(false);
		expect(get(hasAnyUnsavedChanges)).toBe(true);

		// Change status
		vi.mocked(HasUnsavedChanges).mockResolvedValue(false);
		await unsavedChangesStore.updateStatus();

		expect(get(hasUnsavedLeftChanges)).toBe(false);
		expect(get(hasUnsavedRightChanges)).toBe(false);
		expect(get(hasAnyUnsavedChanges)).toBe(false);
	});
});
