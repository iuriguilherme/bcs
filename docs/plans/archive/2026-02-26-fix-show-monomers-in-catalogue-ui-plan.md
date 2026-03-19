---
title: "fix: Show Monomers in Catalogue UI"
type: fix
status: shipped
date: 2026-02-26
origin: docs/brainstorms/2026-02-26-essential-monomer-seeding-brainstorm.md
---

# fix: Show Monomers in Catalogue UI

## Overview

All 4 biological monomers (Glycine, Fatty Acid, Glucose, Adenine Nucleotide) are
pre-loaded into `catalogue.molecules` at startup by `Catalogue._loadMonomerBlueprints()`.
However, `catalogue-ui.js:116` filters with `isBlueprintStable(bp)`, which returns
`false` for every monomer because they intentionally carry free valence (required for
polymerization). This silently hides all monomers — users cannot see or place them,
making DNA strand polymer assembly and therefore cell formation impossible.

Research also confirmed that **Phosphorus (P) is already available in the spawner UI**
(`main.js:795`). Users can already toggle P on in the spawner modal — no spawner change
is needed.

## Problem Statement

- `catalogue-ui.js:116`: `allBlueprints.filter(bp => isBlueprintStable(bp))` uses a
  stability check that excludes any molecule with unfilled valence — including all monomers
- Adenine Nucleotide (`C10H14N5O6P`) never appears in the catalogue, so polymer
  intentions for DNA strand cannot find any monomers to attract
- The `isMonomer: true` flag is set correctly by `createMonomerBlueprint()` at
  `monomer-templates.js:377` — the data layer is already complete; only the UI filter
  is wrong
- `autoDiscover()` in `catalogue.js` currently runs `isStable()` (O(atoms)) before the
  `hasMolecule()` (O(1)) check. Reordering them is a minor correctness/performance
  improvement that runs every 60 ticks.

## Proposed Solution

Two changes across two files — no upstream changes required.

### Change 1 — `src/viewer/catalogue-ui.js` (main fix)

1. **Line 116 filter**: `isBlueprintStable(bp) || bp.isMonomer`
2. **`_renderItem()` status div**: show a "Monomer" badge when `bp.isMonomer` is true
   instead of the `!` glyph
3. **Injected CSS**: add `.monomer-badge` styles

### Change 2 — `src/catalogue/catalogue.js` (optimization)

Reorder the conditions in `autoDiscover()` so `this.molecules.has()` (O(1)) runs before
`molecule.isStable()` (O(atoms)). Already-registered molecules skip the stability check
entirely. Runs every 60 ticks.

## Files to Change

| File | Location | Change |
|------|----------|--------|
| `src/viewer/catalogue-ui.js` | Line 116 | Expand filter to include monomers |
| `src/viewer/catalogue-ui.js` | `_renderItem()` | Monomer badge in status div |
| `src/viewer/catalogue-ui.js` | Injected styles block | `.monomer-badge` CSS |
| `src/catalogue/catalogue.js` | `autoDiscover()` | Reorder: `molecules.has()` before `isStable()` |

**Not changing**: `atom-spawner.js`, `main.js`, `monomer-templates.js`,
`catalogue.js:_loadMonomerBlueprints()` — all already correct.

## Technical Considerations

- **Filter change is purely additive**: `||` only adds monomers to the display; existing
  stable molecules are unaffected.
- **`isMonomer` flag is already set**: No upstream changes. `createMonomerBlueprint()`
  at `monomer-templates.js:377` already sets `isMonomer: true` on every blueprint object.
- **Injected vs. `index.css`**: All `.catalogue-item` styles live in the injected
  `<style>` block at the bottom of `catalogue-ui.js`, not in `index.css`. The new
  `.monomer-badge` CSS belongs there too for consistency.
- **Fingerprint format mismatch resolved**: Blueprint fingerprints (from
  `createMonomerBlueprint()`) use the format `'monomer:id:formula'`
  (`monomer-templates.js:361`). Live molecule fingerprints (from
  `molecule.calculateFingerprint()`) use a JSON atom/bond-count string. They never match,
  so `knownFingerprints.has(molecule.fingerprint)` would be a no-op. The correct
  optimization is to put `this.molecules.has()` before `isStable()` in `autoDiscover()`,
  eliminating the O(atoms) stability check for already-registered molecules.
- **Search compatibility**: `catalogue.search()` queries `this.molecules` Map (which
  already contains monomers), so search by name/formula will work for monomers without
  any additional changes.
- **`blueprint.isStable` on monomers**: Monomers have `isStable: false` by default (free
  valence). The current `_renderItem()` shows `!` for any non-stable blueprint. After the
  fix, monomers get a "Monomer" badge instead, which is more informative.

## System-Wide Impact

- **Interaction graph**: User clicks monomer in catalogue → `controls.js` sets
  `selectedBlueprint` → user clicks canvas → `controls.js` calls
  `blueprint.instantiate(x, y)` → creates Atom objects directly (no spawner) → atoms
  bond via `Environment.update()` → `updateMolecules()` groups them → molecule gains
  `isMonomer: true` from `findMonomerByFormula()` → polymer intention can now attract it.
- **`autoDiscover()` reorder**: Called every 60 ticks from `main.js:64`. After the
  reorder, `molecules.has()` runs first — already-registered molecules skip `isStable()`
  entirely. No functional behaviour change.
- **No state lifecycle risk**: `instantiate()` creates brand-new atoms/bonds each time; no
  shared mutable state between blueprint and placed molecule.

## Acceptance Criteria

- [x] Glycine, Fatty Acid, Glucose, Adenine Nucleotide all appear in the Molecules
      section of the catalogue UI on a fresh simulation start
- [x] Each monomer card displays a "Monomer" badge (not the `!` glyph) in its status area
- [x] Selecting a monomer blueprint and clicking the canvas places it as a molecule
      (same flow as stable molecules)
- [x] Placed Adenine Nucleotide molecules have `isMonomer: true` in the environment and
      can be attracted by a DNA strand polymer intention
- [x] Stable molecules (H₂, H₂O, CH₄ etc.) continue to appear correctly with `✓` status
- [x] `autoDiscover()` conditions are reordered: `molecules.has()` check comes before
      `isStable()`, skipping the O(atoms) call for already-registered molecules
- [x] **End-to-end cell formation**: placing overlapping intentions (cell + its required
      polymer intents + each polymer's monomer molecule intents) and activating the atom
      spawner (with P enabled) results in a cell being formed autonomously

## Implementation Code Sketches

### catalogue-ui.js — Line 116 filter

```javascript
// Before
const blueprints = allBlueprints.filter(bp => isBlueprintStable(bp));

// After
const blueprints = allBlueprints.filter(bp => isBlueprintStable(bp) || bp.isMonomer);
```

### catalogue-ui.js — _renderItem() status div

```javascript
// Before
<div class="catalogue-item-status">
    ${blueprint.isStable ? '&#10003;' : '!'}
</div>

// After
<div class="catalogue-item-status">
    ${blueprint.isMonomer
        ? '<span class="monomer-badge">Monomer</span>'
        : blueprint.isStable ? '&#10003;' : '!'}
</div>
```

### catalogue-ui.js — injected CSS (add to existing block)

```css
.monomer-badge {
    font-size: 0.6rem;
    font-weight: 700;
    color: var(--success);
    background: color-mix(in srgb, var(--success) 12%, transparent);
    padding: 2px 5px;
    border-radius: 8px;
    border: 1px solid var(--success);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
}
```

### catalogue.js — autoDiscover() reorder (O(1) check before O(atoms) check)

Blueprint fingerprints (`'monomer:id:formula'`) and live molecule fingerprints (JSON
atom/bond counts) use different formats, so `knownFingerprints` cannot be used here.
Instead, reorder the existing conditions so the cheap Map lookup gates the expensive
`isStable()` call:

```javascript
// Before
autoDiscover(molecules) {
    if (!this.autoRegisterStable) return;
    for (const molecule of molecules) {
        if (molecule.isStable() && !this.hasMolecule(molecule.fingerprint)) {
            this.registerMolecule(molecule);
        }
    }
}

// After — O(1) Map check before O(atoms) isStable() call
autoDiscover(molecules) {
    if (!this.autoRegisterStable) return;
    for (const molecule of molecules) {
        if (this.molecules.has(molecule.fingerprint)) continue; // already registered
        if (molecule.isStable()) {
            this.registerMolecule(molecule);
        }
    }
}
```

## Post-Implementation Manual Testing

### Smoke Tests (quick)

1. Open `dev.html` in browser
2. **Catalogue panel**: confirm Glycine, Fatty Acid, Glucose, Adenine Nucleotide appear
   under Molecules with the "Monomer" badge
3. **Stable molecules**: H₂, H₂O, O₂ still show `✓` and no Monomer badge
4. **Placement**: select Adenine Nucleotide → click canvas → molecule appears in world;
   inspect `[...window.cellApp.environment.molecules.values()].at(-1).isMonomer` in
   console — must be `true` (set by `findMonomerByFormula()` matching `C10H14N5O6P`)
5. **Search**: type "glycine" in catalogue search → Glycine monomer appears in results
6. **Console**: `Loaded 5 monomer blueprints` still fires on startup (unchanged)

### End-to-End Cell Formation Test (integration)

This test validates the full pipeline from atoms → monomers → polymers → cell, using
MINIMAL_CELL (simplest cell requiring 1x PHOSPHOLIPID + 1x DNA_STRAND).

**Spawner setup:**
- Open the spawner modal → enable P in the atom pool (alongside H, C, N, O)
- Set zone to cover the canvas centre (large zone)
- Activate the spawner

**Intention placement (overlapping, centre of canvas):**
1. Place **1× MINIMAL_CELL intention** at canvas centre
2. Place **1× DNA_STRAND polymer intention** overlapping the cell intent
3. Place **1× PHOSPHOLIPID polymer intention** overlapping the cell intent
4. Place **4× Adenine Nucleotide molecule intentions** overlapping the DNA_STRAND intent
   (DNA_STRAND `minMonomers: 4` in `polymer-blueprints.js:74`)
5. Place **3× Fatty Acid molecule intentions** overlapping the PHOSPHOLIPID intent
   (PHOSPHOLIPID `minMonomers: 3` in `polymer-blueprints.js:18`)

**Run & validate:**
- Let the simulation run (several hundred ticks)
- **Success**: a MINIMAL_CELL entity appears in the environment
- **Check console** for: `"Cell formed"` or equivalent log from cell-blueprints assembly
- **Check console** for no errors about missing monomers

**Failure modes to watch for:**
- Monomer intentions not attracting atoms → check spawner has correct atoms in pool
- Polymer intention not finding monomers → inspect `mol.isMonomer` on placed molecules
  via `window.cellApp.environment.molecules`
- Cell not forming even with polymers present → check cell blueprint requirements match

### Build verification

```
deno run --allow-read --allow-write --allow-run build.ts
```

## Dependencies & Risks

- **Low risk**: both changes are additive and isolated. The filter expansion cannot remove
  existing molecules from the display. The `autoDiscover()` reorder preserves identical
  functional behaviour — only evaluation order changes.
- **Fingerprint format confirmed different**: `knownFingerprints` stores
  `'monomer:id:formula'` strings; live molecules use JSON atom/bond-count fingerprints.
  The optimization in `autoDiscover()` therefore uses `this.molecules.has()` directly —
  same fingerprint space, correct behaviour.
- **CSS variable `--success`**: used in badge; confirm it is defined in the existing theme
  (it is used in `.atom-pool-btn.selected` styles at `index.css:857`).

## Sources & References

### Origin

- **Brainstorm**: [docs/brainstorms/2026-02-26-essential-monomer-seeding-brainstorm.md](docs/brainstorms/2026-02-26-essential-monomer-seeding-brainstorm.md)
  Key decisions carried forward:
  1. Monomers mixed into Molecules section (not a separate section)
  2. Filter: `isBlueprintStable(bp) || bp.isMonomer` (see brainstorm: Key Decisions)
  3. "Monomer" visual badge — distinguishes type, not seeding source
  4. `autoDiscover()` optimization: reorder to put `molecules.has()` before `isStable()` (brainstorm specified `knownFingerprints` but fingerprint formats differ — corrected during document review)
  5. P spawning: already available in UI, no change needed (research confirmed)

### Internal References

- `src/viewer/catalogue-ui.js:116` — line to change
- `src/viewer/catalogue-ui.js:195` — `_renderItem()` to update
- `src/catalogue/monomer-templates.js:377` — `isMonomer: true` already set
- `src/catalogue/catalogue.js:49` — `_loadMonomerBlueprints()` already correct
- `src/catalogue/catalogue.js:467` — `autoDiscover()` to reorder conditions
- `src/main.js:795` — confirms P already in spawner `availableAtoms`
- `index.css:857` — confirms `--success` CSS variable is available
