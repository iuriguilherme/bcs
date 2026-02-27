import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/scenarios',
  timeout: 180_000,           // 3 min per test — polymer formation worst case
  retries: process.env.CI ? 1 : 0, // no retries locally (masks bugs); 1 on CI for timing variance
  fullyParallel: false,       // serial: simulation tests are CPU-heavy; parallel degrades timing
  workers: 1,                 // one worker: physics tests must not compete for CPU

  reporter: [['list'], ['html', { open: 'never' }]],

  // Auto-starts the Python HTTP server. No manual prerequisite needed.
  // reuseExistingServer: true lets local dev keep their own server running.
  webServer: {
    command: 'python -m http.server 8765',
    url: 'http://localhost:8765',
    reuseExistingServer: true,
    timeout: 10_000,
  },

  use: {
    // actionTimeout is intentionally NOT set here because @playwright/test applies
    // it as an override for ALL page actions — including page.waitForFunction —
    // taking precedence over per-call {timeout} options. Our tests use explicit
    // timeouts on each call instead (pressPlay→5s, enableSpawner→3s, T01→90s, etc.).
    navigationTimeout: 20_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },

  // Project name string is referenced as a constant in tests/fixtures/app.js — keep in sync.
  projects: [
    {
      name: 'dev',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:8765',
      },
      testMatch: '**/*.spec.js',
    },
    {
      name: 'prod',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:8765',
      },
      testMatch: '**/*.spec.js',
      retries: 0, // bundle should be stable; no retry slack
    },
  ],
});
