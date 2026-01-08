// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
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

