---
status: pending
priority: p2
issue_id: "012"
tags: [code-review, agent-native, api, monomer, placement, main]
---

# P2: No named `App.placeMonomerIntention()` API — placement requires 4-step chain

## Problem Statement

After PR #2, users can click a monomer card in the catalogue UI to set `controls.selectedBlueprint`
and then click the canvas to place a molecule intention. This is a first-class user action.

However, there is no equivalent named programmatic entry point. An agent (or a developer
using the console) that wants to place a monomer intention must reconstruct a 4-step
internal chain:

```javascript
// Current agent path — 4 undocumented steps:
const bp = window.cellApp.catalogue.getMonomerById('ETHYLENE');
const env = window.cellApp.environment;
const intent = new Intention('molecule', bp, 1000, 1000);
env.addIntention(intent);
intent.initializeExclusions(env);
```

This is error-prone (missing `initializeExclusions` is a silent failure), undiscoverable
(no documentation), and inconsistent with the pattern of `App.deleteIntention()` which
already exists as a named single-call method.

## Findings

**File:** `src/main.js` — `App` class has `deleteIntention(id)` (named, callable) but no
corresponding `placeMonomerIntention(monomerId, x, y)` or `placeMoleculeIntention(fingerprint, x, y)`.

**File:** `src/viewer/controls.js:325-350` — `_handlePlace()` performs the multi-step
chain: `new Intention('molecule', blueprint, x, y)` → `env.addIntention(...)` → `intent.initializeExclusions(env)`.

**File:** `src/core/environment.js:312` — `addIntention()` already accepts a `catalogue`
parameter but the UI path (`controls.js:332-334`) passes no catalogue, making the
`ensureMonomerForPolymer` safety call a no-op (see also todo 013).

## Proposed Solutions

### Option A: Add `placeMonomerIntention(monomerId, x, y)` to `App` (Recommended)

```javascript
// In src/main.js, App class:
placeMonomerIntention(monomerId, x, y) {
    const bp = this.catalogue.getMonomerById(monomerId);
    if (!bp) {
        console.warn(`placeMonomerIntention: no monomer found for id '${monomerId}'`);
        return null;
    }
    const intention = new Intention('molecule', bp, x, y);
    this.environment.addIntention(intention, this.catalogue);
    intention.initializeExclusions(this.environment);
    this.viewer.render();
    return intention;
}
```

**Pros:** Single named call. Includes `initializeExclusions`. Passes catalogue to `addIntention`.
Discoverable via `window.cellApp.placeMonomerIntention('ADENINE_NUCLEOTIDE', 1000, 1000)`.
Mirrors `deleteIntention(id)` symmetry.
**Cons:** None significant.
**Effort:** Small. **Risk:** Very low — additive.

### Option B: Add a more general `placeMoleculeIntention(fingerprint, x, y)`

Accept any blueprint fingerprint (monomer or stable molecule) and place it as a
molecule intention — consistent with how the UI doesn't distinguish between the two types
for placement.

**Pros:** More general, covers stable-molecule placement too.
**Cons:** Slightly more code (fingerprint lookup vs. ID lookup). The agent-native reviewer's
specific recommendation was the monomer-ID path.
**Effort:** Small. **Risk:** Very low.

### Option C: Document the 4-step chain in CLAUDE.md

Add a "console shortcuts" section to CLAUDE.md showing the manual chain.

**Pros:** No code change.
**Cons:** Fragile documentation. Still error-prone (missing `initializeExclusions`).
**Effort:** Trivial. **Risk:** None.

## Recommended Action

Option A — add `placeMonomerIntention(monomerId, x, y)` to `App`. This is the minimal
change that closes the action-parity gap and makes agents first-class participants in the
placement workflow.

## Technical Details

- **Affected file:** `src/main.js` — `App` class
- **Related files:** `src/viewer/controls.js:325-350` (`_handlePlace`), `src/core/environment.js:312` (`addIntention`)
- **Available catalogue method:** `catalogue.getMonomerById(monomerId)` — already implemented

## Acceptance Criteria

- [ ] `window.cellApp.placeMonomerIntention('ADENINE_NUCLEOTIDE', 1000, 1000)` places a monomer intention at world coordinates (1000, 1000)
- [ ] Returned intention has `isMonomer` semantics correct (blueprint has `isMonomer: true`)
- [ ] `initializeExclusions` is called on the returned intention
- [ ] The method appears in `window.cellApp` (discoverable via `Object.getOwnPropertyNames`)

## Work Log

- 2026-02-26: Identified by agent-native-reviewer agent (P2) during code review of PR #2
