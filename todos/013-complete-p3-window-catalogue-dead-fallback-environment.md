---
status: pending
priority: p3
issue_id: "013"
tags: [code-review, agent-native, environment, catalogue, dead-code]
---

# P3: Dead `window.catalogue` fallback in `environment.js:addIntention()` should be `window.cellApp?.catalogue`

## Problem Statement

`environment.js:addIntention()` accepts an optional `catalogue` parameter to
auto-populate monomer blueprints via `ensureMonomerForPolymer()`. When no catalogue is
passed, it falls back to `window.catalogue` — which is never assigned anywhere in the
codebase. The global is `window.cellApp.catalogue`, not `window.catalogue`.

This means `ensureMonomerForPolymer()` is never called automatically when:
- `controls.js` places an intention (it calls `addIntention(intention)` without catalogue)
- An agent or console user calls `env.addIntention(intent)` without the catalogue argument

The safety fallback is silently broken.

## Findings

**File:** `src/core/environment.js:312` (approximate)

```javascript
// Current:
const cat = catalogue || (typeof window !== 'undefined' ? window.catalogue : null);
```

`window.catalogue` is never set. The app sets `window.cellApp.catalogue`.

**File:** `src/viewer/controls.js:332-334` — UI placement path:

```javascript
this.environment.addIntention(intention);  // ← no catalogue argument
```

So `ensureMonomerForPolymer` always receives `null` from the UI path.

## Proposed Solutions

### Option A: Fix the fallback to `window.cellApp?.catalogue` (Recommended)

```javascript
const cat = catalogue || window.cellApp?.catalogue || null;
```

**Pros:** The auto-populate safety net actually fires for all callers that don't pass an
explicit catalogue. One-line fix.
**Cons:** Couples `environment.js` to `window.cellApp` global — a soft coupling that
already exists elsewhere in the codebase.
**Effort:** Trivial. **Risk:** Very low.

### Option B: Update `controls.js` to pass the catalogue explicitly

```javascript
this.environment.addIntention(intention, this.catalogue);
```

**Pros:** Explicit dependency, no global coupling.
**Cons:** The `environment.js` fallback remains broken for external callers (console, agents).
**Effort:** Small. **Risk:** Very low.

### Option C: Do both A and B

Fix the fallback AND pass the catalogue from `controls.js`. Belt-and-suspenders.

**Pros:** Correct at both call sites and for all external callers.
**Cons:** Minor extra change.
**Effort:** Small. **Risk:** Very low.

## Recommended Action

Option C — fix the fallback in `environment.js` and update `controls.js` to pass the
catalogue. Both are trivial changes and together ensure the safety net works regardless
of call site.

## Technical Details

- **Affected file:** `src/core/environment.js` — `addIntention()` (~line 312)
- **Affected file:** `src/viewer/controls.js` — `_handlePlace()` (~line 332-334)

## Acceptance Criteria

- [ ] `window.catalogue` fallback is replaced with `window.cellApp?.catalogue`
- [ ] `controls.js._handlePlace()` passes `this.catalogue` as the second argument to `addIntention()`
- [ ] `env.addIntention(intent)` (no catalogue arg) from the console still triggers `ensureMonomerForPolymer` if a polymer intention is placed

## Work Log

- 2026-02-26: Identified by agent-native-reviewer agent (P3) during code review of PR #2
