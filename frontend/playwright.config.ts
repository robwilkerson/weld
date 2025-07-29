import { defineConfig } from '@playwright/test';

// Note: Let Playwright use default browser installation location
// Custom PLAYWRIGHT_BROWSERS_PATH can cause issues in CI

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/e2e/test-results',
  timeout: 30 * 1000,
  fullyParallel: false, // Run tests sequentially for desktop app
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for desktop app testing
  reporter: process.env.CI 
    ? [['list'], ['html', { 
        outputFolder: './tests/e2e/playwright-report',
        open: 'never'
      }]]
    : [['html', { 
        outputFolder: './tests/e2e/playwright-report',
        open: 'never'
      }]],
  
  use: {
    // We'll need to configure this based on how we launch the app
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'on' : 'retain-on-failure', // Always record in CI
    headless: process.env.CI ? true : false, // Run headless in CI
  },

  projects: [
    {
      name: 'weld-app',
      testMatch: '**/*.e2e.ts',
    },
  ],
});