---
status: complete
priority: p2
issue_id: "025"
tags: [code-review, architecture, maintenance]
---

# Document `claimed` ordering invariant in _buildState() to protect Rule 2 surplus check

## Problem Statement

Rule 2 (`_rule2_repelIrrelevantMolecules`) now reads `state.claimed` — atoms already claimed by prior-tick operations — to decide whether a correct-element molecule is "surplus" and should be expelled. This introduces an implicit ordering dependency: `claimed` must be a **start-of-tick snapshot** (not updated by any rule running in the current tick) for the surplus check to be safe.

If `_buildState()` is ever refactored to compute `claimed` lazily or to include current-tick claims, Rule 2 would expel molecules whose elements are being claimed this tick — causing oscillation (expelled → drifts back → expelled again). This risk is invisible without documentation.

## Findings

- **Reporter**: architecture-strategist review agent, PR #3
- **File**: `src/entities/intention.js` — `_buildState()` method (lines ~308–346); return object definition
- **Evidence**: The `claimed` array is built once via `[...env.atoms.values()].filter(a => a.claimedByIntentId === this.id)` at the start of `_runMoleculeIntent()`. Rules 3–5 then write `atom.claimedByIntentId` directly. Since `claimed` is not re-computed between rules, Rule 2 only sees prior-tick claims — which is the correct semantics for the surplus check.
- **Risk**: If a future refactor adds an early-return shortcut that rebuilds `state` mid-pipeline, or if `_buildState()` is extracted to run per-rule, the invariant silently breaks.
- **Analogy**: The documented "clean slate" principle for `updateMolecules()` (CLAUDE.md) exists for the same reason — without the comment, the rebuild-from-scratch approach looks like a bug.

## Proposed Solutions

### Solution A: Add comment to state return value in _buildState() (Recommended)

In `src/entities/intention.js`, find the `return { ... }` block in `_buildState()` and add a comment on the `claimed` property:

```javascript
return {
    nearbyAtoms,
    targetComp,
    targetFormula,
    totalNeeded,
    seedMol,
    seedAtomIds,
    // Snapshot of atoms claimed in PRIOR ticks only (read-only for all rules).
    // Rules 1–2 use this to identify surplus; Rules 3–5 mutate atom.claimedByIntentId
    // directly. If state is ever re-built mid-pipeline, update the surplus check
    // in _rule2_repelIrrelevantMolecules() to re-read live atom state instead.
    claimed,
    free,
    extractedThisTick: false
};
```

**Pros**: Zero runtime impact; documents the invariant exactly where it must be known
**Cons**: None
**Effort**: Trivial — 4 lines of comment

### Solution B: Add comment at the Rule 2 call site instead

Add a comment above the `const { ..., claimed } = state;` destructuring in `_rule2_repelIrrelevantMolecules()`.

**Pros**: Comment is closer to the consuming code
**Cons**: Doesn't protect the invariant at the source; `_buildState()` may still be refactored without awareness
**Effort**: Trivial

### Solution C: Assert at runtime

At the start of each rule, assert `state.claimed` hasn't changed since `_buildState()` ran.

**Pros**: Fails loudly if invariant breaks
**Cons**: Runtime overhead; complex to implement correctly; overkill for this simulation
**Effort**: Large

## Recommended Action

Solution A, with the comment in the `_buildState()` return object. Both A and B are useful together.

## Technical Details

- **File**: `src/entities/intention.js`
- **Location**: `_buildState()` return statement; also `_rule2_repelIrrelevantMolecules()` destructuring
- **Bundle rebuild required**: Yes after source change

## Acceptance Criteria

- [ ] Comment added to `_buildState()` return object on `claimed` property, documenting it is a start-of-tick snapshot
- [ ] Optional: matching comment added in Rule 2 at the `claimed` usage site
- [ ] No functional change — purely documentation
- [ ] All 14 tests still pass

## Work Log

- 2026-03-01: Identified by architecture-strategist during PR #3 review of fix/intention-zone-crowding
