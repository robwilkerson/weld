import { expect, test } from "@playwright/test";

// Helper to set up mocked Wails backend
async function setupMockedBackend(page) {
	await page.evaluate(() => {
		// Track which file button was clicked
		let selectFileCallCount = 0;

		// Mock the Wails go object
		window.go = {
			main: {
				App: {
					SelectFile: async () => {
						// Return different files for left/right
						selectFileCallCount++;
						return selectFileCallCount === 1
							? "/test/sample-files/addmiddle-1.go"
							: "/test/sample-files/addmiddle-2.go";
					},
					CompareFiles: async () => {
						// Return a mock diff result with 3 diff chunks
						return {
							lines: [
								// First chunk: added line
								{
									type: "same",
									leftNumber: 1,
									rightNumber: 1,
									leftLine: "package main",
									rightLine: "package main",
								},
								{
									type: "same",
									leftNumber: 2,
									rightNumber: 2,
									leftLine: "",
									rightLine: "",
								},
								{
									type: "added",
									leftNumber: null,
									rightNumber: 3,
									leftLine: "",
									rightLine: "// New comment added",
								},
								{
									type: "same",
									leftNumber: 3,
									rightNumber: 4,
									leftLine: "",
									rightLine: "",
								},

								// Second chunk: removed/added function
								{
									type: "same",
									leftNumber: 4,
									rightNumber: 5,
									leftLine: 'import "fmt"',
									rightLine: 'import "fmt"',
								},
								{
									type: "same",
									leftNumber: 5,
									rightNumber: 6,
									leftLine: "",
									rightLine: "",
								},
								{
									type: "removed",
									leftNumber: 6,
									rightNumber: null,
									leftLine: "func oldFunction() {}",
									rightLine: "",
								},
								{
									type: "added",
									leftNumber: null,
									rightNumber: 7,
									leftLine: "",
									rightLine: "func newFunction() {}",
								},
								{
									type: "same",
									leftNumber: 7,
									rightNumber: 8,
									leftLine: "",
									rightLine: "",
								},

								// Third chunk: modified lines
								{
									type: "modified",
									leftNumber: 8,
									rightNumber: 9,
									leftLine: "func main() {",
									rightLine: "func main() {",
								},
								{
									type: "modified",
									leftNumber: 9,
									rightNumber: 10,
									leftLine: '  fmt.Println("Original")',
									rightLine: '  fmt.Println("Updated")',
								},
								{
									type: "modified",
									leftNumber: 10,
									rightNumber: 11,
									leftLine: "}",
									rightLine: "}",
								},
							],
						};
					},
					GetMinimapVisible: async () => true,
					GetInitialFiles: async () => ["", ""],
					HasUnsavedChanges: async () => ({
						hasUnsavedLeft: false,
						hasUnsavedRight: false,
					}),
					UpdateDiffNavigationMenuItems: async (
						_canNavigatePrev,
						_canNavigateNext,
						_canNavigateFirst,
						_canNavigateLast,
					) => {},
					UpdateSaveMenuItems: async () => {},
					UpdateCopyMenuItems: async () => {},
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

test.describe("Keyboard Navigation", () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to dev server (requires 'wails dev' running)
		await page.goto("http://localhost:34115");

		// Set up mocked backend
		await setupMockedBackend(page);

		// Wait for app to load
		await page.waitForSelector("main", { timeout: 5000 });

		// Select files and compare
		const leftButton = page.locator(".file-btn").first();
		const rightButton = page.locator(".file-btn").nth(1);
		await leftButton.click();
		await rightButton.click();

		const compareButton = page.locator(".compare-btn");
		await compareButton.click();

		// Wait for diff to load
		await page.waitForSelector(".diff-content", { timeout: 5000 });
	});

	test("navigates between diffs with j/k keys", async ({ page }) => {
		// Should start at first diff (added line at line 3)
		const highlightedLines = await page.locator(".current-diff").all();
		expect(highlightedLines.length).toBeGreaterThan(0);

		// For added lines, check the right pane; for removed lines, check the left pane
		// First diff is an added line, so it should be visible on the right pane
		const firstLineNumber = await page
			.locator(".right-pane .current-diff .line-number")
			.first()
			.textContent();
		expect(firstLineNumber?.trim()).toBe("3");

		// Press 'j' to go to next diff
		await page.keyboard.press("j");
		await page.waitForTimeout(200); // Small delay for DOM update

		// Should be at second diff (removed line 6 in left pane, added line 7 in right pane)
		const secondLineNumberLeft = await page
			.locator(".left-pane .current-diff .line-number")
			.first()
			.textContent();
		const secondLineNumberRight = await page
			.locator(".right-pane .current-diff .line-number")
			.first()
			.textContent();
		expect(["6", "", " "]).toContain(secondLineNumberLeft?.trim() || ""); // Removed line or empty
		expect(["7", "", " "]).toContain(secondLineNumberRight?.trim() || ""); // Added line or empty

		// Press 'j' again to go to third diff
		await page.keyboard.press("j");
		await page.waitForTimeout(200);

		// Should be at third diff (modified lines - both panes should show line numbers)
		const thirdLineNumber = await page
			.locator(".left-pane .current-diff .line-number")
			.first()
			.textContent();
		expect(["8", "9", "10"]).toContain(thirdLineNumber?.trim());

		// Press 'k' to go back
		await page.keyboard.press("k");
		await page.waitForTimeout(200);

		// Should be back at second diff
		const backSecondLineNumberLeft = await page
			.locator(".left-pane .current-diff .line-number")
			.first()
			.textContent();
		expect(["6", "", " "]).toContain(backSecondLineNumberLeft?.trim() || "");

		// Press 'k' again
		await page.keyboard.press("k");
		await page.waitForTimeout(200);

		// Should be back at first diff
		const backFirstLineNumber = await page
			.locator(".right-pane .current-diff .line-number")
			.first()
			.textContent();
		expect(backFirstLineNumber?.trim()).toBe("3");
	});

	test("navigates with arrow keys", async ({ page }) => {
		// Should start at first diff (added line on right pane)
		const firstLineNumber = await page
			.locator(".right-pane .current-diff .line-number")
			.first()
			.textContent();
		expect(firstLineNumber?.trim()).toBe("3");

		// Press ArrowDown
		await page.keyboard.press("ArrowDown");
		await page.waitForTimeout(200);

		// Should move to next diff (check left pane for removed line)
		const secondLineNumber = await page
			.locator(".left-pane .current-diff .line-number")
			.first()
			.textContent();
		expect(["6", "", " "]).toContain(secondLineNumber?.trim() || "");

		// Press ArrowUp
		await page.keyboard.press("ArrowUp");
		await page.waitForTimeout(200);

		// Should move back to first diff (right pane)
		const backFirstLineNumber = await page
			.locator(".right-pane .current-diff .line-number")
			.first()
			.textContent();
		expect(backFirstLineNumber?.trim()).toBe("3");
	});

	test("handles navigation boundaries", async ({ page }) => {
		// Navigate to first diff (should already be there - right pane)
		const firstLineNumber = await page
			.locator(".right-pane .current-diff .line-number")
			.first()
			.textContent();
		expect(firstLineNumber?.trim()).toBe("3");

		// Try to go before first diff - should stay at first
		await page.keyboard.press("k");
		await page.waitForTimeout(200);

		const stillFirstLineNumber = await page
			.locator(".right-pane .current-diff .line-number")
			.first()
			.textContent();
		expect(stillFirstLineNumber?.trim()).toBe("3");

		// Navigate to last diff
		await page.keyboard.press("j");
		await page.waitForTimeout(200);
		await page.keyboard.press("j");
		await page.waitForTimeout(200);

		// Should be at third diff (modified lines appear in both panes)
		const lastLineNumber = await page
			.locator(".left-pane .current-diff .line-number")
			.first()
			.textContent();
		expect(["8", "9", "10"]).toContain(lastLineNumber?.trim());

		// Try to go past last diff - should stay at last
		await page.keyboard.press("j");
		await page.waitForTimeout(200);

		const stillLastLineNumber = await page
			.locator(".left-pane .current-diff .line-number")
			.first()
			.textContent();
		expect(stillLastLineNumber?.trim()).toBe(lastLineNumber?.trim());
	});

	test("shows visual feedback for current diff", async ({ page }) => {
		// Check that the current diff indicator is visible
		const currentDiffIndicator = await page.locator(".current-diff-indicator");
		await expect(currentDiffIndicator).toBeVisible();

		// Check initial highlighting - first diff should have lines highlighted
		let highlightedLines = await page.locator(".current-diff").all();
		const initialHighlightCount = highlightedLines.length;
		expect(initialHighlightCount).toBeGreaterThan(0);

		// Store the initial count to compare later
		const _firstDiffHighlightCount = initialHighlightCount;

		// Navigate to next diff and verify indicator moves
		await page.keyboard.press("j");
		await page.waitForTimeout(200);

		// Verify current diff indicator is still visible (it moved)
		await expect(currentDiffIndicator).toBeVisible();

		// For the second diff (removed/added), we should have highlighted lines
		highlightedLines = await page.locator(".current-diff").all();
		expect(highlightedLines.length).toBeGreaterThan(0);

		// Verify only one chunk is highlighted at a time - check that line 3 is no longer highlighted
		const line3RightPane = await page
			.locator(".right-pane .line .line-number")
			.filter({ hasText: "3" })
			.locator("..")
			.first();
		const line3Classes = await line3RightPane.evaluate((el) =>
			Array.from(el.classList),
		);
		expect(line3Classes).not.toContain("current-diff"); // First diff should no longer be highlighted
	});

	test("minimap tracks current diff navigation", async ({ page }) => {
		// Check that minimap has a current diff indicator
		const minimapCurrentDiff = await page.locator(".minimap-current");
		await expect(minimapCurrentDiff).toBeVisible();

		// Get initial position
		const initialPosition = await minimapCurrentDiff.boundingBox();
		expect(initialPosition).not.toBeNull();

		// Navigate to next diff
		await page.keyboard.press("j");
		await page.waitForTimeout(200);

		// Verify minimap indicator moved - get new element since it might be a different chunk
		const newMinimapCurrentDiff = await page.locator(".minimap-current");
		const newPosition = await newMinimapCurrentDiff.boundingBox();
		expect(newPosition).not.toBeNull();
		expect(newPosition?.y).not.toBe(initialPosition?.y);

		// Navigate to last diff
		await page.keyboard.press("j");
		await page.waitForTimeout(200);

		// Verify minimap indicator moved again
		const lastMinimapCurrentDiff = await page.locator(".minimap-current");
		const lastPosition = await lastMinimapCurrentDiff.boundingBox();
		expect(lastPosition).not.toBeNull();
		expect(lastPosition?.y).toBeGreaterThan(newPosition?.y);
	});

	test("active diff is visually distinct from inactive diffs", async ({
		page,
	}) => {
		// Get all diff chunks (not 'same' lines)
		const allDiffChunks = await page
			.locator(".line-added, .line-removed, .line-modified")
			.all();
		expect(allDiffChunks.length).toBeGreaterThan(1); // Need at least 2 diffs to compare

		// Check that only the first diff chunk has current-diff class initially
		let currentDiffCount = 0;
		for (const chunk of allDiffChunks) {
			const hasCurrentDiff = await chunk.evaluate((el) =>
				el.classList.contains("current-diff"),
			);
			if (hasCurrentDiff) currentDiffCount++;
		}
		expect(currentDiffCount).toBeGreaterThan(0); // At least one line should be highlighted

		// Navigate to next diff
		await page.keyboard.press("j");
		await page.waitForTimeout(200);

		// Verify the first diff no longer has current-diff class
		const firstDiffLine = await page.locator(".right-pane .line-added").first();
		const firstDiffClasses = await firstDiffLine.evaluate((el) =>
			Array.from(el.classList),
		);
		expect(firstDiffClasses).not.toContain("current-diff");

		// Verify the second diff now has current-diff class
		const secondDiffLines = await page.locator(".current-diff").all();
		expect(secondDiffLines.length).toBeGreaterThan(0);

		// Check visual distinction - current-diff should have different background
		const currentDiffElement = await page.locator(".current-diff").first();
		const currentDiffBg = await currentDiffElement.evaluate(
			(el) => window.getComputedStyle(el).backgroundColor,
		);

		const inactiveDiffElement = await page
			.locator(
				".line-added:not(.current-diff), .line-removed:not(.current-diff), .line-modified:not(.current-diff)",
			)
			.first();
		const inactiveDiffBg = await inactiveDiffElement.evaluate(
			(el) => window.getComputedStyle(el).backgroundColor,
		);

		// Background colors should be different
		expect(currentDiffBg).not.toBe(inactiveDiffBg);
	});
});
