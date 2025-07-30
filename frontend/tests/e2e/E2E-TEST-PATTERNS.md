# E2E Test Patterns for Weld

This document outlines the standardized patterns for writing E2E tests in the Weld application.

## File Structure

```typescript
import { expect, test } from "@playwright/test";

// Helper to set up mocked Wails backend
async function setupMockedBackend(page) {
  await page.evaluate(() => {
    // State tracking variables (if needed)
    let someState = false;
    
    // Mock the Wails go object
    window.go = {
      main: {
        App: {
          // Mock functions go here
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

test.describe("Feature Name", () => {
  test.beforeEach(async ({ page }) => {
    // Standard setup sequence
    await page.goto("http://localhost:34115");
    await setupMockedBackend(page);
    await page.waitForSelector("main", { timeout: 5000 });
    
    // Select files and compare
    const leftButton = page.locator(".file-btn").first();
    const rightButton = page.locator(".file-btn").nth(1);
    await leftButton.click();
    await rightButton.click();
    
    const compareButton = page.locator(".compare-btn");
    await compareButton.click();
    
    await page.waitForSelector(".diff-content", { timeout: 5000 });
  });
  
  test("test description", async ({ page }) => {
    // Test implementation
  });
});
```

## Mock Data Patterns

### 1. Diff Line Structure
Use the structure expected by the app:

```typescript
{
  type: "added" | "removed" | "modified" | "same",
  leftNumber: number | null,
  rightNumber: number | null,
  leftLine: string,   // Content for left pane
  rightLine: string,  // Content for right pane
}
```

Note: All tests should use `leftLine` and `rightLine` fields to match the app's actual data structure.

### 2. State Management
- Keep state variables at the top of the mock setup
- Use clear variable names (e.g., `hasUnsavedLeft`, `selectFileCallCount`)
- Reset state appropriately in mock functions

### 3. Mock Function Patterns
Keep mocks minimal - only include functions actually used in tests:

```typescript
SelectFile: async () => {
  // Simple file selection logic
  selectFileCallCount++;
  return selectFileCallCount === 1 ? "/file1" : "/file2";
},

CompareFiles: async () => {
  // Return consistent diff structure
  return { lines: [...] };
},

HasUnsavedChanges: async () => ({
  hasUnsavedLeft,
  hasUnsavedRight,
}),
```

## Test Patterns

### 1. Element Selection
- Use semantic selectors when possible: `.file-btn`, `.compare-btn`, `.line-added`
- Use `.first()` and `.nth()` for multiple elements
- Avoid complex CSS selectors

### 2. Waiting for Updates
- Use `await page.waitForTimeout(200)` for DOM updates after actions
- Use `await page.waitForSelector()` for initial loads
- Keep timeouts consistent (200ms for updates, 5000ms for initial loads)

### 3. Assertions
- Use `await expect(element).toBeVisible()` for visibility checks
- Use `.toBe()` for exact matches
- Use `.toContain()` for flexible string matching
- Always verify state changes after actions

### 4. Navigation Pattern
For keyboard navigation tests:
```typescript
// Navigate to specific diff
await page.keyboard.press("j");
await page.waitForTimeout(200);

// Verify position
const lineNumber = await page
  .locator(".current-diff .line-number")
  .first()
  .textContent();
expect(lineNumber?.trim()).toBe("expected");
```

### 5. Copy Operation Pattern
For copy operation tests:
```typescript
// Hover to show arrows
await element.hover();

// Find and click arrow
const arrow = await page
  .locator(".chunk-actions")
  .locator(".left-side-arrow.chunk-arrow");
await expect(arrow).toBeVisible();
await arrow.click();

// Verify state change
const hasUnsaved = await page.evaluate(() =>
  window.go.main.App.HasUnsavedChanges()
);
expect(hasUnsaved.hasUnsavedRight).toBe(true);
```

## Common Pitfalls to Avoid

1. **Inconsistent mock data structures** - Use `leftLine` and `rightLine` fields consistently
2. **Over-mocking** - Only mock functions actually used in tests
3. **Complex selectors** - Keep selectors simple and semantic
4. **Missing waits** - Always wait after actions that trigger updates
5. **State pollution** - Ensure `beforeEach` provides clean state

## Test Organization

1. Group related tests in `describe` blocks
2. Use descriptive test names that explain what is being tested
3. Keep tests focused on single behaviors
4. Extract common operations into helper functions if used multiple times

## Debugging Tips

1. Use `await page.screenshot({ path: 'debug.png' })` to capture state
2. Use `console.log` in `page.evaluate()` to debug mock behavior
3. Run individual tests with `--grep` for faster iteration
4. Check test artifacts for failure screenshots/videos