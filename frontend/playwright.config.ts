import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store browsers in project directory
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(__dirname, '../tests/e2e/browsers');

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