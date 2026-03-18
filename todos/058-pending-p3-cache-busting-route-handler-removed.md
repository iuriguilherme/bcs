---
status: pending
priority: p3
issue_id: "058"
tags: [code-review, test-infrastructure, playwright]
dependencies: []
---

# Cache-busting route handler removed from test fixture — verify Playwright cache isolation is sufficient

## Problem Statement

`tests/fixtures/app.js` previously registered a `page.route('**/*.{js,css}', ...)` handler that added `Cache-Control: no-store` headers to all JS/CSS responses. This was documented as the definitive fix for browser JS caching across test runs (past solution: `playwright-test-infrastructure-audit-8-findings-20260226.md`).

The handler was removed in the latest change with the rationale: "Playwright's page.route() activation unconditionally disables the browser's HTTP cache." This is correct when a route IS registered — Playwright calls `Network.setCacheDisabled(true)` via CDP when any route is active. **But the route was removed entirely**, so no CDP cache-disable call occurs.

In practice, Playwright creates a new isolated browser context per test (by default), so cross-test caching is unlikely. The risk is scoped to:
- Dev environments that reuse a persistent browser profile
- Future config changes that reuse browser contexts across tests
- Tests that navigate multiple times within a single context

## Findings

- **Source:** Learnings researcher (past solution: `docs/solutions/test-failures/playwright-test-infrastructure-audit-8-findings-20260226.md`)
- `tests/fixtures/app.js`: `page.route()` call entirely removed (no handler registered)
- Past solution explicitly documented: "Use page.route('**/*.js', ...) to intercept all JS and add Cache-Control: no-store headers"
- Past solution included a runtime verification technique: `Intention.prototype._rule6_bondClaimed.toString().includes('...')` to confirm live code is running

## Proposed Solutions

### Option A: Re-register a lightweight no-op route to re-enable CDP cache-disable
```js
// Re-enables cache-busting without the fetch+fulfill overhead
await page.route('**/*.js', route => route.continue());
```
- **Effort:** 1 line
- **Pros:** Restores cache-busting behavior; minimal overhead (no response modification)
- **Cons:** Adds a small amount of network interception overhead

### Option B: Re-add the full Cache-Control header handler (most defensive)
Restore the original `route.fetch() + route.fulfill({Cache-Control: no-store})` pattern from the past solution.
- **Effort:** Small (restore ~15 lines)
- **Pros:** Definitive — headers are set regardless of Playwright's internal cache behavior
- **Cons:** Adds IPv6→IPv4 fallback complexity (the original code's try/catch for ECONNREFUSED)

### Option C: Leave as-is and verify empirically
The current behavior is likely fine due to per-test context isolation. Confirm by running `npm test` after modifying a JS file without rebuilding — if tests pass with stale code, cache-busting is broken.
- **Effort:** Zero (just verify)
- **Risk:** If cache-busting is needed and absent, test failures will be intermittent and hard to diagnose

## Acceptance Criteria

- [ ] Either: cache-busting route is re-registered, OR empirical verification confirms isolated contexts prevent stale JS issues
- [ ] All tests pass after a JS file change without manual cache clearing

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-18 | Created from code review (learnings researcher surfaced past solution) | Low urgency; default Playwright context isolation likely sufficient |
