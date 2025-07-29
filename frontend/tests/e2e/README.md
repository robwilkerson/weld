# E2E Tests with Playwright

These tests use Playwright to test the actual UI behavior of the Weld application.

## Setup

1. Install Playwright browsers:
   ```bash
   cd frontend
   bunx playwright install
   ```

2. Start the Wails dev server:
   ```bash
   wails dev
   ```
   The app will be available at http://localhost:34115

3. Run the E2E tests:
   ```bash
   bunx playwright test
   ```

## Current Limitations

- Tests run against the dev server, not the built app
- Wails backend functions are mocked in the browser
- File operations don't actually work (mocked)

## Future Improvements

- Connect to actual built Wails app (needs WebKit debugging support)
- Use real backend functions instead of mocks
- Test actual file operations

## Test Coverage

- [x] Keyboard navigation (j/k, arrow keys)
- [ ] Copy operations  
- [ ] Save operations
- [ ] Minimap interaction
- [ ] Scroll synchronization