import { derived, get, writable } from "svelte/store";

interface FileState {
	leftFilePath: string;
	rightFilePath: string;
	leftFileName: string;
	rightFileName: string;
}

function createFileStore() {
	const { subscribe, set, update } = writable<FileState>({
		leftFilePath: "",
		rightFilePath: "",
		leftFileName: "Select left file...",
		rightFileName: "Select right file...",
	});

	return {
		subscribe,

		// Set left file
		setLeftFile(path: string, fileName?: string): void {
			update((state) => ({
				...state,
				leftFilePath: path,
				leftFileName:
					fileName || path.split("/").pop() || "Select left file...",
			}));
		},

		// Set right file
		setRightFile(path: string, fileName?: string): void {
			update((state) => ({
				...state,
				rightFilePath: path,
				rightFileName:
					fileName || path.split("/").pop() || "Select right file...",
			}));
		},

		// Set both files at once (useful for initial load)
		setBothFiles(leftPath: string, rightPath: string): void {
			set({
				leftFilePath: leftPath,
				rightFilePath: rightPath,
				leftFileName: leftPath.split("/").pop() || "Select left file...",
				rightFileName: rightPath.split("/").pop() || "Select right file...",
			});
		},

		// Clear file selections
		clear(): void {
			set({
				leftFilePath: "",
				rightFilePath: "",
				leftFileName: "Select left file...",
				rightFileName: "Select right file...",
			});
		},

		// Get current state
		getState(): FileState {
			return get({ subscribe });
		},
	};
}

export const fileStore = createFileStore();

// Derived store to check if both files are selected
export const bothFilesSelected = derived(
	fileStore,
	($fileStore) => !!$fileStore.leftFilePath && !!$fileStore.rightFilePath,
);

// Derived store to check if same file is selected on both sides
export const isSameFile = derived(
	fileStore,
	($fileStore) =>
		!!$fileStore.leftFilePath &&
		!!$fileStore.rightFilePath &&
		$fileStore.leftFilePath === $fileStore.rightFilePath,
);
