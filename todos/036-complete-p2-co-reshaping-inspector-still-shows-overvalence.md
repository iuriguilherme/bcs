---
status: complete
priority: p2
issue_id: "036"
tags: [code-review, thermodynamics, ui, architecture]
dependencies: []
---

# Phase 8 is confirmed no-op but Inspector will still show `Valence: 3/2` for CO oxygen

## Problem Statement

Phase 8 says reshaping "may be a no-op" and asks the implementer to investigate. The architecture review confirmed that reshaping uses `new Bond(atom1, atom2, order)` directly (at `molecule.js:502`), bypassing `canBondWith()` entirely. So no changes to `molecule.js` are needed for CO bonds to form. However, this means CO oxygen will have `bondCount=3, maxBonds=2` → `availableValence = -1`. The Inspector will display `Valence: 3/2` — which is the original bug we set out to fix. The plan does not address whether this display is now acceptable or needs a UI fix.

## Findings

- `molecule.js:502`: `const bond = new Bond(atom1, atom2, order)` — confirmed, bypasses `canBondWith()`
- After reshaping creates CO triple bond: O atom has `bondCount=3`, `maxBonds=2`, `availableValence=-1`
- The Inspector reads `atom.availableValence` and displays it — will show `Valence: 3/2` as before
- This is the original bug state described in the Problem Statement of the plan
- The plan's acceptance criterion says "Oxygen in CO shows `Valence: 3/2` resolved — displays as valid chemistry, not a bug"
- But the fix does NOT change how `availableValence` is displayed — it's still negative

## Proposed Solutions

### Option 1: Update Plan Phase 8 with confirmed finding and add a display fix (Recommended)

Replace the "investigate" note in Phase 8 with:
1. Confirmed statement: reshaping uses `new Bond()` directly — no `molecule.js` change needed for bonds
2. Add a new task: update the Inspector to display `Valence: over` or display `3/3` (not `3/2`) for intentionally over-valenced atoms in stable CO molecules

```javascript
// In Inspector rendering for atom valence display:
const displayValence = Math.max(atom.bondCount, atom.maxBonds);  // don't show negative
const label = atom.bondCount > atom.maxBonds
    ? `${atom.bondCount}/${atom.bondCount} ★`  // over-bonded but intentional
    : `${atom.bondCount}/${atom.maxBonds}`;
```

**Pros:** Resolves the original bug symptom; confirms the investigation result
**Cons:** Requires identifying where in Inspector the valence label is rendered
**Effort:** 1 hour
**Risk:** Low

---

### Option 2: Update plan to say `Valence: 3/2` is acceptable for CO

The original bug was that `Valence: 3/2` indicated a BROKEN state. After the fix, it indicates an intentionally over-bonded state (CO triple bond). Update the acceptance criterion to say "CO oxygen correctly shows `Valence: 3/2` as an over-bonded but stable state" instead of "resolved."

**Pros:** No additional code needed; honest about what the fix achieves
**Cons:** The user still sees the same display that looked like a bug before — confusing

**Effort:** 5 minutes
**Risk:** Low

## Recommended Action

Option 1 — the plan should confirm Phase 8 is a no-op for molecule.js and add an explicit note about the Inspector display. The valence display for intentionally over-bonded atoms (CO, N≡N) needs to communicate "this is valid chemistry" rather than looking like an error. At minimum, add this as a known limitation in the plan.

## Technical Details

**Affected files:**
- `docs/plans/2026-03-01-feat-thermodynamics-temperature-bond-stability-plan.md` — Phase 8 rewrite
- `src/viewer/controls.js` — Inspector valence display rendering (find the atom valence label code)
- `src/entities/molecule.js:502` — confirmed `new Bond()` usage

## Acceptance Criteria

- [ ] Phase 8 in plan states definitively that reshaping uses `new Bond()` directly — no molecule.js change needed
- [ ] Plan addresses the Inspector display for CO oxygen (either a display fix or accepted limitation)
- [ ] If display fix: Inspector shows CO oxygen as valid, not as error state
- [ ] If accepted limitation: acceptance criteria updated to reflect this

## Work Log

### 2026-03-01 - Identified by Architecture Strategist + Code Simplicity Reviewer

**By:** Code review agents (technical_review workflow)

**Actions:**
- Architecture agent read `molecule.js:502`, confirmed `new Bond(atom1, atom2, order)` usage
- Simplicity agent flagged Phase 8 "verify this" as resolvable immediately
- Connected the confirmation to the unaddressed Inspector display issue

---

### 2026-03-01 - Resolved

**By:** Claude Code

**Actions:**
- Rewrote Phase 8 from "investigation note" to confirmed finding: `_restructureBonds()` uses `new Bond()` directly — no molecule.js change needed
- Added Inspector display fix to Phase 8: `controls.js:552` shows `Valence: 3/3*` for over-bonded atoms
- Updated acceptance criterion from "resolved" to specific `3/3*` display format
- Added `src/viewer/controls.js` to Files table; changed molecule.js to "No change"

## Resources

- **Plan:** `docs/plans/2026-03-01-feat-thermodynamics-temperature-bond-stability-plan.md` Phase 8
- **Source:** `src/entities/molecule.js:502` — `_restructureBonds()` using `new Bond()`
- **Source:** `src/viewer/controls.js:552` — Inspector valence label
