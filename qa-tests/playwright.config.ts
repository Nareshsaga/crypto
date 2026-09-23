import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:5173';
const apiURL = process.env.API_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Start the app under test if it is not already running; reuse existing
  // servers so the suite can attach to a dev session.
  webServer: [
    {
      command: 'npm run dev',
      cwd: '../Client',
      url: baseURL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'node server.js',
      cwd: '../Server',
      url: apiURL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
