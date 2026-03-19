---
status: pending
priority: p3
issue_id: "040"
tags: [code-review, testing, conventions, test-fixtures]
---

# `placeCOIntent` helper should be in `tests/fixtures/app.js` for convention consistency

## Problem Statement

T09 (`t09-thermo-co-triple-bond.spec.js`) defines `placeCOIntent()` as a local function inside the test file. This function uses `page.evaluate` to create an `Intention` and call `window.cellApp.environment.addIntention()` — the same pattern used by `placeEthyleneIntent` in `tests/fixtures/app.js` (line ~181).

The two helpers:
- Have identical structure (evaluate, build blueprint object, `new window.Intention`, `addIntention`)
- Serve the same purpose (placing an intention zone for test scaffolding)
- But live in different locations

`placeEthyleneIntent` is in `fixtures/app.js` with an explanatory comment about it being "test scaffolding analogous to setting `atomSpawner.zone`." `placeCOIntent` is inline in the scenario file without this comment.

This creates two inconsistencies:
1. The exemption rationale for `window.cellApp.*` setup is documented in fixtures but not in the T09 scenario
2. Future tests that need a CO intention zone won't know to reuse `placeCOIntent` (it's hidden in a scenario file)

## Proposed Solution

Move `placeCOIntent` from `t09-thermo-co-triple-bond.spec.js` to `tests/fixtures/app.js`:
```js
// tests/fixtures/app.js
// Test scaffolding analogous to setting atomSpawner.zone — places a CO
// molecule intention at world coordinates without going through the UI.
export async function placeCOIntent(page, worldX, worldY) {
  await page.evaluate(([wx, wy]) => {
    // ... existing implementation
  }, [worldX, worldY]);
}
```

Then import and use it in T09.

**Effort**: Small | **Risk**: None (pure refactor, behavior unchanged)

## Acceptance Criteria

- [ ] `placeCOIntent` moved to `tests/fixtures/app.js` with scaffolding-exemption comment
- [ ] T09 imports `placeCOIntent` from fixture
- [ ] T09 test still passes on both dev and prod

## Work Log

- 2026-03-19: Identified by agent-native-reviewer during PR #5 review — inconsistency with `placeEthyleneIntent` fixture pattern
