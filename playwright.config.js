// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false, // Run tests sequentially for visual following
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for visual testing
  reporter: [['list'], ['html']],
  timeout: 60000, // 60 second timeout per test
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on',
    screenshot: 'on',
    video: 'on', // Record video of tests
    launchOptions: {
      slowMo: 300, // Slow down actions by 300ms for visibility
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Use existing servers - start them manually before running tests
  // Backend: node server/index.js (port 5001)
  // Frontend: cd client && npm start (port 3000)
  webServer: [
    {
      command: 'node server/index.js',
      port: 5001,
      timeout: 120 * 1000,
      reuseExistingServer: true, // Always reuse if running
    },
    {
      command: 'cd client && npm start',
      port: 3000,
      timeout: 120 * 1000,
      reuseExistingServer: true, // Always reuse if running
    },
  ],
});

