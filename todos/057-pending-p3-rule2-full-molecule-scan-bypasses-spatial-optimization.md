---
status: pending
priority: p3
issue_id: "057"
tags: [code-review, performance, intention-system]
dependencies: []
---

# `_rule2_repelIrrelevantMolecules` iterates all molecules instead of spatially-filtered set

## Problem Statement

All molecule-intent rules share a single `_buildState()` spatial query that pre-filters atoms via `getAtomsNear()`. This gives ~6x performance improvement per intent per tick by avoiding repeated spatial lookups.

`_rule2_repelIrrelevantMolecules` bypasses this optimization: it iterates `environment.molecules.values()` (the full molecule set), then performs a per-molecule distance check inside the loop. With 10 intents and 50 molecules, this is 500 distance checks per tick at the molecule level. Each check calls `mol.centerOfMass`, which — if not a cached property — iterates the molecule's atoms, making it O(intents × molecules × atoms_per_molecule).

At current scale this is acceptable. At 10× (30 intents, 150+ molecules) it becomes the dominant intention-system cost.

## Findings

- **Source:** Performance oracle
- `src/entities/intention.js` — `_rule2_repelIrrelevantMolecules()`: iterates `environment.molecules.values()` (full scan, line ~518)
- `_buildState()` at line ~344: performs single spatial query for atoms, result stored in `state.nearbyAtoms`
- No equivalent spatial pre-filter exists for molecules
- `mol.centerOfMass` — verify if cached or computed on every access

## Proposed Solutions

### Option A: Add a `nearbyMolecules` field to `_buildState()` state (Recommended)
Extend `_buildState()` to also compute nearby molecules using a spatial query or by checking which molecules have atoms in `state.nearbyAtoms`:
```js
// In _buildState():
const nearbyMoleculeIds = new Set(state.nearbyAtoms.map(a => a.moleculeId).filter(Boolean));
state.nearbyMolecules = [...nearbyMoleculeIds].map(id => environment.molecules.get(id));
```
Then `_rule2` iterates `state.nearbyMolecules` instead of all molecules.
- **Effort:** Small (2-3 lines in `_buildState`, 1-line change in `_rule2`)
- **Pros:** Consistent with the spatial-optimization pattern; reuses already-computed nearby atoms

### Option B: Cache `mol.centerOfMass` if it recomputes on access
- **Effort:** Small (add dirty flag to Molecule)
- **Cons:** Doesn't reduce iteration count; only reduces per-iteration cost

### Option C: Leave as-is until scale demands it
- **When:** Only address if profiling shows `_rule2` is a hot path
- **Effort:** Zero

## Acceptance Criteria

- [ ] `_rule2_repelIrrelevantMolecules` does not iterate molecules outside the intent radius
- [ ] `_buildState()` provides a `nearbyMolecules` field (or equivalent)
- [ ] All tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-18 | Created from code review (performance oracle finding) | Not blocking; address when molecule count grows |
