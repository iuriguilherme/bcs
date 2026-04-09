---
title: "fix: Intention display bugs — inspector Gathered counter and Level 2 atom visibility"
type: fix
status: completed
date: 2026-02-27
origin: docs/brainstorms/2026-02-27-intention-display-bugs-brainstorm.md
---

# fix: Intention display bugs — inspector Gathered counter and Level 2 atom visibility

## Enhancement Summary

**Deepened on:** 2026-02-27
**Research agents used:** architecture-strategist, code-simplicity-reviewer, julik-frontend-races-reviewer, performance-oracle, pattern-recognition-specialist, best-practices-researcher

### Key Improvements Found During Deepening

1. **Accessor contract**: `environment.seedMolecules` must never be accessed directly from the viewer — add `getAllSeedMolecules()` to `Environment` following the existing `getAllMolecules()` pattern
2. **Gathered count belongs on Intention**: The inline ternary in the HTML template violates the `requirements.type` dispatch pattern — add `intention.getGatheredCount()` method
3. **Click detection gap**: `getEntityAt()` (hit-testing) also skips seed molecules — clicking a seed assembly gives no selection. Fix alongside the render fix.
4. **`_renderProteinLevel()` has the same gap**: Seed atoms are also invisible at that level — fix both render methods
5. **Real pre-existing bug**: `setTimeout` canvas preview callbacks lack a null-check — element may be replaced before callback fires
6. **Simplicity option**: Bug 2 can be fixed with a one-condition change to the existing atom loop instead of a new loop
7. **Playwright**: Use `expect.poll` over `waitForFunction`; test DOM/JS state, not canvas pixels

---

## Overview

Two display bugs affect molecule-type Intentions:

1. **Bug 1** — Inspector shows `Gathered: 0/14` while the canvas label correctly shows `14/14 atoms`. The canvas is right; the inspector reads from the wrong data source (`gatheredComponents.size` which is always 0 for molecule intents).
2. **Bug 2** — Atoms being assembled by a molecule intent are invisible at Level 2 (molecule view). The seed molecule lives in `environment.seedMolecules` — a separate collection that `_renderMoleculeLevel()` never iterates.

Both bugs are display-only. No physics or entity logic changes needed.

---

## Problem Statement

### Bug 1: Inspector `gatheredComponents.size` is always 0 for molecule intents

The inspector (`src/viewer/controls.js:767`) renders:
```javascript
<p>Gathered: ${intention.gatheredComponents.size} / ${reqCount}</p>
```

For `type='molecule'` intentions, `gatheredComponents` is rebuilt each frame inside `_attractComponents()` — but `_attractComponents()` is **never called** for molecule intents. The 7-rule molecule pipeline calls `_updateProgress(state)` instead, which correctly sets `this.progress` from `(seedAtoms + claimedAtoms) / totalNeeded`. So `progress` is correct (1.0 = 100%) while `gatheredComponents.size` stays perpetually at 0.

The canvas already displays the correct value using `Math.round(intention.progress * totalNeeded)`.

**Pattern note**: The inspector dispatches on `requirements.type` (atoms/monomers/molecules/polymers) for its main content, not on `intention.type`. An inline ternary on `intention.type` in the template would be inconsistent with this pattern. The type-specific logic belongs on `Intention` itself as `getGatheredCount()`.

### Bug 2: Seed molecules are in a separate collection, invisible at Level 2

`_renderMoleculeLevel()` in `src/viewer/viewer.js:298-319` only iterates `environment.getAllMolecules()`, which returns `environment.molecules`. Seed molecules live in **`environment.seedMolecules`** — a completely separate `Map`. When a molecule intention reaches progress=100%, all its atoms are bonded into the seed molecule (`atom.moleculeId = seedMol.id`, `seedMol` stored in `environment.seedMolecules`). At Level 2:
- `getAllMolecules()` skips seed molecules → no `renderSimplified()` call
- The free-atom loop condition `if (!atom.moleculeId)` skips seed atoms (they have `moleculeId = seedMol.id`)

Result: the entire assembly disappears from view when switching to Level 2.

**Same gap exists in `_renderProteinLevel()`** — seed atoms are also invisible at that level.

**Same gap exists in `getEntityAt()`** — seed assemblies cannot be clicked/selected by the user.

**Architectural note**: This corrects the brainstorm's assumption. The brainstorm proposed adding `molecule.intentionId` to the `Molecule` class, but `Molecule` already has `isSeedFor` and the seed molecules already live in a dedicated collection. No new field is needed.

---

## Proposed Solution

### Fix 0 — Add `getAllSeedMolecules()` to `Environment` (prerequisite)

**File**: `src/core/environment.js`, alongside `getAllMolecules()` (~line 904)

```javascript
getAllSeedMolecules() {
    return Array.from(this.seedMolecules.values());
}
```

This follows the exact pattern of every other collection accessor in the file (`getAllAtoms()`, `getAllBonds()`, `getAllMolecules()`, `getAllProteins()`, `getAllIntentions()`). The viewer never accesses internal Maps directly — it uses the accessor layer. This is a zero-risk, zero-behaviour-change prerequisite.

### Fix 1 — Add `getGatheredCount()` to `Intention`

**File**: `src/entities/intention.js`

```javascript
getGatheredCount() {
    if (this.type === 'molecule') {
        const requirements = this.getRequirements();
        const reqCount = requirements?.count || 0;
        return Math.round(this.progress * reqCount);
    }
    return this.gatheredComponents.size;
}
```

Then in `controls.js` line 767, change:
```javascript
// Before:
<p>Gathered: ${intention.gatheredComponents.size} / ${reqCount}</p>

// After:
<p>Gathered: ${intention.getGatheredCount()} / ${reqCount}</p>
```

**Why a method, not an inline ternary?** The inspector dispatches on `requirements.type`, not `intention.type`. Placing a type branch in the HTML template is inconsistent with this pattern and duplicates logic that already lives in `intention.js`. If a new intention type is added, only the method needs updating — not every call site.

### Fix 2 — Render seed molecule atoms in `_renderMoleculeLevel()` and `_renderProteinLevel()`

**File**: `src/viewer/viewer.js`

**Option A (recommended — accessor pattern, defensive snapshot):**

Extract a private helper method:

```javascript
_renderSeedMoleculeAtoms(scale, offset) {
    if (!this.environment.getAllSeedMolecules) {
        console.warn('[Viewer] getAllSeedMolecules not available; seed atoms will not render');
        return;
    }
    const seedMolecules = this.environment.getAllSeedMolecules();
    if (seedMolecules.length === 0) return; // skip if no active assemblies
    for (const seedMol of seedMolecules) {
        const atoms = seedMol.atoms.slice(); // snapshot — prevent future mutation issues
        for (const atom of atoms) {
            atom.render(this.ctx, scale, offset);
        }
    }
}
```

Call it in both `_renderMoleculeLevel()` (after molecules, before free atoms) and `_renderProteinLevel()` (at the end, after free atoms).

**Option B (simpler — one condition change):**

Instead of a new loop, change the existing free-atom condition in `_renderMoleculeLevel()`:

```javascript
// Before:
if (!atom.moleculeId) {

// After:
if (!atom.moleculeId || this.environment.seedMolecules.has(atom.moleculeId)) {
```

Option B is the minimal correct change but accesses `seedMolecules` directly (violating the accessor contract) and doesn't fix `_renderProteinLevel()`. **Prefer Option A.**

### Fix 3 — Fix `getEntityAt()` click-testing to include seed molecules

**File**: `src/viewer/viewer.js`, `getEntityAt()` (~line 554)

Seed molecules are also `Molecule` instances (confirmed: `new Molecule([atom, other])` in `intention.js:747`), so `containsPoint()` is available on them. After the existing `getAllMolecules()` hit-test loop at Level ≥ 1, add:

```javascript
// After the existing molecule hit-test loop (~line 560):
const seedMolecules = this.environment.getAllSeedMolecules
    ? this.environment.getAllSeedMolecules()
    : [];
for (const seedMol of seedMolecules) {
    if (seedMol.containsPoint(screenX, screenY, scale, offset)) {
        return { type: 'molecule', entity: seedMol };
    }
}
```

Without this fix, seed assemblies are visually rendered but not selectable — users cannot inspect them in the inspector panel.

### Fix 4 — `setTimeout` canvas preview null-guard (already implemented — no action)

**Note**: Code review confirmed this guard **already exists** inside `_renderMoleculePreview()` and `_renderBlueprintPreview()` — both methods begin with `const canvas = document.getElementById(canvasId); if (!canvas) return;`. The protection is functionally identical to an in-callback guard. No changes needed here.

⚠️ Do NOT add a second `document.getElementById` call inside the `setTimeout` callback — `_renderMoleculePreview` expects a `canvasId` string, not a DOM element. Passing an element would silently break all molecule previews.

---

## Technical Considerations

### Why not unify `gatheredComponents` for molecule intents?

The cleaner architectural fix would be to populate `gatheredComponents` inside `_updateProgress()` for molecule intents (mirroring the polymer/cell path). However, this touches entity logic in `intention.js` and is a larger change. The `getGatheredCount()` method is a clean façade that defers this refactor safely. Add a TODO comment on the `gatheredComponents` declaration:

```javascript
// TODO: gatheredComponents is only populated for type='polymer'/'cell'.
// For type='molecule', use getGatheredCount() which reads from this.progress instead.
this.gatheredComponents = new Set();
```

### Race conditions

JavaScript is single-threaded. The simulation update loop runs fully (`environment.update()`) before `render()` is called. Specifically:

- All `seedMolecules` writes (`set`, `delete`) happen in `updateIntentions()` inside the tick phase
- The render phase reads `seedMolecules` only after all ticks complete
- Seed-to-normal molecule promotion (`_completeSeedMolecule`) is atomic within the tick phase — the promoted molecule is already in `molecules` (and removed from `seedMolecules`) before render fires

No race conditions from the proposed changes. The existing `setTimeout` race for canvas previews is the only real concurrent issue (Fix 4 above).

### Performance

Adding seed molecule rendering is low-cost:
- `getAllSeedMolecules()` returns a typically small array (1-5 entries × 2-14 atoms each)
- `atom.render()` uses `createRadialGradient` per atom — fine for current scale (~50-200 total atoms)
- The `seedMolecules.length === 0` early-return guard in `_renderSeedMoleculeAtoms()` eliminates all overhead when no intentions are active

**Note for future scale**: If atom counts exceed ~300, `createRadialGradient` calls become the primary canvas bottleneck. A gradient cache keyed by `${symbol}_${Math.round(screenRadius)}` would help, but that optimization is out of scope here.

### Claimed-but-free atoms are already handled

Atoms with `claimedByIntentId !== null` but no `moleculeId` (claimed but not yet bonded into the seed) already render at Level 2 via the existing `if (!atom.moleculeId)` check. These atoms do NOT have `moleculeId` set, so they pass through correctly. No change needed.

### Double-render is not a risk

Seed molecules are never in `environment.getAllMolecules()` (separate collection). The proposed fix adds a new rendering pass from `getAllSeedMolecules()`. There is no overlap.

### Serialization / mid-assembly persistence

`environment.serialize()` may not currently serialize `environment.seedMolecules`. Simulation saved mid-assembly would lose the in-progress seed on reload. This is pre-existing behavior, out of scope here — track as a follow-up.

---

## System-Wide Impact

- **Interaction graph**: All fixes are read-only display changes except the `getGatheredCount()` method addition (entity logic, no side effects) and the `getAllSeedMolecules()` accessor (infrastructure, no side effects).
- **Error propagation**: The `setTimeout` null-guard prevents silent TypeErrors in the inspector preview path.
- **State lifecycle risks**: None — we're reading existing collections, not modifying them.
- **API surface parity**: Canvas intention label already uses `Math.round(progress * totalNeeded)` — no change needed there. Inspector now matches via `getGatheredCount()`.
- **Polymer/cell intents**: Unaffected. `getGatheredCount()` falls through to `gatheredComponents.size` for non-molecule types.
- **Level 3+ rendering**: `_renderCellLevel()` intentionally excluded from the seed molecule atom rendering — at that level, seed assemblies are visual noise and `_renderIntentions()` already suppresses molecule intent zones above level 1.

---

## Acceptance Criteria

- [x] Inspector "Gathered" shows the correct count (e.g. `14 / 14`, not `0 / 14`) when atoms have been claimed/assembled by a molecule intent
- [x] Inspector "Gathered", "Progress %", and canvas atom count all agree for molecule-type intentions
- [x] At Level 2, atoms being assembled by a molecule intent are visible as individual atoms
- [x] Switching between Level 1 and Level 2 does not make the intention zone appear empty mid-assembly
- [x] Clicking on an in-progress seed assembly at Level 2 opens it in the inspector
- [x] Inspector canvas preview does not silently fail when entities are clicked rapidly
- [x] No regression: polymer/cell intents still show correct Gathered count (via `gatheredComponents.size` path in `getGatheredCount()`)
- [x] No regression: completed molecules (not in `seedMolecules`) still render as simplified blobs at Level 2
- [x] Playwright tests pass for both dev.html and index.html

---

## Implementation Steps

### Step 1: Add `getAllSeedMolecules()` to Environment (prerequisite)

**File**: `src/core/environment.js` (~line 904, alongside `getAllMolecules()`)

```javascript
getAllSeedMolecules() {
    return Array.from(this.seedMolecules.values());
}
```

### Step 2: Add `getGatheredCount()` to Intention + Fix inspector

**File**: `src/entities/intention.js` — add method to the class:

```javascript
getGatheredCount() {
    if (this.type === 'molecule') {
        const requirements = this.getRequirements();
        const reqCount = requirements?.count || 0;
        return Math.round(this.progress * reqCount);
    }
    return this.gatheredComponents.size;
}
```

Also add TODO comment on the `gatheredComponents` field declaration.

**File**: `src/viewer/controls.js` (~line 767) — use the new method:

```javascript
<p>Gathered: ${intention.getGatheredCount()} / ${reqCount}</p>
```

### Step 3: Add `_renderSeedMoleculeAtoms()` helper + apply to render methods

**File**: `src/viewer/viewer.js`

Add private helper (place near `_renderMoleculeLevel`):

```javascript
_renderSeedMoleculeAtoms(scale, offset) {
    if (!this.environment.getAllSeedMolecules) return;
    const seedMolecules = this.environment.getAllSeedMolecules();
    if (seedMolecules.length === 0) return;
    for (const seedMol of seedMolecules) {
        const atoms = seedMol.atoms.slice();
        for (const atom of atoms) {
            atom.render(this.ctx, scale, offset);
        }
    }
}
```

In `_renderMoleculeLevel()`, after the `getAllMolecules()` loop, before the free-atom loop:

```javascript
// Render in-progress intention assemblies (seed molecules) as individual atoms
this._renderSeedMoleculeAtoms(scale, offset);
```

In `_renderProteinLevel()`, at the end (after existing free-atom loop):

```javascript
// Render in-progress intention assemblies (seed molecules) as individual atoms
this._renderSeedMoleculeAtoms(scale, offset);
```

### Step 4: Fix `getEntityAt()` to include seed molecules

**File**: `src/viewer/viewer.js`, `getEntityAt()` (~line 554)

After the existing molecule hit-test block at Level ≥ 1, add a parallel check against `getAllSeedMolecules()`. The hit-test logic should mirror what's already done for normal molecules (distance check from click point to molecule centroid).

### Step 5: Add null-guard to `setTimeout` canvas preview callbacks

**File**: `src/viewer/controls.js` (~lines 589, 780)

Add `const canvas = document.getElementById(canvasId); if (!canvas) return;` inside each `setTimeout` callback before the render call.

### Step 6: Rebuild bundle

```bash
deno run --allow-read --allow-write --allow-run build.ts
```

### Step 7: Write Playwright test

Add a test in `tests/scenarios/` (e.g. `t07-intention-display.spec.js`):

**Strategy: test DOM/JS state, not canvas pixels. Use `expect.poll` not `waitForFunction`.**

```javascript
// 1. Start a molecule intent (e.g. H₂O — small, fast to assemble)
// 2. Start simulation via #playPauseBtn, wait for intention to make progress:
await page.click('#playPauseBtn');
await expect.poll(
    () => page.evaluate(() => {
        const intentions = [...window.cellApp.environment.intentions.values()];
        return intentions.length > 0 ? intentions[0].progress : 0;
    }),
    { message: 'Expected intention progress > 0', timeout: 60_000, intervals: [500] }
).toBeGreaterThan(0);

// 3. Bug 1: Assert inspector shows correct Gathered count (not "0 /")
//    Click the intention zone to open it in the inspector, then assert:
await expect(
    page.locator('#inspectorContent p', { hasText: /^Gathered:/ })
).not.toContainText('0 /');
// Also verify Progress and Gathered agree (both > 0):
await expect(
    page.locator('#inspectorContent p', { hasText: /^Progress:/ })
).not.toContainText('0%');

// 4. Bug 2: Switch to Level 2, assert seed molecules still have data to render:
await page.click('[data-level="2"]');
await expect.poll(
    () => page.evaluate(() => window.cellApp.viewer.level),
    { timeout: 2_000 }
).toBe(2);

// Use getAllSeedMolecules() — consistent with the accessor contract Fix 0 establishes:
const seedCount = await page.evaluate(() =>
    window.cellApp.environment.getAllSeedMolecules?.().length ?? 0
);
expect(seedCount).toBeGreaterThan(0);

// 5. Run on both dev.html and index.html
```

Note: per CLAUDE.md testing rules, simulation must run via `#playPauseBtn` click and atoms must come from `AtomSpawner`.

### Step 8: Run full regression suite

```bash
npm test
```

---

## Dependencies & Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `environment.seedMolecules` not yet a public property | Very Low | Confirmed: `environment.seedMolecules.set(...)` called directly from intention.js — it's a public Map |
| Seed molecule atoms rendering at Level 2 may flicker during rapid formation/completion | Low | Seed molecules only grow; atoms added but never removed until completion or deletion; `atoms.slice()` snapshot prevents iteration issues |
| `reqCount` is `'?'` if `getRequirements()` returns null | Low | `getGatheredCount()` uses `requirements?.count \|\| 0` — returns 0 for null requirement, same or better than current NaN |
| `getEntityAt()` hit-test change may select seed molecules unintentionally at wrong levels | Low | Mirror exact level-guard logic from existing molecule hit-test block |
| `_renderProteinLevel()` seed atom rendering may overlap with protein rendering | Very Low | Proteins render first (polymer connections), then molecules, then seed atoms, then free atoms — no overlap |

---

## Sources & References

**Origin brainstorm:** [docs/brainstorms/2026-02-27-intention-display-bugs-brainstorm.md](../brainstorms/2026-02-27-intention-display-bugs-brainstorm.md)

Key decisions carried forward:
- Use entity-side method (`getGatheredCount()`) for Bug 1 — more principled than inspector-side fix
- Render assembling atoms as individual atoms at Level 2 for Bug 2
- *Architectural correction from planning*: `molecule.intentionId` not needed — use `getAllSeedMolecules()` accessor

**Internal references:**
- Inspector display code: `src/viewer/controls.js:637-781`
- Render methods: `src/viewer/viewer.js:298-319` (`_renderMoleculeLevel`), `_renderProteinLevel`
- Hit-test: `src/viewer/viewer.js:554-566` (`getEntityAt`)
- Seed molecule creation: `src/entities/intention.js:746-751`
- Seed molecule growth: `src/entities/intention.js:706-709`
- Molecule constructor (`isSeedFor` field): `src/entities/molecule.js:35`
- Intention fulfillment: `src/entities/intention.js:865-882` (`_completeSeedMolecule`)
- Environment accessors: `src/core/environment.js:~904` (alongside `getAllMolecules`)
- `setTimeout` preview callbacks: `src/viewer/controls.js:589, 780`

**Institutional learnings applied:**
- From `docs/solutions/logic-errors/molecule-intent-stuck-reshaping-IntentionSystem-20260225.md`: Isolate display-only fixes from physics/entity logic
- From `docs/solutions/logic-errors/monomers-invisible-monomer-blueprints-CatalogueSystem-20260226.md`: Use `escHtml()` for blueprint-sourced innerHTML; dead vars already removed from controls.js
- From `docs/solutions/test-failures/playwright-test-infrastructure-audit-8-findings-20260226.md`: Use `expect.poll` over `waitForFunction`; test DOM state not canvas pixels; webServer timeout ≥ 30s

**External references:**
- Playwright `expect.poll` best practice: https://playwright.dev/docs/test-assertions
- Canvas testing without pixel reads: https://www.browserstack.com/guide/playwright-wait-types
