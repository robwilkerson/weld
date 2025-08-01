import { get } from "svelte/store";
import { beforeEach, describe, expect, it } from "vitest";
import { bothFilesSelected, fileStore, isSameFile } from "./fileStore";

describe("fileStore", () => {
	beforeEach(() => {
		// Reset store before each test
		fileStore.clear();
	});

	describe("initial state", () => {
		it("should have empty file paths", () => {
			const state = get(fileStore);
			expect(state.leftFilePath).toBe("");
			expect(state.rightFilePath).toBe("");
		});

		it("should have default file names", () => {
			const state = get(fileStore);
			expect(state.leftFileName).toBe("Select left file...");
			expect(state.rightFileName).toBe("Select right file...");
		});
	});

	describe("setLeftFile", () => {
		it("should set left file path and name", () => {
			fileStore.setLeftFile("/path/to/file.js", "file.js");
			const state = get(fileStore);
			expect(state.leftFilePath).toBe("/path/to/file.js");
			expect(state.leftFileName).toBe("file.js");
		});

		it("should extract filename from path if not provided", () => {
			fileStore.setLeftFile("/path/to/myfile.js");
			const state = get(fileStore);
			expect(state.leftFilePath).toBe("/path/to/myfile.js");
			expect(state.leftFileName).toBe("myfile.js");
		});

		it("should use default name if path has no filename", () => {
			fileStore.setLeftFile("");
			const state = get(fileStore);
			expect(state.leftFileName).toBe("Select left file...");
		});
	});

	describe("setRightFile", () => {
		it("should set right file path and name", () => {
			fileStore.setRightFile("/path/to/file.js", "file.js");
			const state = get(fileStore);
			expect(state.rightFilePath).toBe("/path/to/file.js");
			expect(state.rightFileName).toBe("file.js");
		});

		it("should extract filename from path if not provided", () => {
			fileStore.setRightFile("/path/to/myfile.js");
			const state = get(fileStore);
			expect(state.rightFilePath).toBe("/path/to/myfile.js");
			expect(state.rightFileName).toBe("myfile.js");
		});
	});

	describe("setBothFiles", () => {
		it("should set both files at once", () => {
			fileStore.setBothFiles("/left/file.js", "/right/file.js");
			const state = get(fileStore);
			expect(state.leftFilePath).toBe("/left/file.js");
			expect(state.rightFilePath).toBe("/right/file.js");
			expect(state.leftFileName).toBe("file.js");
			expect(state.rightFileName).toBe("file.js");
		});
	});

	describe("clear", () => {
		it("should reset to initial state", () => {
			fileStore.setBothFiles("/left/file.js", "/right/file.js");
			fileStore.clear();
			const state = get(fileStore);
			expect(state.leftFilePath).toBe("");
			expect(state.rightFilePath).toBe("");
			expect(state.leftFileName).toBe("Select left file...");
			expect(state.rightFileName).toBe("Select right file...");
		});
	});

	describe("getState", () => {
		it("should return current state", () => {
			fileStore.setLeftFile("/test.js");
			const state = fileStore.getState();
			expect(state.leftFilePath).toBe("/test.js");
			expect(state.leftFileName).toBe("test.js");
		});
	});
});

describe("derived stores", () => {
	beforeEach(() => {
		fileStore.clear();
	});

	describe("bothFilesSelected", () => {
		it("should be false when no files selected", () => {
			expect(get(bothFilesSelected)).toBe(false);
		});

		it("should be false when only left file selected", () => {
			fileStore.setLeftFile("/left.js");
			expect(get(bothFilesSelected)).toBe(false);
		});

		it("should be false when only right file selected", () => {
			fileStore.setRightFile("/right.js");
			expect(get(bothFilesSelected)).toBe(false);
		});

		it("should be true when both files selected", () => {
			fileStore.setBothFiles("/left.js", "/right.js");
			expect(get(bothFilesSelected)).toBe(true);
		});
	});

	describe("isSameFile", () => {
		it("should be false when no files selected", () => {
			expect(get(isSameFile)).toBe(false);
		});

		it("should be false when different files selected", () => {
			fileStore.setBothFiles("/left.js", "/right.js");
			expect(get(isSameFile)).toBe(false);
		});

		it("should be true when same file selected", () => {
			fileStore.setBothFiles("/same.js", "/same.js");
			expect(get(isSameFile)).toBe(true);
		});
	});
});
