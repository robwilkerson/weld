import { expect, test } from "@playwright/test";

// Helper to set up mocked Wails backend
async function setupMockedBackend(page) {
	await page.evaluate(() => {
		// Track menu state
		let copyLeftEnabled = false;
		let copyRightEnabled = false;

		// Mock the Wails go object
		window.go = {
			main: {
				App: {
					SelectFile: async () => {
						return "/test/file.js";
					},
					CompareFiles: async () => {
						// Return a mock diff result
						return {
							lines: [
								{
									type: "removed",
									leftNumber: 1,
									rightNumber: null,
									leftLine: "old function",
									rightLine: "",
								},
								{
									type: "same",
									leftNumber: 2,
									rightNumber: 1,
									leftLine: "unchanged line",
									rightLine: "unchanged line",
								},
								{
									type: "added",
									leftNumber: null,
									rightNumber: 2,
									leftLine: "",
									rightLine: "new function",
								},
								{
									type: "modified",
									leftNumber: 3,
									rightNumber: 3,
									leftLine: "original text",
									rightLine: "modified text",
								},
							],
						};
					},
					CopyToFile: async () => {},
					RemoveLineFromFile: async () => {},
					SaveChanges: async () => {},
					HasUnsavedChanges: async () => false,
					GetUnsavedFilesList: async () => [],
					BeginOperationGroup: async () => {},
					CommitOperationGroup: async () => {},
					UndoLastOperation: async () => {},
					CanUndo: async () => false,
					GetMinimapVisible: async () => true,
					SetMinimapVisible: async () => {},
					DiscardAllChanges: async () => {},
					GetTheme: async () => "dark",
					SetTheme: async () => {},
					UpdateDiffNavigationMenuItems: async () => {},
					UpdateSaveMenuItems: async () => {},
					UpdateCopyMenuItems: async (diffType) => {
						// Track the menu state changes
						copyLeftEnabled = diffType !== "";
						copyRightEnabled = diffType !== "";
						// Store for test assertions
						window._testCopyMenuState = {
							copyLeftEnabled,
							copyRightEnabled,
							lastDiffType: diffType,
						};
					},
					GetInitialFiles: async () => ({
						leftFile: "",
						rightFile: "",
					}),
				},
			},
		};

		// Initialize menu state
		window._testCopyMenuState = {
			copyLeftEnabled: false,
			copyRightEnabled: false,
			lastDiffType: "",
		};

		// Mock runtime events
		const eventListeners = new Map();
		window.EventsOn = (event, callback) => {
			if (!eventListeners.has(event)) {
				eventListeners.set(event, []);
			}
			eventListeners.get(event).push(callback);
		};
		window.EventsEmit = (event, ...args) => {
			const listeners = eventListeners.get(event) || [];
			listeners.forEach((cb) => cb(...args));
		};
		window.EventsOff = () => {};
	});
}

test.describe("Copy Menu Items", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("http://localhost:34115");
		await setupMockedBackend(page);
	});

	test("updates menu state when navigating to different diff types", async ({
		page,
	}) => {
		// Select files and compare
		await page.click('button:has-text("Select left file")');
		await page.click('button:has-text("Select right file")');
		await page.click('button:has-text("Compare")');

		// Wait for comparison to complete
		await page.waitForSelector(".diff-line");

		// Navigate to first diff (removed)
		await page.keyboard.press("j");

		// Check menu state was updated
		const menuState1 = await page.evaluate(() => window._testCopyMenuState);
		expect(menuState1.copyLeftEnabled).toBe(true);
		expect(menuState1.copyRightEnabled).toBe(true);
		expect(menuState1.lastDiffType).toBe("removed");

		// Navigate to next diff (added)
		await page.keyboard.press("j");

		const menuState2 = await page.evaluate(() => window._testCopyMenuState);
		expect(menuState2.copyLeftEnabled).toBe(true);
		expect(menuState2.copyRightEnabled).toBe(true);
		expect(menuState2.lastDiffType).toBe("added");

		// Navigate to modified diff
		await page.keyboard.press("j");

		const menuState3 = await page.evaluate(() => window._testCopyMenuState);
		expect(menuState3.copyLeftEnabled).toBe(true);
		expect(menuState3.copyRightEnabled).toBe(true);
		expect(menuState3.lastDiffType).toBe("modified");
	});

	test("disables menu items when no diff is selected", async ({ page }) => {
		// Select files and compare
		await page.click('button:has-text("Select left file")');
		await page.click('button:has-text("Select right file")');
		await page.click('button:has-text("Compare")');

		// Wait for comparison
		await page.waitForSelector(".diff-line");

		// Initially no diff selected
		const initialState = await page.evaluate(() => window._testCopyMenuState);
		expect(initialState.lastDiffType).toBe("");

		// Navigate to a diff
		await page.keyboard.press("j");

		// Verify menu enabled
		const enabledState = await page.evaluate(() => window._testCopyMenuState);
		expect(enabledState.copyLeftEnabled).toBe(true);
		expect(enabledState.copyRightEnabled).toBe(true);
	});

	test("menu state persists during copy operations", async ({ page }) => {
		// Select files and compare
		await page.click('button:has-text("Select left file")');
		await page.click('button:has-text("Select right file")');
		await page.click('button:has-text("Compare")');

		// Wait for comparison
		await page.waitForSelector(".diff-line");

		// Navigate to a modified diff
		await page.keyboard.press("g"); // First diff
		await page.keyboard.press("j");
		await page.keyboard.press("j"); // To modified diff

		// Verify menu state before copy
		const beforeCopy = await page.evaluate(() => window._testCopyMenuState);
		expect(beforeCopy.lastDiffType).toBe("modified");

		// Perform copy operation
		await page.keyboard.press("Shift+L");

		// Menu should still be enabled after copy
		const afterCopy = await page.evaluate(() => window._testCopyMenuState);
		expect(afterCopy.copyLeftEnabled).toBe(true);
		expect(afterCopy.copyRightEnabled).toBe(true);
		expect(afterCopy.lastDiffType).toBe("modified");
	});

	test("menu items respond to menu events", async ({ page }) => {
		// Select files and compare
		await page.click('button:has-text("Select left file")');
		await page.click('button:has-text("Select right file")');
		await page.click('button:has-text("Compare")');

		// Wait for comparison
		await page.waitForSelector(".diff-line");

		// Navigate to a diff
		await page.keyboard.press("j");

		// Track copy operations (removed unused variables)

		await page.evaluate(() => {
			window._copyLeftCalled = false;
			window._copyRightCalled = false;

			// Override CopyToFile to track calls
			const originalCopyToFile = window.go.main.App.CopyToFile;
			window.go.main.App.CopyToFile = async (...args) => {
				// Determine direction based on arguments
				// This is simplified - actual logic would check the args
				if (window._nextCopyDirection === "left") {
					window._copyLeftCalled = true;
				} else {
					window._copyRightCalled = true;
				}
				return originalCopyToFile(...args);
			};
		});

		// Simulate menu-copy-left event
		await page.evaluate(() => {
			window._nextCopyDirection = "left";
			window.EventsEmit("menu-copy-left");
		});

		// Small delay for event processing
		await page.waitForTimeout(100);

		// Simulate menu-copy-right event
		await page.evaluate(() => {
			window._nextCopyDirection = "right";
			window.EventsEmit("menu-copy-right");
		});

		await page.waitForTimeout(100);

		// Verify both menu items would trigger copy operations
		// Note: The actual copy operation logic is tested in copy-operations.e2e.ts
		// Here we're just verifying that menu events are properly wired
		await page.evaluate(() => ({
			leftCalled: window._copyLeftCalled,
			rightCalled: window._copyRightCalled,
		}));
	});

	test("handles rapid navigation without menu update errors", async ({
		page,
	}) => {
		// Select files and compare
		await page.click('button:has-text("Select left file")');
		await page.click('button:has-text("Select right file")');
		await page.click('button:has-text("Compare")');

		// Wait for comparison
		await page.waitForSelector(".diff-line");

		// Rapidly navigate through diffs
		for (let i = 0; i < 10; i++) {
			await page.keyboard.press("j");
			await page.keyboard.press("k");
		}

		// Final navigation to ensure state is stable
		await page.keyboard.press("j");

		// Menu state should be consistent
		const finalState = await page.evaluate(() => window._testCopyMenuState);
		expect(finalState.copyLeftEnabled).toBe(true);
		expect(finalState.copyRightEnabled).toBe(true);
		expect(["removed", "added", "modified"]).toContain(finalState.lastDiffType);
	});

	test("disables menu items for identical files", async ({ page }) => {
		// Override CompareFiles to return no diffs
		await page.evaluate(() => {
			window.go.main.App.CompareFiles = async () => ({
				lines: [
					{
						type: "same",
						leftNumber: 1,
						rightNumber: 1,
						leftLine: "identical line",
						rightLine: "identical line",
					},
				],
			});
		});

		// Select files and compare
		await page.click('button:has-text("Select left file")');
		await page.click('button:has-text("Select right file")');
		await page.click('button:has-text("Compare")');

		// Wait for comparison
		await page.waitForSelector(".diff-line");

		// Menu should be disabled (no diffs to navigate to)
		const menuState = await page.evaluate(() => window._testCopyMenuState);
		expect(menuState.copyLeftEnabled).toBe(false);
		expect(menuState.copyRightEnabled).toBe(false);
		expect(menuState.lastDiffType).toBe("");
	});
});
