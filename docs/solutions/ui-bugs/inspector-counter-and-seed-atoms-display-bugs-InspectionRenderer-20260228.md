---
title: "Intention Inspector Gathered Counter Always Zero and Seed Molecule Atoms Invisible at Level 2"
date: 2026-02-28
category: ui-bugs
tags:
  - intention-system
  - inspector
  - gathered-counter
  - seed-molecules
  - level-rendering
  - viewer
  - molecule-pipeline
  - progress-tracking
  - environment
  - controls
module: IntentionSystem + Viewer/Inspector
symptom: Inspector shows 'Gathered: 0' for molecule intentions despite visible assembly, and seed molecule atoms disappear when switching to Level 2 view
root_cause: Molecule-type intentions populate 'this.progress' (not 'gatheredComponents') via the 7-rule pipeline, and seed molecules stored in 'environment.seedMolecules' are skipped by both the molecule-level render path (which only reads 'environment.molecules') and the free-atom render path (which skips atoms with a 'moleculeId')
pr_number: 4
commits:
  - "4edf15c: fix: resolve intention display bugs — inspector Gathered counter and Level 2 atom visibility"
  - "ec3cff6: refactor: address code review findings — simplify guards, remove hot-path warn, clarify design"
  - "97887a6: fix: escape remaining intention.type and reqCount strings against XSS"
  - "450c1dd: Merge pull request #4 from iuriguilherme/fix/intention-display-bugs"
---

# Intention Inspector Gathered Counter Always Zero and Seed Molecule Atoms Invisible at Level 2

Two display-only bugs found and fixed together on branch `fix/intention-display-bugs`. Both are presentation-layer failures — simulation state is correct in both cases. No physics or entity logic changes were needed.

---

## Bug 1: Inspector "Gathered" Counter Always Shows 0

### Symptom

The Inspector panel showed `Gathered: 0 / 6` (or any target count) for molecule-type intentions even when the canvas label correctly showed atoms being assembled. The "Progress" percentage was accurate; only the "Gathered" discrete counter was wrong.

### Root Cause

The inspector at `src/viewer/controls.js:770` originally read `intention.gatheredComponents.size` unconditionally. The `gatheredComponents` field is a `Set` that is **only populated for `type='polymer'` and `type='cell'` intentions**. For `type='molecule'`, the Set is initialized empty in the constructor and never written to.

Molecule-type intentions track assembly state via the **7-rule pipeline** (`_rule1`–`_rule7`), which advances `this.progress` as a floating-point ratio (0.0–1.0). The polymer/cell path uses `_attractComponents()` + `_checkCompletion()`, which adds gathered molecule IDs to `this.gatheredComponents`. The inspector read a field that only the polymer/cell path populates — so molecule intentions always showed zero.

```
type='molecule'  → 7-rule pipeline → this.progress (float)    ← correct data source
type='polymer'   → _attractComponents  → this.gatheredComponents ← correct data source
type='cell'      → _attractComponents  → this.gatheredComponents ← correct data source

Inspector before fix: always read gatheredComponents.size → always 0 for molecule type
```

### Fix

**Part 1 — `getGatheredCount()` method on `Intention`** (`src/entities/intention.js`):

```javascript
/**
 * Get the number of gathered components for display.
 * For molecule intents, gatheredComponents is never populated — use progress instead.
 * For polymer/cell intents, gatheredComponents is maintained by _attractComponents.
 * @returns {number}
 */
getGatheredCount() {
    if (this.type === 'molecule') {
        const total = this.blueprint.atomData?.length || 0;
        return Math.round(this.progress * total);
    }
    return this.gatheredComponents.size;
}
```

The molecule branch converts the continuous `progress` float back to a discrete count: `Math.round(progress * atomCount)`. This is the inverse of how progress is advanced (each accepted atom adds `1 / total` to progress). The `?.length || 0` guard handles blueprints without explicit `atomData`.

A NOTE comment was added to the `gatheredComponents` constructor declaration to document the asymmetry:

```javascript
// NOTE: gatheredComponents is only populated for type='polymer'/'cell'.
// For type='molecule', use getGatheredCount() which reads from this.progress instead.
// This asymmetry is intentional — molecule intents track progress as a float (0-1),
// while polymer/cell intents track it as a Set of gathered component IDs.
this.gatheredComponents = new Set();
```

**Part 2 — Inspector call-site** (`src/viewer/controls.js:770`):

```javascript
<p>Gathered: ${typeof intention.getGatheredCount === 'function'
    ? intention.getGatheredCount()
    : intention.gatheredComponents.size} / ${escHtml(String(reqCount))}</p>
```

The `typeof` guard provides a safe fallback for intentions deserialized from older save files that pre-date this fix. Without it, calling an undefined method would crash the inspector panel.

### Regression Test (T07)

`tests/scenarios/t07-intention-display.spec.js:22` — waits for `intention.progress > 0`, then checks that the Inspector shows `Gathered: X / Y` with `X > 0`.

---

## Bug 2: Seed Molecule Atoms Invisible at Level 2

### Symptom

When switching from Level 0 (atom view) to Level 2 (molecule/polymer view) while a molecule intention was actively assembling atoms, the in-progress assembly disappeared entirely from the canvas. The atoms existed in the simulation; they were simply not rendered.

### Root Cause

In-progress intention assemblies are stored as **seed molecules** in `environment.seedMolecules` — a `Map` kept separate from `environment.molecules`. This isolation is intentional: it prevents `updateMolecules()` from dissolving or overwriting mid-assembly structures.

The Level 2 renderer (`_renderProteinLevel`) iterated only `getAllMolecules()` (which reads `environment.molecules`) and skipped atoms with a `moleculeId`. Seed molecule atoms set `atom.moleculeId` to the seed mol's ID — so they were invisible via both paths:

```
Render path 1: getAllMolecules() → reads env.molecules only → seed mols not present → skipped
Render path 2: free-atom loop:  if (!atom.moleculeId) → seed atoms have moleculeId set → skipped
```

The same gap existed at Level 1 (`_renderMoleculeLevel`) and in `getEntityAt()` (hit-testing), making seed assemblies unselectable even if somehow visible.

### Fix

**Part 1 — `getAllSeedMolecules()` accessor on `Environment`** (`src/core/environment.js`):

```javascript
/**
 * Get all seed molecules (in-progress intention assemblies) as array
 */
getAllSeedMolecules() {
    return Array.from(this.seedMolecules.values());
}
```

Follows the exact pattern of `getAllMolecules()`, `getAllAtoms()`, etc. Gives the viewer a public API that does not expose the internal Map directly.

**Part 2 — `_renderSeedMoleculeAtoms()` helper** (`src/viewer/viewer.js`):

```javascript
/**
 * Render atoms of in-progress intention seed molecules as individual atoms.
 * Seed molecules live in environment.seedMolecules (separate from environment.molecules)
 * and would otherwise be invisible at molecule/protein level.
 */
_renderSeedMoleculeAtoms(scale, offset) {
    const seedMolecules = this.environment.getAllSeedMolecules
        ? this.environment.getAllSeedMolecules()
        : [];
    for (const seedMol of seedMolecules) {
        for (const atom of seedMol.atoms) {
            atom.render(this.ctx, scale, offset);
        }
    }
}
```

Seed atoms render as individual atom glyphs (Level 0 style), not as molecule blobs. This is correct — showing an incomplete assembly as a blob would misrepresent its structure.

Called in two renderers:

```javascript
// Inside _renderMoleculeLevel() — after molecule blobs, before free-atom pass
this._renderSeedMoleculeAtoms(scale, offset);

// Inside _renderProteinLevel() — after free-atom pass
this._renderSeedMoleculeAtoms(scale, offset);
```

**Part 3 — `getEntityAt()` hit-test extension** (`src/viewer/viewer.js`):

```javascript
// Also check in-progress seed molecules (stored separately in environment.seedMolecules)
const seedMolecules = this.environment.getAllSeedMolecules
    ? this.environment.getAllSeedMolecules()
    : [];
for (const seedMol of seedMolecules) {
    if (seedMol.containsPoint(screenX, screenY, scale, offset)) {
        return { type: 'molecule', entity: seedMol };
    }
}
```

Returns the same `{ type: 'molecule', entity }` shape as the regular molecule hit-test, so the inspector panel handles seed mols identically to completed molecules.

**Level 3 intentionally excluded** — `_renderCellLevel()` omits seed molecule atoms. At Level 3, molecule-intent zones are already hidden by `_renderIntentions()` (level ≤ 1 guard), so rendering seed atoms without their guiding zone ring would produce orphaned floating particles with no context.

### Regression Test (T07b)

`tests/scenarios/t07-intention-display.spec.js:101` — waits for seed molecules to have atoms, switches to Level 2, asserts atom count is unchanged via `getAllSeedMolecules()`.

---

## Files Changed

| File | Change |
|---|---|
| `src/entities/intention.js` | Added `getGatheredCount()` method; NOTE comment on `gatheredComponents` |
| `src/core/environment.js` | Added `getAllSeedMolecules()` accessor |
| `src/viewer/viewer.js` | Added `_renderSeedMoleculeAtoms()` helper; called in Level 1 and Level 2 renderers; extended `getEntityAt()` |
| `src/viewer/controls.js` | Inspector "Gathered:" line calls `getGatheredCount()` with typeof fallback |
| `tests/scenarios/t07-intention-display.spec.js` | T07 (Bug 1) and T07b (Bug 2) regression tests |
| `index.html` | Auto-regenerated bundle |

---

## Related Documentation

- **[`docs/solutions/logic-errors/molecule-intent-stuck-reshaping-IntentionSystem-20260225.md`](../logic-errors/molecule-intent-stuck-reshaping-IntentionSystem-20260225.md)** — Full 7-rule pipeline internals, seed molecule state machine (`isReshaping` → `reshapingTimer` → `cancelReshaping()` → `geometryVerified`), and the five root causes of stuck intention progress. Primary reference for the `_rule1`–`_rule7` code path that uses `this.progress`.

- **[`docs/solutions/logic-errors/monomers-invisible-monomer-blueprints-CatalogueSystem-20260226.md`](../logic-errors/monomers-invisible-monomer-blueprints-CatalogueSystem-20260226.md)** — Accessor correctness and inspector label fixes in `_showBlueprintInspector()` (`catalogue-ui.js`). The Monomer Invariant (`isMonomer + monomerId + monomerTemplate`) and dead method removal from `environment.js`.

- **[`docs/solutions/security-issues/2026-02-28-xss-innerHTML-blueprint-strings-inspector-controls-20260228.md`](../security-issues/2026-02-28-xss-innerHTML-blueprint-strings-inspector-controls-20260228.md)** — The `escHtml()` pattern required for all inspector rendering code, including the `reqCount` denominator in the "Gathered:" line.

- **[`docs/solutions/test-failures/playwright-test-infrastructure-audit-8-findings-20260226.md`](../test-failures/playwright-test-infrastructure-audit-8-findings-20260226.md)** — Accessor guard pattern (`typeof env.getAll* !== 'function'` vs `?.() || []`), T06 Viewer level-transition testing approach, blueprint drift risk from hardcoded test fixtures.

---

## Prevention Strategies

### 1. The Consumer Coverage Gap

Both bugs share one root cause: a new collection or data path was added to the environment, but the consumers (Inspector, Viewer) were not updated to cover it.

**When adding a new intention type:**
- Audit every consumer that reads intention state for display. Inspector, Catalogue UI, and statistics aggregators are the primary consumers.
- Determine which pipeline the new type uses. If it uses a different internal representation than `gatheredComponents` (e.g., `progress`), add a branch in `getGatheredCount()` for it.
- Put translation logic on the `Intention` class as an accessor method — never let consumers peek at internal fields like `gatheredComponents.size` or `progress` directly. If the representation changes, only the method needs to update.

**When adding a new render level:**
- Enumerate every environment collection that holds renderable entities at that level. Walk the list explicitly rather than copying from an adjacent level.
- Cross-reference the environment's full collection list against every render level branch whenever the renderer is modified.

### 2. The Accessor Contract Rule

> Viewer and Controls code must never access raw environment Maps directly. All collection access goes through `getAll*()` accessor methods.

The environment's internal storage can split a logical collection across multiple Maps (`molecules` vs `seedMolecules`). A consumer that accesses `env.molecules` directly silently omits anything in `env.seedMolecules`. The accessor is the single place where all Maps are unified.

**When adding a new collection Map to `Environment`:**

```javascript
// Always pair the storage and the accessor:
this.newThings = new Map();          // internal storage

getAllNewThings() {                   // accessor for all consumers
    return Array.from(this.newThings.values());
    // Include any secondary Maps (seedNewThings, etc.) here
}
```

Code review should flag `env.<rawMap>` references in Viewer and Controls the same way it flags missing null checks.

### 3. The Two Code Paths Gotcha

The intention system has two fundamentally different pipelines:

| Path | Type | Progress tracking | `gatheredComponents` |
|---|---|---|---|
| 7-rule pipeline | `molecule` | `this.progress` (float 0–1) | Never populated |
| `_attractComponents` | `polymer`, `cell` | `this.gatheredComponents` (Set) | Populated each tick |

Any feature touching progress reporting, completion state, display, or serialization must handle **both** paths explicitly. The `getGatheredCount()` method is the worked example: its `if (this.type === 'molecule')` branch makes the asymmetry explicit and handles it correctly.

**Checklist for any intention feature:**
- [ ] Which pipeline(s) does this feature touch?
- [ ] Does `_updateProgress()` produce the right value for molecule-type?
- [ ] Does `_attractComponents()` / `gatheredComponents` carry the right data for polymer/cell-type?
- [ ] Is the consumer reading from an accessor that handles both paths?
- [ ] Is there a test that exercises both a molecule-type and a polymer-type intention for this feature?

### 4. Debugging Tips

**Inspector counter stuck at 0:**
1. Open console and inspect `window.cellApp.environment.intentions`.
2. For the intention in question, check both `intention.gatheredComponents.size` and `intention.progress`.
3. If `progress > 0` but `gatheredComponents.size === 0`, the consumer is reading the wrong field. The fix is always to add a method on `Intention` that dispatches on `this.type`.

**Entities visible at Level 0 but invisible at Level 2:**
1. Confirm the entities exist: `window.cellApp.environment.seedMolecules.size > 0`.
2. Check `_renderProteinLevel()` / `_renderMoleculeLevel()`: list every collection the renderer iterates. Compare against all `Map`s in `Environment`.
3. Check the free-atom loop condition. Atoms with `moleculeId` set are skipped by `if (!atom.moleculeId)`. If a new collection sets `moleculeId` on its atoms (as `seedMolecules` does), they will be invisible via both the molecule path and the free-atom path — a double-skip.

**General pattern:** Follow data from source to display in a straight line. At each step, ask: does this step know about all collections that could contain the relevant data? The first step that answers "no" is the bug location.
