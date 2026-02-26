---
status: pending
priority: p2
issue_id: "003"
tags: [code-review, dead-code, environment, cleanup]
---

# P2: Dead methods `isAtomRelevantToIntention` and `getAtomBondingPriority` on Environment

## Problem Statement

Two Environment methods — `isAtomRelevantToIntention` and `getAtomBondingPriority` — are no longer called anywhere in the codebase. They were used by the old graduated probability logic in `tryFormBonds` that was replaced in commit 5d85d71 with the binary `prob = 0` gate. These dead methods accumulate as technical debt.

## Findings

**File:** `src/core/environment.js`, lines ~372-423

The deleted `tryFormBonds` logic was the only call site for both methods. A search for other call sites finds none.

```javascript
// Previously called from tryFormBonds:
isAtomRelevantToIntention(atom, intention) { ... }  // ~lines 372-380, O(1)
getAtomBondingPriority(freeAtom, moleculeAtom, intention) { ... } // ~lines 389-423
```

`getAtomBondingPriority` returns named priority categories (`'needed'`, `'excess'`, `'stabilizing'`, `'neutral'`) that were used to modulate bond probability. It includes a `'stabilizing'` case that has never been acted on by any caller (flagged as pre-existing YAGNI).

## Proposed Solutions

### Option A: Delete both methods (Recommended)

Remove `isAtomRelevantToIntention` (~9 lines) and `getAtomBondingPriority` (~35 lines). They are dead weight and their logic has been superseded.

**Pros:** Cleaner codebase, no ambiguity about whether they're safe to remove.
**Cons:** If the graduated-probability approach is revived in the future, the logic must be rewritten (it's in git history).
**Effort:** Small. **Risk:** None — they're not called.

### Option B: Mark deprecated with a comment

```javascript
/** @deprecated — replaced by zero-prob gate in tryFormBonds (commit 5d85d71).
 *  No longer called. Remove in next cleanup pass. */
isAtomRelevantToIntention(atom, intention) { ... }
```

**Pros:** Preserves the logic temporarily in case it's needed.
**Cons:** Deferred cleanup; dead code accumulates.
**Effort:** Trivial. **Risk:** None.

## Recommended Action

Option A — delete both methods. They're in git history if needed.

## Technical Details

- **Affected file:** `src/core/environment.js`
- **Methods:** `isAtomRelevantToIntention` (~line 372), `getAtomBondingPriority` (~line 389)
- Also check `getAtomBondingPriority`'s `'stabilizing'` return — never acted on by any caller

## Acceptance Criteria

- [ ] Both methods removed from `environment.js`
- [ ] No remaining call sites to either method
- [ ] `index.html` rebuilt after removal
- [ ] No test regressions

## Work Log

- 2026-02-25: Identified by architecture-strategist agent during code review of commit 5d85d71
