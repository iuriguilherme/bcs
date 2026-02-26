---
status: pending
priority: p1
issue_id: "007"
tags: [code-review, data-integrity, monomer, stable-molecules, architecture]
---

# P1: `stable-molecules.js` missing `'C6H5N3O5P'` key after formula change

## Problem Statement

`monomer-templates.js` was updated to change `ADENINE_NUCLEOTIDE.formula` from
`'C10H14N5O6P'` (24-atom) to `'C6H5N3O5P'` (20-atom) to match the actual atomLayout.
However, `stable-molecules.js` still has only the entry keyed `'C10H14N5O6P'` (line 1568).
No `'C6H5N3O5P'` entry was added.

This means:
1. Spontaneously assembled `C10H14N5O6P` molecules hit `applyStableConfiguration()` via the old entry, set `isMonomer = true` from `stable-molecules.js:1571`, but `findMonomerByFormula('C10H14N5O6P')` now returns `null` → `monomerTemplate = null` → `monomerId = null`. These molecules have `isMonomer=true` but fail the polymer intention check `mol.monomerId === 'adenine_nucleotide'`.
2. The 20-atom placed molecules (from catalogue) correctly get `isMonomer=true` via `_detectMonomerType()` (which reads from `MONOMER_TEMPLATES` where the formula was updated). Cell formation test passed only for this path.
3. Geometry reshaping never fires for any 20-atom adenine nucleotide because there is no `'C6H5N3O5P'` template in `STABLE_MOLECULES`.

## Findings

**File:** `src/data/stable-molecules.js:1568`

The entry `'C10H14N5O6P'` is an orphaned key. Any molecule assembling via spontaneous bonding with the old 24-atom formula hits `applyStableConfiguration()` → sets `isMonomer = true` but loses `monomerTemplate` (partial flag state). The new 20-atom formula has no stable-molecules entry at all.

**File:** `src/catalogue/monomer-templates.js:162` — formula changed from `'C10H14N5O6P'` to `'C6H5N3O5P'`.

**File:** `src/entities/molecule.js:268-278, 421-422` — two paths that set `isMonomer`:
- Path 1 (`_detectMonomerType`): reads `MONOMER_TEMPLATES` — now finds `C6H5N3O5P` ✓
- Path 2 (`applyStableConfiguration`): reads `STABLE_MOLECULES` — still uses old key, produces partial state

## Proposed Solutions

### Option A: Add `'C6H5N3O5P'` entry + keep `'C10H14N5O6P'` as non-monomer (Recommended)

Add a 20-atom `'C6H5N3O5P'` entry to `STABLE_MOLECULES` using the identical atomLayout
from `monomer-templates.js:171-196`, with `isMonomer: true` and matching `polymerName`.

For the old `'C10H14N5O6P'` entry: either remove it or keep it as a non-monomer stable
molecule (24-atom AMP without monomer semantics). If kept, remove `isMonomer: true` and
`polymerName` from it to prevent partial flag state on spontaneously assembled 24-atom AMP.

**Pros:** Both assembly paths produce consistent `isMonomer` state. Geometry reshaping fires
for placed nucleotides. No spontaneous 24-atom molecules get incorrect monomer flag.
**Cons:** Requires verifying the 20-atom atomLayout matches real adenine nucleotide geometry.
**Effort:** Medium. **Risk:** Low — purely additive in `STABLE_MOLECULES`.

### Option B: Remove `'C10H14N5O6P'` entry only

Remove the old entry. Molecules will never go through the reshape path for either formula,
but `_detectMonomerType()` still correctly identifies `C6H5N3O5P` molecules.

**Pros:** Eliminates partial flag state for 24-atom AMP.
**Cons:** No geometry reshaping for any adenine nucleotide formula. 24-atom AMP molecules
assembled spontaneously will not be recognized as anything.
**Effort:** Trivial. **Risk:** Very low.

### Option C: Redirect old key to new template

Change the key in `STABLE_MOLECULES` from `'C10H14N5O6P'` to `'C6H5N3O5P'` and update the
atomLayout to match the 20-atom layout.

**Pros:** Single entry, no orphan.
**Cons:** Breaks geometry reshaping for any 24-atom AMP already in IndexedDB.
**Effort:** Small. **Risk:** Low.

## Recommended Action

Option A — add the 20-atom entry, strip `isMonomer` from the 24-atom entry (or remove it).
This prevents partial flag state and adds geometry reshaping for the new formula.

## Technical Details

- **Affected files:** `src/data/stable-molecules.js` (lines 1568-1640)
- **Related files:** `src/catalogue/monomer-templates.js:171-196`, `src/entities/molecule.js:268-278, 421-422`
- **Formula to add key for:** `'C6H5N3O5P'` (P=1, O=5, C=6, N=3, H=5 from 20-atom layout)

## Acceptance Criteria

- [ ] `STABLE_MOLECULES['C6H5N3O5P']` exists with correct 20-atom atomLayout and `isMonomer: true`
- [ ] `STABLE_MOLECULES['C10H14N5O6P']` either removed or no longer has `isMonomer: true`
- [ ] Placed adenine nucleotide triggers geometry reshaping (`geometryVerified = true` observable in debug)
- [ ] Spontaneously assembled molecules with old or new formula have consistent `isMonomer`/`monomerId` (both set or both null)

## Work Log

- 2026-02-26: Identified by architecture-strategist agent during code review of PR #2 (fix/show-monomers-in-catalogue-ui)
