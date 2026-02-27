---
status: pending
priority: p3
issue_id: "022"
tags: [code-review, testing, ci, performance]
dependencies: []
---

# Playwright config: webServer timeout too short + video retention for CI

## Problem Statement

Two small improvements to `playwright.config.js` improve CI reliability with zero downside:

1. **`webServer.timeout: 10_000`** is Playwright's default and may be too short for CI machines where Python must cold-start. Cold starts on GitHub Actions can take 8–15 seconds, making 10s a race condition that causes intermittent infrastructure failures unrelated to simulation bugs.

2. **`video: 'retain-on-failure'`** combined with `retries: 1` on CI means that when a test fails on attempt 1 but passes on retry, no video is retained for the failed attempt. For physics simulation tests (T02, T04, T05), the visual state during failure is the primary diagnostic artifact — losing it prevents understanding flaky runs.

## Findings

**Current config** (`playwright.config.js`):
```javascript
webServer: {
  command: 'python -m http.server 8765',
  url: 'http://localhost:8765',
  reuseExistingServer: true,
  timeout: 10_000,   // ← too short for cold CI start
},
use: {
  video: 'retain-on-failure',   // ← lost on retry success
},
retries: process.env.CI ? 1 : 0,
```

## Proposed Solutions

### Option A: Both fixes (Recommended)
**Effort**: Minimal
**Risk**: None

```javascript
webServer: {
  command: 'python -m http.server 8765',
  url: 'http://localhost:8765',
  reuseExistingServer: true,
  timeout: 30_000,   // Cold CI start can take 8-15s; 30s is safe margin
},
use: {
  // On CI: keep all video (failed attempts are lost on retry with 'retain-on-failure').
  // Locally: only keep on failure (saves disk space during development).
  video: process.env.CI ? 'on' : 'retain-on-failure',
},
```

## Technical Details

**Affected file:** `playwright.config.js`

**Why `webServer.timeout` matters:** The brainstorm docs note Playwright tests are run locally by agents, not on CI. But if CI ever runs these tests, the 10s timeout is a known fragile point.

**Why video `'on'` on CI:** T02 uses `waitForTimeout(6_000)` (fixed pause, not a waitForFunction). If the simulation produces tar-balls during that 6s, the video from the failing attempt is the only way to see it. With `retries: 1` and `retain-on-failure`, that video is discarded if the retry passes.

## Acceptance Criteria

- [ ] `webServer.timeout` increased to 30_000
- [ ] `video` uses `process.env.CI ? 'on' : 'retain-on-failure'`
- [ ] `npm test` still passes locally

## Work Log

- 2026-02-26: Identified by performance-oracle review agent. Filed as P3.
