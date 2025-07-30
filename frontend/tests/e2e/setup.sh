#!/bin/bash

# Setup script for E2E tests with Playwright

echo "Setting up Playwright E2E tests..."

# Set the browsers path to keep them project-local
export PLAYWRIGHT_BROWSERS_PATH="$(pwd)/frontend/tests/e2e/browsers"

echo "Installing Playwright browsers to: $PLAYWRIGHT_BROWSERS_PATH"

# Install browsers
cd frontend && bunx playwright install

echo "Setup complete!"
echo ""
echo "To run E2E tests:"
echo "1. Start the dev server: wails dev"
echo "2. Run tests: cd frontend && bun run test:e2e"
echo ""
echo "All E2E test artifacts are kept in frontend/tests/e2e/:"
echo "  - Browsers: frontend/tests/e2e/browsers/"
echo "  - Test results: frontend/tests/e2e/test-results/"
echo "  - HTML reports: frontend/tests/e2e/playwright-report/"
echo ""
echo "This keeps everything project-local and organized."