import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'
const brave = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
export default defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 120000,
  expect: { timeout: 12000 },
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5291',
    viewport: { width: 1380, height: 900 },
    timezoneId: 'Asia/Jakarta',
    headless: true,
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync(brave) ? brave : undefined),
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: 'http://localhost:5291/api/health',
    reuseExistingServer: false,
    timeout: 60000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
  },
})
