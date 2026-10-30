import { defineConfig, devices } from '@playwright/test';

const API_PORT = 5100;
const WEB_PORT = 5175;

/**
 * End-to-end tests for the demo flow (docs/dev-notes/CLAUDE_CODE_PLAN.md §9). Playwright starts its own API on an
 * in-memory, freshly seeded MongoDB with simulated payments (server `npm run e2e:server`) and a Vite
 * dev server proxying to it, so runs never touch a real database or payment gateway.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run e2e:server',
      cwd: '../server',
      url: `http://localhost:${API_PORT}/health`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: { E2E_API_PORT: String(API_PORT), E2E_CLIENT_URL: `http://localhost:${WEB_PORT}` },
    },
    {
      // The production build (with its CSP) served by `vite preview`, which reuses the dev proxy.
      command: `npx vite build && npx vite preview --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: { VITE_PROXY_TARGET: `http://127.0.0.1:${API_PORT}` },
    },
  ],
});
