---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, architecture, monomer, molecule, partial-state, correctness]
---

# P2: `applyStableConfiguration()` sets `isMonomer=true` without populating `monomerTemplate`

## Problem Statement

`applyStableConfiguration()` in `molecule.js:421-422` propagates `isMonomer = true` from
the stable-molecule template object (`this.targetTemplate.isMonomer`), but does NOT call
`_detectMonomerType()` afterward. This leaves `this.monomerTemplate = null` and
`this.monomerId = null` on the molecule — even though `isMonomer = true`.

Polymer intentions check `mol.isMonomer && mol.monomerId === blueprint.monomerId` to find
suitable monomers. A molecule with `isMonomer=true, monomerId=null` silently fails this
check, so it is invisible to polymer assembly even though it looks like a monomer.

This is triggered by the `'C10H14N5O6P'` stable-molecule entry (the 24-atom adenine
nucleotide), which still has `isMonomer: true` in `stable-molecules.js:1571`. Any molecule
that spontaneously assembles to this formula goes through `applyStableConfiguration()` →
gets `isMonomer=true` → but `findMonomerByFormula('C10H14N5O6P')` now returns null (since
`monomer-templates.js` was updated to `'C6H5N3O5P'`) → `monomerId` stays null.

## Findings

**File:** `src/entities/molecule.js:420-422`

```javascript
// Current:
if (this.targetTemplate.isMonomer) {
    this.isMonomer = true;          // ← sets flag
    // ← _detectMonomerType() NOT called; monomerTemplate stays null
}
```

**File:** `src/entities/molecule.js:268-278` (`_detectMonomerType`)

This method correctly calls `findMonomerByFormula(this.formula)` and sets both
`this.monomerTemplate` AND `this.monomerId` if a match is found.

**File:** `src/entities/intention.js:1019` (polymer intention monomer check):

```javascript
mol.isMonomer && mol.monomerId === this.blueprint.monomerId
```

A molecule with `isMonomer=true, monomerId=null` fails this check unconditionally.

## Proposed Solutions

### Option A: Call `_detectMonomerType()` after `applyStableConfiguration()` flag path (Recommended)

```javascript
// In applyStableConfiguration(), after setting isMonomer:
if (this.targetTemplate.isMonomer) {
    this.isMonomer = true;
    this._detectMonomerType();  // ← ensures monomerTemplate + monomerId are populated
}
```

**Pros:** Single authoritative source of truth for `isMonomer` state. `monomerTemplate`
and `monomerId` are always populated whenever `isMonomer = true`. Regardless of which path
assembled the molecule.
**Cons:** `_detectMonomerType()` does a linear scan of `MONOMER_TEMPLATES` — called once
per molecule reshape, not in the hot loop, so performance impact is negligible.
**Effort:** Small (one line). **Risk:** Very low.

### Option B: Remove `isMonomer: true` from the `'C10H14N5O6P'` entry in stable-molecules.js

Since the formula no longer has a corresponding `MONOMER_TEMPLATES` entry, the
stable-molecule template should not set `isMonomer = true`.

This prevents partial state for 24-atom AMP molecules specifically, but does not
fix the general contract issue: `applyStableConfiguration()` can still produce partial
state for any future monomer added to `stable-molecules.js` without a `MONOMER_TEMPLATES`
counterpart.

**Pros:** Fixes the immediate symptom without touching molecule.js.
**Cons:** Does not fix the underlying design gap.
**Effort:** Trivial. **Risk:** Very low.

### Option C: Document as known limitation

Add a comment to `applyStableConfiguration()` noting that callers must ensure
`monomerTemplate` is set separately if `isMonomer = true`.

**Pros:** No code change.
**Cons:** The partial-state bug remains.
**Effort:** Trivial.

## Recommended Action

Option A + also address Option B as part of todo 007 (stable-molecules key cleanup).
The `_detectMonomerType()` call is a one-liner that eliminates the partial-state class
of bug for all future cases, not just the adenine nucleotide formula change.

## Technical Details

- **Affected file:** `src/entities/molecule.js`
- **Affected method:** `applyStableConfiguration()` (~lines 418-425)
- **Related method:** `_detectMonomerType()` (~lines 268-278)
- **Related data:** `src/data/stable-molecules.js:1571` (`isMonomer: true` on 24-atom AMP)

## Acceptance Criteria

- [ ] After `applyStableConfiguration()` sets `this.isMonomer = true`, `this.monomerId` is non-null for any formula that exists in `MONOMER_TEMPLATES`
- [ ] A spontaneously assembled molecule with formula `'C10H14N5O6P'` either: (a) does NOT get `isMonomer=true` (if `isMonomer` removed from stable entry), or (b) gets consistent `isMonomer=true` AND `monomerId='adenine_nucleotide'` (if `_detectMonomerType()` is added)
- [ ] Polymer intention correctly identifies spontaneously assembled monomer molecules

## Work Log

- 2026-02-26: Identified by architecture-strategist agent (Finding 4) during code review of PR #2
