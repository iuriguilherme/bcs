---
status: pending
priority: p3
issue_id: "014"
tags: [code-review, simplicity, duplication, catalogue, refactor]
---

# P3: Duplicate valence-checking logic in `catalogue.js` and `catalogue-ui.js`

## Problem Statement

`_isBlueprintValid()` in `catalogue.js` (lines 184-213) and `isBlueprintStable()` in
`catalogue-ui.js` are near-identical ~30-line functions. Both iterate `bp.atomData`,
build a valence-usage map, iterate `bp.bondData`, and check that every atom's used valence
equals its max valence. The only difference is the function name and file location.

If the valence-checking logic ever needs to change (e.g. for multi-valence elements or
bond-order corrections), both copies must be updated in sync. The duplication is a
maintenance hazard.

## Findings

**File:** `src/catalogue/catalogue.js:184-213` — `_isBlueprintValid(bp)`

```javascript
_isBlueprintValid(bp) {
    if (!bp.atomData || bp.atomData.length < 2) return false;
    if (!bp.bondData || bp.bondData.length < 1) return false;
    const atomValences = {};
    for (const atom of bp.atomData) {
        const element = getElement(atom.symbol);
        if (!element) return false;
        atomValences[atom.index] = { max: element.valence, used: 0 };
    }
    for (const bond of bp.bondData) {
        const order = bond.order || 1;
        if (atomValences[bond.atom1Index]) atomValences[bond.atom1Index].used += order;
        if (atomValences[bond.atom2Index]) atomValences[bond.atom2Index].used += order;
    }
    for (const idx in atomValences) {
        const v = atomValences[idx];
        if (v.used !== v.max) return false;
    }
    return true;
}
```

**File:** `src/viewer/catalogue-ui.js` — `isBlueprintStable(bp)` (same logic, different name)

Both functions are called for the same purpose: determining whether a blueprint's atoms
have all valence satisfied.

## Proposed Solutions

### Option A: Move shared logic to `src/catalogue/blueprint.js` as a static method (Recommended)

Add `static isStable(bp)` to `MoleculeBlueprint` or a `BlueprintUtils` export, and have
both `catalogue.js` and `catalogue-ui.js` call it.

```javascript
// blueprint.js:
static isBlueprintStable(bp) { /* shared logic */ }

// catalogue.js:
_isBlueprintValid(bp) { return MoleculeBlueprint.isBlueprintStable(bp); }

// catalogue-ui.js:
function isBlueprintStable(bp) { return MoleculeBlueprint.isBlueprintStable(bp); }
```

**Pros:** Single authoritative implementation. Future changes propagate automatically.
**Cons:** Requires knowing load order (`blueprint.js` must load before both consumers —
it already does per `build.ts` script order).
**Effort:** Small. **Risk:** Low.

### Option B: Delete `_isBlueprintValid()` and call `isBlueprintStable()` from `catalogue-ui.js`

Since `catalogue-ui.js` loads after `catalogue.js`, `catalogue.js` cannot call the UI
function. But the UI function could be promoted to `blueprint.js` and `catalogue.js`
could import it.

Same as Option A in practice.

### Option C: Leave as-is (accept duplication)

**Pros:** No change.
**Cons:** Maintenance hazard. Future changes require updating two files.
**Effort:** None.

## Recommended Action

Option A — move the logic to `blueprint.js` as a static utility. This is the natural
home for blueprint-related utility logic and already in the load order before both callers.

## Technical Details

- **Affected files:**
  - `src/catalogue/catalogue.js:184-213` (`_isBlueprintValid`)
  - `src/viewer/catalogue-ui.js` (`isBlueprintStable`)
  - `src/catalogue/blueprint.js` — add shared static method
- **Build order:** `blueprint.js` loads before `catalogue.js` and `catalogue-ui.js` (verified in `build.ts`)

## Acceptance Criteria

- [ ] Single implementation of the valence-checking logic exists in one place
- [ ] Both `catalogue.js` and `catalogue-ui.js` call the shared implementation
- [ ] Catalogue cleanup and UI filter produce identical results for the same blueprint
- [ ] Build and manual test pass (stable molecules visible in catalogue, monomers get Monomer badge)

## Work Log

- 2026-02-26: Identified by code-simplicity-reviewer agent (low severity) during code review of PR #2
