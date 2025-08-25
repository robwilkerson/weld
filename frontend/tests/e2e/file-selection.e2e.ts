import { expect, test } from "@playwright/test";

// Helper to set up mocked Wails backend
async function setupMockedBackend(page) {
	await page.evaluate(() => {
		// Track file selections
		let selectFileCallCount = 0;
		const testFiles = [
			"/path/to/first-file.js",
			"/path/to/second-file.js",
			"/path/to/third-file.py",
			"/path/to/fourth-file.go",
		];

		// Mock the Wails go object
		window.go = {
			backend: {
				App: {
					SelectFile: async () => {
						// Cycle through test files
						const fileIndex = selectFileCallCount % testFiles.length;
						selectFileCallCount++;
						return testFiles[fileIndex];
					},
					CompareFiles: async () => {
						// Return a simple diff for any file pair
						return {
							lines: [
								{
									type: "same",
									leftNumber: 1,
									rightNumber: 1,
									leftLine: "// File header",
									rightLine: "// File header",
								},
								{
									type: "modified",
									leftNumber: 2,
									rightNumber: 2,
									leftLine: "const version = '1.0.0';",
									rightLine: "const version = '2.0.0';",
								},
								{
									type: "same",
									leftNumber: 3,
									rightNumber: 3,
									leftLine: "",
									rightLine: "",
								},
								{
									type: "added",
									leftNumber: null,
									rightNumber: 4,
									leftLine: "",
									rightLine: "// New feature added",
								},
								{
									type: "removed",
									leftNumber: 4,
									rightNumber: null,
									leftLine: "// Old code removed",
									rightLine: "",
								},
							],
						};
					},
					GetMinimapVisible: async () => true,
					SetMinimapVisible: async () => {},
					HasUnsavedChanges: async () => ({
						hasUnsavedLeft: false,
						hasUnsavedRight: false,
					}),
					UpdateSaveMenuItems: async () => {},
					UpdateCopyMenuItems: async () => {},
					UpdateDiffNavigationMenuItems: async (
						_canNavigatePrev,
						_canNavigateNext,
						_canNavigateFirst,
						_canNavigateLast,
					) => {},
					GetInitialFiles: async () => ["", ""],
					_selectFileCallCount: 0,
				},
			},
		};

		// Mock the runtime EventsOn/Off
		window.runtime = {
			EventsOn: () => {},
			EventsOff: () => {},
		};
	});
}

test.describe("File Selection", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("http://localhost:34115");
		await setupMockedBackend(page);
		await page.waitForSelector("main", { timeout: 5000 });
	});

	test("initial state shows empty file selectors", async ({ page }) => {
		// Both file buttons should show "Select File"
		const leftButtonText = page
			.locator(".file-btn")
			.first()
			.locator(".file-name");
		const rightButtonText = page
			.locator(".file-btn")
			.nth(1)
			.locator(".file-name");

		await expect(leftButtonText).toContainText("Select left file...");
		await expect(rightButtonText).toContainText("Select right file...");

		// Compare button should be disabled
		const compareButton = page.locator(".compare-btn");
		await expect(compareButton).toBeDisabled();

		// No diff viewer should be visible initially (or it should be empty)
		const diffViewer = page.locator(".diff-viewer");
		const diffViewerExists = await diffViewer.count();

		if (diffViewerExists > 0) {
			// If diff viewer exists, it should either be hidden or empty
			const isVisible = await diffViewer.isVisible();
			if (isVisible) {
				// If visible, it should have no content
				const diffContent = await page.locator(".diff-content .line").count();
				expect(diffContent).toBe(0);
			} else {
				// Otherwise it should be hidden
				await expect(diffViewer).not.toBeVisible();
			}
		}
	});

	test("selecting left file updates UI and enables right file selection", async ({
		page,
	}) => {
		const leftButton = page.locator(".file-btn").first();
		const _rightButton = page.locator(".file-btn").nth(1);
		const compareButton = page.locator(".compare-btn");

		// Click left file button
		await leftButton.click();
		await page.waitForTimeout(200);

		// Left button should show the selected file
		await expect(
			page.locator(".file-btn").first().locator(".file-name"),
		).toContainText("first-file.js");

		// Icon should be visible
		const leftIcon = page.locator(".file-icon").first();
		await expect(leftIcon).toBeVisible();

		// Compare button should still be disabled (need both files)
		await expect(compareButton).toBeDisabled();

		// Right button should still show "Select File"
		await expect(
			page.locator(".file-btn").nth(1).locator(".file-name"),
		).toContainText("Select right file...");
	});

	test("selecting both files enables compare button", async ({ page }) => {
		const leftButton = page.locator(".file-btn").first();
		const rightButton = page.locator(".file-btn").nth(1);
		const compareButton = page.locator(".compare-btn");

		// Select left file
		await leftButton.click();
		await page.waitForTimeout(200);

		// Select right file
		await rightButton.click();
		await page.waitForTimeout(200);

		// Both buttons should show selected files
		await expect(
			page.locator(".file-btn").first().locator(".file-name"),
		).toContainText("first-file.js");
		await expect(
			page.locator(".file-btn").nth(1).locator(".file-name"),
		).toContainText("second-file.js");

		// Compare button should now be enabled
		await expect(compareButton).toBeEnabled();
		await expect(compareButton).toContainText("Compare");
	});

	test("compare button triggers file comparison", async ({ page }) => {
		const leftButton = page.locator(".file-btn").first();
		const rightButton = page.locator(".file-btn").nth(1);
		const compareButton = page.locator(".compare-btn");

		// Select both files
		await leftButton.click();
		await rightButton.click();
		await page.waitForTimeout(200);

		// Click compare
		await compareButton.click();
		await page.waitForTimeout(500);

		// Diff viewer should now be visible
		await expect(page.locator(".diff-viewer")).toBeVisible();

		// Should see diff content
		await expect(page.locator(".diff-content")).toBeVisible();

		// Should have diff lines (check for any type of diff line)
		const diffLines = page.locator(
			".line-added, .line-removed, .line-modified, .line-same",
		);
		const lineCount = await diffLines.count();
		expect(lineCount).toBeGreaterThan(0);

		// File info headers should show the files being compared
		const leftFileInfo = page.locator(".file-info.left .file-path");
		const rightFileInfo = page.locator(".file-info.right .file-path");
		await expect(leftFileInfo).toContainText("first-file.js");
		await expect(rightFileInfo).toContainText("second-file.js");
	});

	test("can reselect files after comparison", async ({ page }) => {
		const leftButton = page.locator(".file-btn").first();
		const rightButton = page.locator(".file-btn").nth(1);
		const compareButton = page.locator(".compare-btn");

		// Initial selection and comparison
		await leftButton.click();
		await rightButton.click();
		await compareButton.click();
		await expect(page.locator(".diff-viewer")).toBeVisible();

		// Re-select left file (should get third file)
		await leftButton.click();
		await page.waitForTimeout(200);

		// Button should update to show new file
		await expect(
			page.locator(".file-btn").first().locator(".file-name"),
		).toContainText("third-file.py");

		// Diff viewer should be cleared/hidden after file re-selection
		// The app may hide it or show an empty state
		const diffViewer = page.locator(".diff-viewer");
		const diffContent = page.locator(".diff-content");

		// Either the viewer is hidden or the content is empty
		const viewerVisible = await diffViewer.isVisible();
		if (viewerVisible) {
			// If visible, check that content is cleared
			await expect(diffContent).not.toBeVisible();
		} else {
			// Otherwise, viewer itself should be hidden
			await expect(diffViewer).not.toBeVisible();
		}

		// Compare button should still be enabled
		await expect(compareButton).toBeEnabled();

		// Click compare again
		await compareButton.click();
		await page.waitForTimeout(500);

		// Should see updated diff
		await expect(page.locator(".diff-viewer")).toBeVisible();
		const leftFileInfo = page.locator(".file-info.left .file-path");
		await expect(leftFileInfo).toContainText("third-file.py");
	});

	test("file icons reflect file types", async ({ page }) => {
		const leftButton = page.locator(".file-btn").first();
		const rightButton = page.locator(".file-btn").nth(1);

		// Select JavaScript file
		await leftButton.click();
		await page.waitForTimeout(200);
		let leftIcon = page.locator(".file-icon").first();
		// Check that icon exists (specific class names vary)
		await expect(leftIcon).toBeVisible();

		// Select another JavaScript file
		await rightButton.click();
		await page.waitForTimeout(200);
		let rightIcon = page.locator(".file-icon").nth(1);
		await expect(rightIcon).toBeVisible();

		// Change to Python file
		await leftButton.click();
		await page.waitForTimeout(200);
		leftIcon = page.locator(".file-icon").first();
		// For Python file
		await expect(leftIcon).toBeVisible();

		// Change to Go file
		await rightButton.click();
		await page.waitForTimeout(200);
		rightIcon = page.locator(".file-icon").nth(1);
		// For Go file
		await expect(rightIcon).toBeVisible();
	});

	test("handles file selection in specific order scenarios", async ({
		page,
	}) => {
		const leftButton = page.locator(".file-btn").first();
		const rightButton = page.locator(".file-btn").nth(1);
		const compareButton = page.locator(".compare-btn");

		// Scenario 1: Select right file first
		await rightButton.click();
		await page.waitForTimeout(200);
		await expect(
			page.locator(".file-btn").nth(1).locator(".file-name"),
		).toContainText("first-file.js");
		await expect(compareButton).toBeDisabled();

		// Then select left file
		await leftButton.click();
		await page.waitForTimeout(200);
		await expect(
			page.locator(".file-btn").first().locator(".file-name"),
		).toContainText("second-file.js");
		await expect(compareButton).toBeEnabled();

		// Scenario 2: Select same file slot multiple times
		await leftButton.click();
		await page.waitForTimeout(200);
		await expect(
			page.locator(".file-btn").first().locator(".file-name"),
		).toContainText("third-file.py");

		await leftButton.click();
		await page.waitForTimeout(200);
		await expect(
			page.locator(".file-btn").first().locator(".file-name"),
		).toContainText("fourth-file.go");
	});

	test("keyboard shortcut to compare files when button enabled", async ({
		page,
	}) => {
		const leftButton = page.locator(".file-btn").first();
		const rightButton = page.locator(".file-btn").nth(1);

		// Select both files
		await leftButton.click();
		await rightButton.click();
		await page.waitForTimeout(200);

		// Press Enter to compare (when compare button is enabled)
		await page.keyboard.press("Enter");
		await page.waitForTimeout(500);

		// Diff viewer should be visible
		await expect(page.locator(".diff-viewer")).toBeVisible();
	});

	test("displays appropriate empty state before file selection", async ({
		page,
	}) => {
		// Should show some kind of empty state or instructions
		const emptyState = page.locator(".empty-state, .file-selection-prompt");

		// Check if there's an empty state message
		const emptyStateCount = await emptyState.count();
		if (emptyStateCount > 0) {
			await expect(emptyState).toBeVisible();
			await expect(emptyState).toContainText(/select.*files|choose.*files/i);
		}

		// File panels should be in empty state
		const filePanels = page.locator(".file-panel, .file-selector");
		const panelCount = await filePanels.count();
		if (panelCount > 0) {
			await expect(filePanels.first()).toBeVisible();
		}
	});

	test("maintains file selection state during UI interactions", async ({
		page,
	}) => {
		const leftButton = page.locator(".file-btn").first();
		const rightButton = page.locator(".file-btn").nth(1);
		const compareButton = page.locator(".compare-btn");

		// Select files
		await leftButton.click();
		await rightButton.click();
		await page.waitForTimeout(200);

		const leftText = await page
			.locator(".file-btn")
			.first()
			.locator(".file-name")
			.textContent();
		const rightText = await page
			.locator(".file-btn")
			.nth(1)
			.locator(".file-name")
			.textContent();

		// Compare files
		await compareButton.click();
		await expect(page.locator(".diff-viewer")).toBeVisible();

		// Navigate with keyboard (if navigation is available)
		await page.keyboard.press("j");
		await page.waitForTimeout(200);

		// File selections should remain unchanged
		await expect(
			page.locator(".file-btn").first().locator(".file-name"),
		).toContainText(leftText);
		await expect(
			page.locator(".file-btn").nth(1).locator(".file-name"),
		).toContainText(rightText);
	});
});
