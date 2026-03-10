---
status: complete
priority: p1
issue_id: "041"
tags: [code-review, bug, script-order]
dependencies: []
---

# dev.html script load order mismatch with build.ts

## Problem Statement

`dev.html` loads `thermodynamics.js` AFTER `neural-network.js`, but `build.ts` loads it BEFORE `neural-network.js`. This ordering mismatch means dev and production have different script load orders, which could cause hard-to-diagnose bugs if any load-order dependency is introduced later.

**Why it matters:** Tests pass on both dev and prod today because `thermodynamics.js` has no parse-time dependencies on `neural-network.js`. But this is a latent bug — any future code that creates a dependency would fail in dev but work in prod (or vice versa).

## Findings

- **Source: Pattern Recognition agent**
- `build.ts` lines 29-30: `atom-spawner.js` → `thermodynamics.js` → `neural-network.js`
- `dev.html` lines 168-170: `neural-network.js` → `atom-spawner.js` → `thermodynamics.js`

## Proposed Solutions

### Option A: Fix dev.html to match build.ts order (Recommended)
- **Effort:** Small (swap 2 lines in dev.html)
- **Risk:** None
- **Pros:** Single source of truth for load order is build.ts
- **Cons:** None

## Acceptance Criteria

- [ ] `dev.html` script tags match the order in `build.ts` exactly
- [ ] All 20 Playwright tests pass after the change
- [ ] Build succeeds

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from code review | Found by pattern-recognition agent |
