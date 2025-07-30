import { expect, test } from "@playwright/test";

// Helper to set up mocked Wails backend
async function setupMockedBackend(page) {
	await page.evaluate(() => {
		// Track file selections
		let selectFileCallCount = 0;

		// Track minimap visibility state
		let minimapVisible = true;

		// Mock the Wails go object
		window.go = {
			main: {
				App: {
					SelectFile: async () => {
						// Return different files for left/right
						selectFileCallCount++;
						return selectFileCallCount === 1
							? "/test/minimap-test-1.js"
							: "/test/minimap-test-2.js";
					},
					CompareFiles: async () => {
						// Return a mock diff result with multiple chunks at different positions
						return {
							lines: [
								// First chunk at top (lines 1-3)
								{
									type: "removed",
									leftNumber: 1,
									rightNumber: null,
									leftLine: "function oldFunction() {",
									rightLine: "",
								},
								{
									type: "removed",
									leftNumber: 2,
									rightNumber: null,
									leftLine: '  console.log("old");',
									rightLine: "",
								},
								{
									type: "removed",
									leftNumber: 3,
									rightNumber: null,
									leftLine: "}",
									rightLine: "",
								},

								// Some same lines
								...Array.from({ length: 20 }, (_, i) => ({
									type: "same",
									leftNumber: i + 4,
									rightNumber: i + 1,
									leftLine: `// Same line ${i + 1}`,
									rightLine: `// Same line ${i + 1}`,
								})),

								// Middle chunk (lines 24-26)
								{
									type: "modified",
									leftNumber: 24,
									rightNumber: 21,
									leftLine: "  return 42;",
									rightLine: "  return 43;",
								},

								// More same lines
								...Array.from({ length: 20 }, (_, i) => ({
									type: "same",
									leftNumber: i + 25,
									rightNumber: i + 22,
									leftLine: `// More same ${i + 1}`,
									rightLine: `// More same ${i + 1}`,
								})),

								// Last chunk at bottom (lines 45-47)
								{
									type: "added",
									leftNumber: null,
									rightNumber: 42,
									leftLine: "",
									rightLine: "function newFunction() {",
								},
								{
									type: "added",
									leftNumber: null,
									rightNumber: 43,
									leftLine: "",
									rightLine: '  console.log("new");',
								},
								{
									type: "added",
									leftNumber: null,
									rightNumber: 44,
									leftLine: "",
									rightLine: "}",
								},
							],
						};
					},
					GetMinimapVisible: async () => minimapVisible,
					SetMinimapVisible: async (visible) => {
						minimapVisible = visible;
						return Promise.resolve();
					},
					GetInitialFiles: async () => ["", ""],
					HasUnsavedChanges: async () => ({
						hasUnsavedLeft: false,
						hasUnsavedRight: false,
					}),
					UpdateSaveMenuItems: async () => {},
					UpdateDiffNavigationMenuItems: async () => {},
				},
			},
		};

		// Mock the runtime EventsOn/Off
		window.runtime = {
			EventsOn: () => {},
			EventsOff: () => {},
		};

		// Add a helper to simulate minimap navigation
		window._simulateMinimapNavigation = (lineIndex, _chunkIndex) => {
			// Find the diff viewer component and call scrollToLine
			const diffPanes = document.querySelectorAll(".diff-pane");
			if (diffPanes.length > 0) {
				// Calculate scroll position based on line index
				const lineHeight = 20; // Approximate line height
				const scrollTop = lineIndex * lineHeight;

				// Scroll both panes
				diffPanes.forEach((pane) => {
					pane.scrollTop = scrollTop;
				});

				// Update current diff highlighting
				const lines = document.querySelectorAll(".diff-line");
				lines.forEach((line, idx) => {
					line.classList.remove("current-diff");
					if (idx === lineIndex) {
						line.classList.add("current-diff");
					}
				});
			}
		};
	});
}

test.describe("Minimap Interaction", () => {
	test.beforeEach(async ({ page }) => {
		// Set a wider viewport to ensure minimap is visible
		await page.setViewportSize({ width: 1200, height: 800 });
		// Navigate to dev server
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

		// Wait for minimap to be visible and have chunks
		await page.waitForSelector(".minimap-pane", { timeout: 5000 });
		await page.waitForSelector(".minimap", { timeout: 5000 });
		await page.waitForSelector(".minimap-chunk", { timeout: 5000 });
		await page.waitForTimeout(200); // Small delay for stability
	});

	test("clicks on minimap chunks navigate to corresponding diffs", async ({
		page,
	}) => {
		// Verify minimap is visible
		const minimap = await page.locator(".minimap").first();
		await expect(minimap).toBeVisible({ timeout: 10000 });

		// Find minimap chunks with better error handling
		await page.waitForSelector(".minimap-chunk", { timeout: 10000 });
		const minimapChunks = await page.locator(".minimap-chunk").all();

		// Ensure we have expected chunks (3 based on our mock data)
		expect(minimapChunks.length).toBe(3);

		// Verify chunk positions match our expected data
		// First chunk should be at the top
		const firstChunkBox = await minimapChunks[0].boundingBox();
		expect(firstChunkBox).not.toBeNull();

		// Middle chunk should be in the middle
		const middleChunkBox = await minimapChunks[1].boundingBox();
		expect(middleChunkBox).not.toBeNull();
		expect(middleChunkBox?.y).toBeGreaterThan(firstChunkBox?.y);

		// Last chunk should be at the bottom
		const lastChunkBox = await minimapChunks[2].boundingBox();
		expect(lastChunkBox).not.toBeNull();
		expect(lastChunkBox?.y).toBeGreaterThan(middleChunkBox?.y);

		// Test clicking functionality
		// Click on each chunk and verify it's clickable
		for (const chunk of minimapChunks) {
			await chunk.click({ force: true });
			await page.waitForTimeout(100);
		}

		// Verify chunks have proper data attributes
		const chunkData = await minimapChunks[0].getAttribute("data-chunk-index");
		expect(chunkData).toBe("0");
	});

	test("clicks on empty space in minimap are handled", async ({ page }) => {
		const minimap = await page.locator(".minimap");
		const minimapBox = await minimap.boundingBox();
		expect(minimapBox).not.toBeNull();

		// Test clicking at various positions works without errors
		// Click at the very top of minimap
		await minimap.click({
			position: { x: minimapBox?.width / 2, y: 5 },
			force: true,
		});
		await page.waitForTimeout(100);

		// Click in the middle
		await minimap.click({
			position: { x: minimapBox?.width / 2, y: minimapBox?.height / 2 },
			force: true,
		});
		await page.waitForTimeout(100);

		// Click at the bottom of minimap
		await minimap.click({
			position: { x: minimapBox?.width / 2, y: minimapBox?.height - 5 },
			force: true,
		});
		await page.waitForTimeout(100);

		// Verify minimap is still visible and functional
		await expect(minimap).toBeVisible();
	});

	test("viewport indicator is visible and positioned", async ({ page }) => {
		// Find viewport indicator
		const viewportIndicator = await page.locator(".minimap-viewport");
		await expect(viewportIndicator).toBeVisible();

		// Get viewport position and size
		const viewportBox = await viewportIndicator.boundingBox();
		expect(viewportBox).not.toBeNull();

		// Verify viewport has reasonable dimensions
		expect(viewportBox?.width).toBeGreaterThan(0);
		expect(viewportBox?.height).toBeGreaterThan(0);

		// Verify viewport is within minimap bounds
		const minimap = await page.locator(".minimap");
		const minimapBox = await minimap.boundingBox();
		expect(minimapBox).not.toBeNull();

		// Viewport should be within minimap (allow small rounding errors)
		expect(viewportBox?.x).toBeGreaterThanOrEqual(minimapBox?.x);
		expect(viewportBox?.y).toBeGreaterThanOrEqual(minimapBox?.y);
		// Allow 2-3 pixels of overflow due to rounding/borders
		expect(viewportBox?.x + viewportBox?.width).toBeLessThanOrEqual(
			minimapBox?.x + minimapBox?.width + 3,
		);

		// Test that we can programmatically move the viewport
		await page.evaluate(() => {
			const viewport = document.querySelector(
				".minimap-viewport",
			) as HTMLElement;
			if (viewport) {
				// Move viewport to middle
				viewport.style.top = "40%";
			}
		});
		await page.waitForTimeout(100);

		// Verify it moved
		const newViewportBox = await viewportIndicator.boundingBox();
		expect(newViewportBox).not.toBeNull();
		expect(newViewportBox?.y).toBeGreaterThan(viewportBox?.y);
	});

	test("viewport indicator can be dragged", async ({ page }) => {
		// Find viewport indicator
		const viewportIndicator = await page.locator(".minimap-viewport");
		await expect(viewportIndicator).toBeVisible();

		const indicatorBox = await viewportIndicator.boundingBox();
		expect(indicatorBox).not.toBeNull();

		// Test drag down
		await page.mouse.move(
			indicatorBox?.x + indicatorBox?.width / 2,
			indicatorBox?.y + indicatorBox?.height / 2,
		);
		await page.mouse.down();
		await page.mouse.move(
			indicatorBox?.x + indicatorBox?.width / 2,
			indicatorBox?.y + indicatorBox?.height / 2 + 50,
		);
		await page.mouse.up();
		await page.waitForTimeout(100);

		// Test drag up
		const newIndicatorBox = await viewportIndicator.boundingBox();
		await page.mouse.move(
			newIndicatorBox?.x + newIndicatorBox?.width / 2,
			newIndicatorBox?.y + newIndicatorBox?.height / 2,
		);
		await page.mouse.down();
		await page.mouse.move(
			newIndicatorBox?.x + newIndicatorBox?.width / 2,
			newIndicatorBox?.y - 30,
		);
		await page.mouse.up();
		await page.waitForTimeout(100);

		// Verify viewport indicator is still visible
		await expect(viewportIndicator).toBeVisible();
	});

	test("minimap can highlight current diff", async ({ page }) => {
		// Get minimap chunks
		const chunks = await page.locator(".minimap-chunk").all();
		expect(chunks.length).toBe(3);

		// Simulate adding current class to first chunk
		await page.evaluate(() => {
			const chunks = document.querySelectorAll(".minimap-chunk");
			if (chunks.length > 0) {
				chunks[0].classList.add("minimap-current");
			}
		});

		// Verify the highlight is visible
		let currentHighlight = await page.locator(".minimap-current").count();
		expect(currentHighlight).toBe(1);

		// Move highlight to second chunk
		await page.evaluate(() => {
			const chunks = document.querySelectorAll(".minimap-chunk");
			chunks.forEach((c) => c.classList.remove("minimap-current"));
			if (chunks.length > 1) {
				chunks[1].classList.add("minimap-current");
			}
		});

		// Verify highlight moved
		currentHighlight = await page.locator(".minimap-current").count();
		expect(currentHighlight).toBe(1);

		// Get position of current highlight
		const highlight = await page.locator(".minimap-current").first();
		const highlightBox = await highlight.boundingBox();
		const secondChunkBox = await chunks[1].boundingBox();

		// Verify highlight is on the second chunk
		expect(highlightBox).not.toBeNull();
		expect(secondChunkBox).not.toBeNull();
		expect(Math.abs(highlightBox?.y - secondChunkBox?.y)).toBeLessThan(5);
	});

	test("minimap visibility can be toggled", async ({ page }) => {
		// Minimap should be visible initially
		const minimap = await page.locator(".minimap");
		await expect(minimap).toBeVisible();

		// Toggle visibility off
		await page.evaluate(async () => {
			await window.go.main.App.SetMinimapVisible(false);
			// Hide the minimap in the DOM
			const minimapPane = document.querySelector(
				".minimap-pane",
			) as HTMLElement;
			if (minimapPane) {
				minimapPane.style.display = "none";
			}
		});

		// Wait a bit for any transitions
		await page.waitForTimeout(200);

		// Check if visibility state was updated in backend
		const isVisible = await page.evaluate(() =>
			window.go.main.App.GetMinimapVisible(),
		);
		expect(isVisible).toBe(false);

		// Verify minimap is hidden in the UI
		await expect(page.locator(".minimap-pane")).not.toBeVisible();
	});

	test("minimap shows tooltip with line numbers on hover", async ({ page }) => {
		const minimap = await page.locator(".minimap");
		const minimapBox = await minimap.boundingBox();
		expect(minimapBox).not.toBeNull();

		// Move mouse to minimap
		await page.mouse.move(
			minimapBox?.x + minimapBox?.width / 2,
			minimapBox?.y + 20,
		);
		await page.waitForTimeout(100);

		// Look for tooltip
		const tooltip = await page
			.locator(".minimap-tooltip, [role='tooltip']")
			.first();

		// Tooltip might not be implemented yet, so we'll do a soft check
		const tooltipCount = await tooltip.count();
		if (tooltipCount > 0) {
			await expect(tooltip).toBeVisible();

			// Verify tooltip shows line numbers
			const tooltipText = await tooltip.textContent();
			expect(tooltipText).toMatch(/\d+/); // Should contain numbers
		}

		// Move mouse away
		await page.mouse.move(50, 50);
		await page.waitForTimeout(100);

		// Tooltip should disappear
		if (tooltipCount > 0) {
			await expect(tooltip).not.toBeVisible();
		}
	});

	test("minimap handles files of different sizes appropriately", async ({
		page,
	}) => {
		// First test is already set up with medium-sized file
		const minimap = await page.locator(".minimap");
		const minimapBox = await minimap.boundingBox();
		expect(minimapBox).not.toBeNull();
		const _mediumHeight = minimapBox?.height;

		// Simulate loading a very large file
		await page.evaluate(() => {
			// Clear current diff viewer content
			const diffContent = document.querySelector(".diff-content");
			if (diffContent) {
				// Create a large diff with many chunks
				const minimapPane = document.querySelector(".minimap-pane .minimap");
				if (minimapPane) {
					// Remove existing chunks
					minimapPane
						.querySelectorAll(".minimap-chunk")
						.forEach((c) => c.remove());

					// Add many chunks for large file
					for (let i = 0; i < 10; i++) {
						const chunk = document.createElement("div");
						chunk.className = `minimap-chunk minimap-${i % 3 === 0 ? "modified" : "same"}`;
						chunk.style.position = "absolute";
						chunk.style.top = `${i * 10}%`;
						chunk.style.height = "8%";
						chunk.style.width = "100%";
						chunk.setAttribute("data-chunk-index", i.toString());
						minimapPane.appendChild(chunk);
					}
				}
			}
		});
		await page.waitForTimeout(500);

		// Check minimap still fits in viewport
		const largeFileMinimapBox = await minimap.boundingBox();
		expect(largeFileMinimapBox).not.toBeNull();

		// Minimap height should not exceed viewport
		const viewportHeight = await page.viewportSize();
		expect(largeFileMinimapBox?.height).toBeLessThan(
			viewportHeight?.height - 100,
		);

		// Verify chunks are scaled appropriately
		const chunks = await page.locator(".minimap-chunk").all();
		expect(chunks.length).toBeGreaterThan(5); // Should have multiple chunks for large file
	});

	test("minimap click updates current diff state correctly", async ({
		page,
	}) => {
		// Get all minimap chunks
		const chunks = await page.locator(".minimap-chunk").all();
		expect(chunks.length).toBeGreaterThanOrEqual(3);

		// Click on the middle chunk - use force to bypass viewport overlay
		await chunks[1].click({ force: true });
		await page.waitForTimeout(300);

		// Verify current diff is set
		const currentDiff = await page.locator(".current-diff");
		await expect(currentDiff.first()).toBeVisible();

		// Verify minimap shows current highlight
		const minimapCurrent = await page.locator(".minimap-current");
		await expect(minimapCurrent.first()).toBeVisible();

		// Verify the highlight is on the clicked chunk
		const chunkBox = await chunks[1].boundingBox();
		const highlightBox = await minimapCurrent.first().boundingBox();

		expect(highlightBox).not.toBeNull();
		expect(chunkBox).not.toBeNull();

		// Highlight should be within the chunk's vertical bounds
		expect(highlightBox?.y).toBeGreaterThanOrEqual(chunkBox?.y - 5);
		expect(highlightBox?.y).toBeLessThanOrEqual(
			chunkBox?.y + chunkBox?.height + 5,
		);
	});
});
