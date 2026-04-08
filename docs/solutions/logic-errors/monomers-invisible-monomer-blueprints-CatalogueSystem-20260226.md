---
title: Monomers Invisible in Catalogue UI — Monomer Blueprint System Overhaul
date: 2026-02-26
problem_type: logic-errors
severity: critical
component: catalogue system
tags:
  - catalogue-ui
  - indexeddb-persistence
  - formula-matching
  - monomer-blueprints
  - xss
  - agent-native
  - code-deduplication
related_solutions:
  - docs/solutions/logic-errors/molecule-intent-stuck-reshaping-IntentionSystem-20260225.md
---

# Monomers Invisible in Catalogue UI — Monomer Blueprint System Overhaul

## Problem Symptom

Pre-defined monomer blueprints (ETHYLENE, GLYCINE, ADENINE_NUCLEOTIDE, etc.) were silently absent from the Catalogue UI's Molecules tab despite being loaded into memory at startup. The Catalogue panel showed only auto-discovered stable molecules; no monomer cards appeared. No errors were thrown — the blueprints simply never rendered.

Additionally, when a monomer was selected in the inspector, it incorrectly displayed "✓ Stable Configuration" instead of a monomer-appropriate label, because the inspection code did not distinguish monomers from regular stable molecules.

## Root Cause Analysis

Three independent bugs converged to make monomers invisible:

### Bug 1: `_cleanupCatalogue()` silently evicted monomers (Critical)

`Catalogue._cleanupCatalogue()` runs after IndexedDB loads. It has an isMonomer guard:

```javascript
// BEFORE (buggy)
if (blueprint.isMonomer) {
    seenFormulas.set(blueprint.formula, fingerprint);  // ← latent bug
    continue;
}
```

The `seenFormulas.set()` call inside the guard populated the deduplication map with the monomer's formula. Later, when `autoDiscover()` registered a fully-stable molecule with the same formula (e.g. a molecule that happened to match `C2H4`), the dedup logic would find the formula already in `seenFormulas` and mark it as a **duplicate** — ultimately calling `_deleteMoleculeFromDB()` on the monomer. This silently evicted the monomer from both the in-memory map and IndexedDB on next load.

### Bug 2: Formula mismatch for ADENINE_NUCLEOTIDE (Critical)

`stable-molecules.js` had an entry keyed as `'C10H14N5O6P'` (24 atoms) matching the old formula in `monomer-templates.js`. But the actual `atomLayout` in `monomer-templates.js` produced 20 atoms with formula `'C6H5N3O5P'`. The `applyStableConfiguration()` method uses the atom layout to compute the real formula and then looks it up in `stable-molecules.js` — finding nothing, it never applied `isMonomer: true` to the live molecule, so the monomer was never properly flagged.

### Bug 3: Inspector showed wrong label for monomers (Minor)

`catalogue-ui.js`'s `_showBlueprintInspector()` used `isBlueprintStable(bp)` to decide what to show. Since monomers intentionally have free valence, `isBlueprintStable()` returned `false` for them — so the code showed neither "Stable Configuration" nor a monomer label. The display was simply wrong.

## Investigation Steps Tried

1. Added `Debug.enable('catalogue')` — confirmed monomers loaded at startup but disappeared after IndexedDB cycle.
2. Inspected `_cleanupCatalogue()` — found `seenFormulas.set()` inside isMonomer guard. Removed it.
3. Checked `ADENINE_NUCLEOTIDE` template atom count — found 20 atoms producing `C6H5N3O5P`, but `stable-molecules.js` had `C10H14N5O6P`. Added correct key, stripped orphan entry.
4. Traced `applyStableConfiguration()` → `_detectMonomerType()` call — confirmed it was not being called after `isMonomer = true` assignment.

## Working Solution

### Fix 1: Remove `seenFormulas.set()` from isMonomer guard

**File:** `src/catalogue/catalogue.js`

```javascript
// BEFORE
if (blueprint.isMonomer) {
    seenFormulas.set(blueprint.formula, fingerprint);
    continue;
}

// AFTER
if (blueprint.isMonomer) {
    continue;  // Monomers are never duplicates of stable molecules
}
```

**Why:** The isMonomer guard's purpose is to skip the entire deduplication logic for monomers. Adding the formula to `seenFormulas` defeated this by still participating in the dedup pass from the other side.

### Fix 2: Add missing `'C6H5N3O5P'` key to `stable-molecules.js`

**File:** `src/data/stable-molecules.js`

Added a new entry keyed `'C6H5N3O5P'` containing the 20-atom ADENINE_NUCLEOTIDE layout with `isMonomer: true` and `polymerName: 'Nucleic Acid'`. Removed `isMonomer`/`polymerName` from the orphaned `'C10H14N5O6P'` entry (which is now treated as a plain stable configuration if it appears).

### Fix 3: Call `_detectMonomerType()` after `isMonomer = true`

**File:** `src/entities/molecule.js`, `applyStableConfiguration()`

```javascript
// AFTER setting isMonomer = true, immediately:
this._detectMonomerType();
```

This ensures `monomerId` and `monomerTemplate` are populated in the same tick that `isMonomer` is set, keeping the three-part monomer invariant (`isMonomer && monomerId !== null && monomerTemplate !== null`) intact.

### Fix 4: Inspector monomer label

**File:** `src/viewer/catalogue-ui.js`, `_showBlueprintInspector()`

```javascript
// BEFORE
if (isBlueprintStable(bp)) {
    html += `<div class="stable-badge">✓ Stable Configuration</div>`;
}

// AFTER
if (bp.isMonomer) {
    html += `<div class="monomer-badge">🔗 Monomer (polymerizable)</div>`;
} else if (MoleculeBlueprint.isBlueprintStable(bp)) {
    html += `<div class="stable-badge">✓ Stable Configuration</div>`;
}
```

### Additional Fixes (same PR)

- **XSS prevention** (`catalogue-ui.js`, `controls.js`): Added `escHtml(str)` helper; wrapped all `blueprint.name` and `blueprint.formula` injected into `innerHTML`.
- **Valence logic deduplication** (`blueprint.js`, `catalogue.js`, `catalogue-ui.js`): Extracted canonical `MoleculeBlueprint.isBlueprintStable(bp)` static method; `_isBlueprintValid()` and the standalone `isBlueprintStable()` function in `catalogue-ui.js` both delegate to it.
- **Agent-native API** (`main.js`): Added `App.placeMonomerIntention(monomerId, x, y)` — a single named call for placing a monomer intention, enabling agents to place monomers without knowing UI internals.
- **`Atom.isPhysicsIsolated` getter** (`atom.js`): `get isPhysicsIsolated() { return !!this.claimedByIntentId; }` — decouples the physics loop from the intention claim check, making future refactors safer.
- **`window.catalogue` dead fallback** (`environment.js`): Replaced `window.catalogue` with `window.cellApp?.catalogue || null` to match actual app structure.
- **`tryFormBonds` hotspot** (`environment.js`): Hoisted `getIntentionForAtom(atom1)` outside inner loop — O(n) → O(1) per outer iteration.
- **Dead methods removed** (`environment.js`): `isAtomRelevantToIntention` and `getAtomBondingPriority` (never called) deleted.

## The Monomer Invariant

Three fields must always be set together on any `Molecule` instance that is a monomer:

```
molecule.isMonomer    === true
molecule.monomerId    !== null   (e.g. 'ETHYLENE')
molecule.monomerTemplate !== null  (pointer to template object)
```

Any code path that sets `isMonomer = true` must immediately call `this._detectMonomerType()` to populate the other two fields. Never set `isMonomer` in isolation.

For `MoleculeBlueprint` objects (catalogue entries), `blueprint.isMonomer` guards must skip **all** deduplication logic — including `seenFormulas` tracking — to prevent auto-discovered stable molecules from evicting monomers.

## Prevention Strategies

### Code Patterns

**Always call `_detectMonomerType()` after setting `isMonomer`:**
```javascript
// ✅ Correct
this.isMonomer = true;
this._detectMonomerType();

// ❌ Wrong — leaves monomerId / monomerTemplate null
this.isMonomer = true;
```

**Monomer guard must be a hard skip — no side effects:**
```javascript
// ✅ Correct
if (blueprint.isMonomer) {
    continue;
}

// ❌ Wrong — seenFormulas.set() inside guard participates in dedup
if (blueprint.isMonomer) {
    seenFormulas.set(blueprint.formula, fingerprint);
    continue;
}
```

**Always use `escHtml()` before injecting names/formulas:**
```javascript
const escHtml = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
el.innerHTML = `<b>${escHtml(blueprint.name)}</b> — ${escHtml(blueprint.formula)}`;
```

**Use canonical `MoleculeBlueprint.isBlueprintStable()` — never duplicate the valence logic:**
```javascript
// ✅ Correct — single source of truth
return MoleculeBlueprint.isBlueprintStable(bp);

// ❌ Wrong — duplicating valence iteration creates divergence risk
for (const atom of bp.atomData) { /* ... */ }
```

### Checklist for Adding a New Monomer

When adding a new monomer template to `monomer-templates.js`:

1. **Count atoms** in `atomLayout` — derive the actual formula manually or by inspection.
2. **Add an entry in `stable-molecules.js`** keyed by that formula with `isMonomer: true` and `polymerName`.
3. **Verify** that `TEMPLATE.formula` in `monomer-templates.js` matches the key used in `stable-molecules.js`.
4. **Test** that `applyStableConfiguration()` fires and sets `molecule.isMonomer === true` on live molecules.
5. **Test** that the monomer blueprint appears in the Catalogue UI Molecules tab after a full IndexedDB cycle (clear DB, reload, verify).

### Checklist for Editing `_cleanupCatalogue()`

- The isMonomer guard (`if (blueprint.isMonomer) continue;`) must remain a **pure skip** — no data modifications inside the guard block.
- Any new deduplication axis (name, fingerprint prefix, etc.) must also check `blueprint.isMonomer` before acting.
- After editing, run a full cycle: load → discover stable molecules → reload from IndexedDB → confirm monomers still present.

### Architecture Rules

1. **Monomer blueprints live in the molecules map** but use fingerprint format `'monomer:id:formula'` — never treat them as regular stable-molecule entries.
2. **`stable-molecules.js` is the source-of-truth** for formula → atom layout mapping. If a monomer template produces a different formula than expected, the key in `stable-molecules.js` must match what the layout actually produces — not what you think it should produce.
3. **Valence logic has one home**: `MoleculeBlueprint.isBlueprintStable()`. Never inline it elsewhere.
4. **Agent-native parity**: any spawning action available via UI must have a named method on `App` (e.g. `placeMonomerIntention`). Agents must not be required to know UI internals.

## Debugging Tips

| Symptom | Likely Cause | Diagnosis |
|---------|-------------|-----------|
| Monomers present on first load, disappear after second load | `seenFormulas.set()` inside isMonomer guard causing eviction via `_deleteMoleculeFromDB()` | Add `console.log` in `_deleteMoleculeFromDB()` and watch for monomer fingerprints |
| Monomer molecules never get `isMonomer = true` set | `stable-molecules.js` missing the key for the actual formula produced by `atomLayout` | Log `molecule.formula` in `applyStableConfiguration()` and compare to `stable-molecules.js` keys |
| Inspector shows "Stable Configuration" for a monomer | Inspector uses only `isBlueprintStable()` without checking `bp.isMonomer` first | Add `if (bp.isMonomer)` branch before stable-molecule branch in inspector render |

## Related Resources

- **Related solution** (intention system): [`docs/solutions/logic-errors/molecule-intent-stuck-reshaping-IntentionSystem-20260225.md`](molecule-intent-stuck-reshaping-IntentionSystem-20260225.md)
- **Implementation plan**: [`docs/plans/2026-02-26-fix-show-monomers-in-catalogue-ui-plan.md`](../../plans/2026-02-26-fix-show-monomers-in-catalogue-ui-plan.md)
- **Files modified**: `src/catalogue/catalogue.js`, `src/catalogue/blueprint.js`, `src/data/stable-molecules.js`, `src/entities/molecule.js`, `src/entities/atom.js`, `src/core/environment.js`, `src/entities/intention.js`, `src/viewer/catalogue-ui.js`, `src/viewer/controls.js`, `src/main.js`
