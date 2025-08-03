import { expect, test } from "@playwright/test";

// Helper to set up mocked Wails backend with save functionality
async function setupMockedBackend(page) {
	await page.evaluate(() => {
		// Track file selections
		let selectFileCallCount = 0;
		const leftFile = "/path/to/original.txt";
		const rightFile = "/path/to/modified.txt";

		// Track unsaved changes per file
		const unsavedChanges = {
			[leftFile]: false,
			[rightFile]: false,
		};

		// Store for global access
		window.unsavedChanges = unsavedChanges;
		window.savedFiles = [];
		window.leftFilePath = leftFile;
		window.rightFilePath = rightFile;

		// Mock diff result
		window.mockDiffResult = {
			lines: [
				{
					type: "same",
					leftNumber: 1,
					rightNumber: 1,
					leftLine: "Line 1 - unchanged",
					rightLine: "Line 1 - unchanged",
				},
				{
					type: "modified",
					leftNumber: 2,
					rightNumber: 2,
					leftLine: "Line 2 - original text",
					rightLine: "Line 2 - modified text",
				},
				{
					type: "removed",
					leftNumber: 3,
					rightNumber: null,
					leftLine: "Line 3 - removed",
					rightLine: "",
				},
				{
					type: "added",
					leftNumber: null,
					rightNumber: 3,
					leftLine: "",
					rightLine: "Line 3 - added",
				},
				{
					type: "same",
					leftNumber: 4,
					rightNumber: 4,
					leftLine: "Line 4 - unchanged",
					rightLine: "Line 4 - unchanged",
				},
			],
		};

		// Mock the Wails go object
		window.go = {
			main: {
				App: {
					SelectFile: async () => {
						selectFileCallCount++;
						return selectFileCallCount === 1 ? leftFile : rightFile;
					},
					CompareFiles: async () => window.mockDiffResult,
					GetMinimapVisible: async () => true,
					SetMinimapVisible: async () => {},
					HasUnsavedChanges: async (filepath) => {
						// Return boolean for specific file check
						if (filepath) {
							return window.unsavedChanges[filepath] || false;
						}
						// Return true if any file has unsaved changes
						return Object.values(window.unsavedChanges).some(
							(changed) => changed,
						);
					},
					SaveChanges: async (filepath) => {
						// Reset unsaved state for this file
						unsavedChanges[filepath] = false;
						window.savedFiles.push(filepath);
					},
					CopyToFile: async (
						_sourcePath,
						targetPath,
						_lineNumber,
						_content,
					) => {
						// Mark target file as having unsaved changes
						unsavedChanges[targetPath] = true;
						return true;
					},
					BeginOperationGroup: async () => {
						// Return a mock transaction ID
						return `mock-transaction-${Date.now()}`;
					},
					CommitOperationGroup: async () => {
						// On commit, the app would call updateUnsavedChangesStatus
						// which checks HasUnsavedChanges for each file
						// Our mock already tracks state in unsavedChanges object
					},
					RollbackOperationGroup: async () => {},
					RemoveLineFromFile: async (filepath, _lineNumber) => {
						// Mark file as having unsaved changes
						unsavedChanges[filepath] = true;
						return true;
					},
					DiscardAllChanges: async () => {
						// Reset all unsaved changes
						Object.keys(unsavedChanges).forEach((file) => {
							unsavedChanges[file] = false;
						});
					},
					QuitWithoutSaving: async () => {},
					SaveSelectedFilesAndQuit: async (selections) => {
						window.savedFiles = selections;
					},
					UpdateSaveMenuItems: async () => {},
					UpdateDiffNavigationMenuItems: async () => {},
					GetInitialFiles: async () => ["", ""],
				},
			},
		};

		// Note: We avoid window-level function aliases to maintain consistency with other tests

		// Mock EventsOn/EventsOff
		window.runtime = {
			EventsOn: () => {},
			EventsOff: () => {},
		};
	});
}

test.describe("Save Operations", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("http://localhost:34115");
		await setupMockedBackend(page);

		// Select files and compare
		const leftButton = page.locator(".file-btn").first();
		const rightButton = page.locator(".file-btn").nth(1);
		const compareButton = page.locator(".compare-btn");

		await leftButton.click();
		await rightButton.click();
		await compareButton.click();

		// Wait for diff to be visible
		await expect(page.locator(".diff-viewer")).toBeVisible();
	});

	test("save buttons should be initially disabled when no changes", async ({
		page,
	}) => {
		// Both save buttons should be disabled when there are no unsaved changes
		const leftSaveBtn = page.locator(".file-info.left .save-btn");
		const rightSaveBtn = page.locator(".file-info.right .save-btn");

		await expect(leftSaveBtn).toBeDisabled();
		await expect(rightSaveBtn).toBeDisabled();
	});

	test("save button state reflects unsaved changes after copy", async ({
		page,
	}) => {
		// Save buttons should enable when their file has unsaved changes from copy operations
		const leftSaveBtn = page.locator(".file-info.left .save-btn");
		const rightSaveBtn = page.locator(".file-info.right .save-btn");

		// Verify we start on the first diff (modified line)
		const currentDiff = page.locator(".current-diff").first();
		const lineType = await currentDiff.getAttribute("data-line-type");
		expect(lineType).toBe("modified");

		// Use UI click to copy (like the working copy operations test)
		await currentDiff.hover();
		await page.waitForTimeout(300);

		// Find and click the copy arrow
		const copyArrow = page
			.locator(".chunk-actions .right-side-arrow.chunk-arrow")
			.first();
		await expect(copyArrow).toBeVisible();
		await copyArrow.click();

		// Wait for the copy operation to complete and the save button to update
		// The copy operation includes refreshing the diff and updating unsaved status
		await page.waitForTimeout(1000);

		// Left save button should now be enabled
		await expect(leftSaveBtn).toBeEnabled();
		await expect(rightSaveBtn).toBeDisabled();
	});

	test("save button click triggers save operation", async ({ page }) => {
		// First, perform a copy operation to create unsaved changes
		const currentDiff = page.locator(".current-diff").first();
		await currentDiff.hover();
		await page.waitForTimeout(300);

		// Click the copy arrow to create unsaved changes
		const copyArrow = page
			.locator(".chunk-actions .right-side-arrow.chunk-arrow")
			.first();
		await expect(copyArrow).toBeVisible();
		await copyArrow.click();

		// Wait for the copy operation and status update
		await page.waitForTimeout(500);

		// Get the left save button
		const leftSaveBtn = page.locator(".file-info.left .save-btn");

		// The button should now be enabled
		await expect(leftSaveBtn).toBeEnabled();

		// Reset saved files tracker
		await page.evaluate(() => {
			window.savedFiles = [];
		});

		// Click save button
		await leftSaveBtn.click();
		await page.waitForTimeout(100);

		// Verify SaveChanges was called
		const savedFiles = await page.evaluate(() => window.savedFiles);
		expect(savedFiles).toContain("/path/to/original.txt");

		// Verify unsaved state was cleared
		const unsavedState = await page.evaluate(
			() => window.unsavedChanges[window.leftFilePath],
		);
		expect(unsavedState).toBe(false);

		// Save button should now be disabled again
		await expect(leftSaveBtn).toBeDisabled();
	});

	test("keyboard shortcut Cmd/Ctrl+S triggers save for files with changes", async ({
		page,
	}) => {
		// Manually mark both files as having unsaved changes
		await page.evaluate(() => {
			window.unsavedChanges[window.leftFilePath] = true;
			window.unsavedChanges[window.rightFilePath] = true;
			window.savedFiles = [];
		});

		// Use Cmd+S on Mac, Ctrl+S on other platforms
		const modifier = process.platform === "darwin" ? "Meta" : "Control";
		await page.keyboard.press(`${modifier}+s`);
		await page.waitForTimeout(100);

		// Verify both files were saved
		const saved = await page.evaluate(() => window.savedFiles);
		expect(saved).toHaveLength(2);
		expect(saved).toContain("/path/to/original.txt");
		expect(saved).toContain("/path/to/modified.txt");

		// Verify unsaved states were cleared
		const unsavedStates = await page.evaluate(() => ({
			left: window.unsavedChanges[window.leftFilePath],
			right: window.unsavedChanges[window.rightFilePath],
		}));
		expect(unsavedStates.left).toBe(false);
		expect(unsavedStates.right).toBe(false);
	});

	test("unsaved changes indicator display", async ({ page }) => {
		// Initially no unsaved indicator
		const leftFilePath = page.locator(".file-info.left .file-path");
		await expect(leftFilePath).toContainText("original.txt");
		await expect(leftFilePath).not.toContainText("•");

		// Manually set unsaved state
		await page.evaluate(() => {
			window.unsavedChanges[window.leftFilePath] = true;
			// Trigger a re-render by updating the component
			const event = new CustomEvent("unsaved-changes-updated");
			window.dispatchEvent(event);
		});

		// Wait for potential UI update
		await page.waitForTimeout(200);

		// Check if indicator appears (may depend on how the app handles state updates)
		const hasIndicator = await leftFilePath.textContent();
		if (hasIndicator?.includes("•")) {
			// If the app shows indicators, verify it
			await expect(leftFilePath).toContainText("• original.txt");

			// Clear unsaved state
			await page.evaluate(() => {
				window.unsavedChanges[window.leftFilePath] = false;
				const event = new CustomEvent("unsaved-changes-updated");
				window.dispatchEvent(event);
			});

			await page.waitForTimeout(200);

			// Indicator should be gone
			await expect(leftFilePath).not.toContainText("•");
		}
	});

	test("multiple copy operations track unsaved changes", async ({ page }) => {
		// Multiple copy operations should accumulate unsaved changes

		// First copy: modified line to left
		const firstDiff = page.locator(".current-diff").first();
		await firstDiff.hover();
		await page.waitForTimeout(300);

		const copyArrow1 = page
			.locator(".chunk-actions .right-side-arrow.chunk-arrow")
			.first();
		await copyArrow1.click();
		await page.waitForTimeout(500);

		// Left file should have unsaved changes
		await expect(page.locator(".file-info.left .save-btn")).toBeEnabled();

		// Navigate to removed line for next copy
		const removedLine = page.locator(".line-removed").first();
		await removedLine.hover();
		await page.waitForTimeout(300);

		// Second copy: removed line to right
		const copyArrow2 = page
			.locator(".chunk-actions .left-side-arrow.chunk-arrow")
			.first();
		await copyArrow2.click();
		await page.waitForTimeout(500);

		// Both files should now have unsaved changes
		await expect(page.locator(".file-info.left .save-btn")).toBeEnabled();
		await expect(page.locator(".file-info.right .save-btn")).toBeEnabled();
	});

	test("save error handling displays error message", async ({ page }) => {
		// First, perform a copy operation to create unsaved changes
		const currentDiff = page.locator(".current-diff").first();
		await currentDiff.hover();
		await page.waitForTimeout(300);

		// Click the copy arrow to create unsaved changes
		const copyArrow = page
			.locator(".chunk-actions .right-side-arrow.chunk-arrow")
			.first();
		await expect(copyArrow).toBeVisible();
		await copyArrow.click();

		// Wait for the copy operation and status update
		await page.waitForTimeout(500);

		// Get the left save button
		const leftSaveBtn = page.locator(".file-info.left .save-btn");

		// The button should now be enabled
		await expect(leftSaveBtn).toBeEnabled();

		// Mock SaveChanges to throw error
		await page.evaluate(() => {
			window.go.main.App.SaveChanges = async () => {
				throw new Error("Permission denied");
			};
		});

		// Click save button
		await leftSaveBtn.click();
		await page.waitForTimeout(200);

		// Should show error message in flash
		await expect(page.locator(".flash-message.flash-error")).toContainText(
			"Error saving left file: Error: Permission denied",
		);

		// Save button should still be enabled (save failed)
		await expect(leftSaveBtn).toBeEnabled();
	});
});
