---
title: "Broken getAtomsNear() grid query removed, _updateProgress regression restored, and defensive guard cleanup"
date: 2026-04-08
module: intention-system
problem_type: logic_error
severity: high
component: tooling
symptoms:
  - "Intention _buildState() called environment.getAtomsNear() which was removed, causing nearbyAtoms to be empty"
  - "applyAtomicForces() and tryFormBonds() called getAtomsNear() which returned wrong or incomplete results due to stale grid"
  - "Molecule intent progress counter stopped updating after PR #6 removed _updateProgress(state) call"
  - "Inspector Gathered counter used heavyweight typeof guard for backwards compatibility no longer needed"
  - "viewer.js referenced atom.isSeedAtom property that was never defined on the Atom class"
root_cause: logic_error
resolution_type: code_fix
tags:
  - getAtomsNear
  - spatial-grid
  - dead-code-removal
  - regression
  - _updateProgress
  - intention-system
  - defensive-guard
  - isSeedAtom
related_files:
  - src/core/environment.js
  - src/entities/intention.js
  - src/viewer/viewer.js
  - src/viewer/controls.js
  - index.html
---

# Broken `getAtomsNear()` grid query removed, `_updateProgress` regression restored, and defensive guard cleanup

Multiple issues found and fixed in a single refactoring pass across the environment, intention, viewer, and controls modules. The central problem was the `getAtomsNear()` spatial grid method, which was unreliable and eventually removed. Two secondary issues — a PR #6 regression that dropped `_updateProgress()` and accumulated defensive guards — were fixed alongside.

---

## Symptoms

1. **Intention atoms not detected**: `_buildState()` in `intention.js` called `environment.getAtomsNear()` to find atoms near the intention zone. When `getAtomsNear()` returned incomplete results (or after it was deleted), intentions could not detect nearby atoms, stalling the entire 7-rule pipeline.

2. **Intermittent bonding failures**: `applyAtomicForces()` and `tryFormBonds()` used `getAtomsNear()` to find neighbor atoms for both repulsion/attraction forces and bond formation. The spatial grid could become stale (atoms moved but grid not updated in time), causing atoms to miss neighbors — bonds that should form wouldn't.

3. **Progress counter frozen**: After PR #6 (`7f1a4fb`) cleaned up a redundant inner `if (this.type === 'molecule')` guard in `Intention.update()`, the `_updateProgress(state)` call was accidentally removed. Molecule intents tracked atom claiming internally but the `this.progress` float stopped updating, causing the inspector to show stale progress values.

4. **Defensive `typeof` guard in controls.js**: The inspector Gathered line used `typeof intention.getGatheredCount === 'function' ? intention.getGatheredCount() : intention.gatheredComponents.size` — a backwards-compatibility guard added in PR #4 for old serialized intentions. After PR #4 merged and all code paths now include `getGatheredCount()`, the guard was dead weight adding visual noise.

5. **Undefined `atom.isSeedAtom` referenced in viewer.js**: The free-atom rendering loop and `getEntityAt()` hit-test added `!atom.isSeedAtom` checks, but `isSeedAtom` was never defined as a property or getter on the `Atom` class. This evaluates to `!undefined === true`, meaning the check is currently a no-op — but it's a latent bug waiting to cause issues.

---

## Root Cause Analysis

### Issue 1: `getAtomsNear()` spatial grid unreliability

The `getAtomsNear(x, y, radius)` method used a spatial hash grid (`this.grid`) to efficiently find atoms within a radius. However, the grid's correctness depended on `updateGridPosition()` being called after every atom position change. Multiple code paths could move atoms without updating the grid:

- Intention forces (`_rule5_attractClaimed`) directly set atom velocity
- Bond spring forces applied via `bond.applySpringForce()` → atom moves in `atom.update(dt)` → grid update follows, but `tryFormBonds()` runs between force application and grid update
- Seed molecule assembly sets atom positions directly during reshaping

The grid was a performance optimization (O(1) cell lookup vs O(n) linear scan) that sacrificed accuracy. For the current simulation scale (~50-200 atoms), the O(n²) brute-force approach is fast enough and always correct.

### Issue 2: `_updateProgress(state)` regression

PR #6 commit `7f1a4fb` removed a redundant `if (this.type === 'molecule')` inner guard and its dead `else` branch. During this cleanup, the `_updateProgress(state)` call at the end of the molecule branch was accidentally deleted. The line that existed in the inner block's end wasn't carried through when the block was flattened.

The function was called after all rules ran (`_rule1` through `_rule7`) and computed `this.progress` from the ratio of claimed/bonded atoms to total target atoms. Without it, `this.progress` stayed at whatever value was last set before the deletion — typically 0 or a stale partial value.

### Issue 3: Accumulated defensive guards

Several `typeof` and `?.` guards were added during PR #4 development to handle the possibility of loading old serialized state that lacked the new `getGatheredCount()` method or `getAllSeedMolecules()` accessor. After PR #4 merged, these guards became permanently dead code because:

- All code now includes `getGatheredCount()` on every `Intention` instance
- All code now includes `getAllSeedMolecules()` on every `Environment` instance
- No serialization format stores methods — they come from the class definition

---

## Solution

### Fix 1: Delete `getAtomsNear()`, replace with inline `Array.filter()`

**File**: `src/core/environment.js`

Deleted the entire `getAtomsNear()` method (39 lines) and replaced all three call sites with simple inline distance checks:

```javascript
// BEFORE (applyAtomicForces, radius 100; tryFormBonds uses bondingRadius ≈ 40):
const nearby = this.getAtomsNear(atom1.position.x, atom1.position.y, 100);

// AFTER (distanceTo() is Vector2.distanceTo — a project-specific method):
const nearby = atoms.filter(a => a.position.distanceTo(atom1.position) < 100);
```

**File**: `src/entities/intention.js` — `_buildState()`:

```javascript
// BEFORE:
const nearbyAtoms = environment.getAtomsNear(
    this.position.x, this.position.y, this.radius * 1.2
);

// AFTER:
const nearbyAtoms = Array.from(environment.atoms.values()).filter(
    a => a.position.distanceTo(this.position) < this.radius * 1.2
);
```

The inline approach is always correct because it checks actual current positions, not potentially stale grid cell assignments. At the current simulation scale, the O(n) filter is negligible.

> **Note**: The grid infrastructure (`this.grid`, `updateGridPosition()`, `removeFromGrid()`, `gridSize`) was NOT removed — it's still used by other parts of the system. Only the query method `getAtomsNear()` was deleted.

### Fix 2: Restore `_updateProgress(state)` call

**File**: `src/entities/intention.js` — `update()` method:

```javascript
// At the end of the molecule-type branch, after all seven rules:
this._rule7_checkCompletion(environment, state);
this._updateProgress(state);  // ← restored; accidentally dropped in PR #6
```

This was the original line removed during PR #6 flattening. The call must come AFTER all rules have run (`_rule1`–`_rule7`), since `_rule3_claimFreeAtoms` and `_rule4_extractFromMolecules` change the claimed atom count that `_updateProgress` reads.

### Fix 3: Simplify `getGatheredCount()` inspector call

**File**: `src/viewer/controls.js` line 770:

```javascript
// BEFORE (defensive typeof guard):
<p>Gathered: ${typeof intention.getGatheredCount === 'function'
    ? intention.getGatheredCount()
    : intention.gatheredComponents.size} / ${escHtml(String(reqCount))}</p>

// AFTER (direct call):
<p>Gathered: ${intention.getGatheredCount()} / ${escHtml(String(reqCount))}</p>
```

### Fix 4: Simplify `getAllSeedMolecules()` guard in viewer.js

**File**: `src/viewer/viewer.js` — `getEntityAt()` call site only. The guard in `_renderSeedMoleculeAtoms` was not changed (partial fix):

```javascript
// BEFORE (typeof guard):
const seedMolecules = this.environment.getAllSeedMolecules
    ? this.environment.getAllSeedMolecules()
    : [];

// AFTER (direct call with short-circuit fallback):
const seedMolecules = this.environment.getAllSeedMolecules() || [];
```

> ⚠️ **Incomplete**: `_renderSeedMoleculeAtoms` still has the original `typeof` guard. Both call sites should be simplified in a follow-up.

### Fix 5: Simplify `getEntityAt()` Level 0 branch

**File**: `src/viewer/viewer.js` — `getEntityAt()`:

Removed the molecule-checking loop from the Level 0 (`this.level < 1`) branch. At Level 0, only individual atoms are displayed — molecules are a Level 1+ concept. The old code checked molecules after atoms at Level 0, which was dead logic that could never match anything visible.

```javascript
// BEFORE:
} else {
    for (const atom of this.environment.getAllAtoms()) { ... }
    for (const molecule of this.environment.getAllMolecules()) { ... }  // dead at Level 0
}

// AFTER:
} else {
    for (const atom of this.environment.getAllAtoms()) { ... }
    return null;
}
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/core/environment.js` | Deleted `getAtomsNear()` (39 lines); replaced 2 call sites with inline `atoms.filter()` |
| `src/entities/intention.js` | Replaced `getAtomsNear()` call in `_buildState()` with inline filter; restored `_updateProgress(state)` call; updated JSDoc |
| `src/viewer/viewer.js` | Partially simplified seed molecule guards (getEntityAt only); added `!atom.isSeedAtom` filter (⚠️ introduced no-op — property never defined on Atom); simplified Level 0 `getEntityAt()` |
| `src/viewer/controls.js` | Removed `typeof` guard from `getGatheredCount()` call |
| `index.html` | Rebuilt bundle |

---

## Known Issue: `atom.isSeedAtom` is undefined

The `viewer.js` changes introduced `!atom.isSeedAtom` checks in two places:
- `_renderMoleculeLevel()` free-atom loop (line 320)
- `getEntityAt()` free-atom hit-test (line 599)

However, `isSeedAtom` is **never defined** on the `Atom` class — it has no property, getter, or assignment anywhere in `src/entities/atom.js`. Since `undefined` is falsy, `!atom.isSeedAtom` always evaluates to `true`, making the check a no-op.

This is currently harmless but creates two risks:
1. If someone later adds `isSeedAtom = true` to seed atoms, the filter will silently start excluding them from the free-atom loop — potentially breaking rendering
2. The intent of the check is ambiguous: is it a planned API that hasn't been implemented yet, or was it meant to use a different property?

The existing `atom.moleculeId` check already handles seed atoms correctly (seed atoms have `moleculeId` set to the seed molecule's ID), so the `isSeedAtom` check is redundant. It should either be:
- Removed (redundant with `moleculeId` check), or
- Actually implemented as a getter: `get isSeedAtom() { return this.moleculeId && env.seedMolecules.has(this.moleculeId); }`

---

## Prevention

### 1. Grid correctness requires synchronous updates

If a spatial grid optimization is re-introduced in the future, it must satisfy the invariant: **the grid reflects actual atom positions at the moment of query**. This means either:
- Call `updateGridPosition()` synchronously after every position change, or
- Rebuild the entire grid at the start of each tick before any queries

The simpler alternative (linear scan) is correct by construction. Only add a grid when profiling shows the O(n²) scan is actually a bottleneck (>500 atoms).

### 2. Flatten refactoring checklist

When flattening nested conditionals (removing redundant inner guards), verify every statement in the old block is preserved:

```
Before flattening:
  if (X) {
      if (X) {      ← redundant guard
          A();
          B();
          C();      ← easy to lose at the end of the block
      }
  }

After flattening:
  if (X) {
      A();
      B();
      C();          ← must be preserved
  }
```

Compare line-by-line before and after. The last statement in a block is the most likely to be dropped.

### 3. Remove defensive guards when the contract stabilizes

Defensive `typeof` guards are appropriate during development when methods may not exist on all instances (e.g., mixed old/new serialized objects). Once the method is part of the stable class definition and old serialized objects are no longer in circulation, remove the guard. Dead guards obscure the actual contract.

**Rule of thumb**: If a `typeof fn === 'function'` guard would crash production today if removed, keep it. If it wouldn't, remove it.

### 4. Don't reference undefined properties

Never add a condition like `!atom.someProperty` without verifying that `someProperty` is actually defined somewhere. In JavaScript, accessing an undefined property returns `undefined` without throwing — which means the bug is silent. Use `grep` to verify:

```bash
grep -rn "isSeedAtom" src/entities/  # Should find a definition
```

---

## Related Documentation

- [`docs/solutions/logic-errors/dead-code-review-environment-intention-stale-bundle.md`](dead-code-review-environment-intention-stale-bundle.md) — PR #6 code review that triggered the `_updateProgress` regression; documents the inner-guard flattening that caused it
- [`docs/solutions/ui-bugs/inspector-counter-and-seed-atoms-display-bugs-InspectionRenderer-20260228.md`](../ui-bugs/inspector-counter-and-seed-atoms-display-bugs-InspectionRenderer-20260228.md) — Original PR #4 fix that introduced `getGatheredCount()`, `getAllSeedMolecules()`, and `_renderSeedMoleculeAtoms()`; the defensive `typeof` guards being removed here were added in that PR
- [`docs/solutions/physics-issues/wrong-element-atoms-crowding-intention-zones.md`](../physics-issues/wrong-element-atoms-crowding-intention-zones.md) — `_rule1`–`_rule7` pipeline context; `_buildState()` is the entry point that gathers nearby atoms for the entire pipeline
- [`docs/plans/2026-02-27-fix-intention-display-bugs-plan.md`](../../plans/2026-02-27-fix-intention-display-bugs-plan.md) — Original plan that specified Option A (accessor pattern) for seed molecule rendering; this refactoring preserves that architecture while cleaning up the implementation
- **AGENTS.md Bug #6**: Intention system failures documentation; `_updateProgress` is part of the progress tracking system described there
- [`tests/scenarios/t07-intention-display.spec.js`](../../../tests/scenarios/t07-intention-display.spec.js) — Playwright scenario that covers intention display behavior; a regression dropping `_updateProgress` would be caught here
