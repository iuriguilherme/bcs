# Brainstorm: Intention Display Bugs (Inspector + Level 2 Visibility)

**Date:** 2026-02-27
**Status:** Ready for planning
**Screenshots:** `docs/screenshots/pr5a.png`, `docs/screenshots/pr5b.png`

---

## What We're Building

Two bug fixes for the molecule-type Intention system:

1. **Bug 1 — Inspector "Gathered" counter stuck at 0**: The inspector shows `Gathered: 0/14` while the canvas label correctly shows `14/14 atoms`. Progress and the canvas are correct; only the inspector's Gathered field is wrong.

2. **Bug 2 — Intention-assembling atoms invisible at Level 2**: Atoms being assembled by a molecule intent (either free/claimed or part of the seed molecule) disappear entirely when switching to the molecule view (Level 2). The user needs a visual cue that an assembly is in progress, since these atoms are in a transitional state between "free atom" and "completed molecule".

---

## Root Causes (Confirmed via Code Analysis)

### Bug 1 Root Cause
- `gatheredComponents` (a Set) is populated only inside `_attractComponents()` (lines 1109–1141 of `intention.js`)
- `_attractComponents()` is **never called** for `type='molecule'` intentions — only for polymer/cell intents
- The 7-rule molecule pipeline calls `_updateProgress(state)` which correctly tracks `progress` via `(seedAtoms + claimedAtoms) / totalNeeded`
- The inspector reads `intention.gatheredComponents.size` → always **0** for molecule intents
- The canvas reads `Math.round(intention.progress * totalNeeded)` → correctly shows **14**
- Three different data sources: `gatheredComponents.size`, `progress`, and `Math.round(progress * totalNeeded)`

### Bug 2 Root Cause
- At Level 2, `_renderMoleculeLevel()` renders:
  - Molecules via `molecule.renderSimplified()` → atoms IN the seed molecule have `moleculeId`, so they follow this path
  - Free atoms via `if (!atom.moleculeId)` → claimed-but-unbonded atoms follow this path
- Neither path produces a visible result within the intention zone: the seed molecule blob is not clearly rendered, and there is no special handling for assembling atoms
- Result: switching to Level 2 makes the intention zone appear empty, hiding the work in progress

---

## What We're NOT Building

- Changes to how `gatheredComponents` is used for polymer/cell intents (working correctly)
- New attraction/repulsion logic (physics unchanged)
- Changes to Level 1 rendering (atom view is correct)

---

## Approach

### Fix 1: Unify the "Gathered" display for molecule intents

**Change**: In `controls.js`, for `type='molecule'` intentions, replace `intention.gatheredComponents.size` with a count derived from `progress`. The inspector already has access to `reqCount` (total atoms needed, calculated from the blueprint). Use `Math.round(intention.progress * reqCount)` to match what the canvas label already displays correctly.

**Decision**: Inspector-side fix — simpler, lower risk, no changes to entity logic. The Key Decisions table captures the architectural alternative.

### Fix 2: Visual cue at Level 2 for assembling atoms

**Approach**: At Level 2, render atoms that belong to an active molecule-intent assembly as individual atoms (same as Level 1). This is consistent with the user's mental model: "these atoms are not yet a molecule."

Implementation requires:
- Add `intentionId = null` field to `Molecule`; set it when the intention assigns its seed molecule, clear it when the intention is fulfilled or deleted; include in `Molecule.serialize()` / `deserialize()`
- At Level 2, additionally render atoms where `atom.claimedByIntentId !== null` (claimed-but-free)
- At Level 2, additionally render atoms where `atom.moleculeId` exists and `environment.molecules.get(atom.moleculeId).intentionId` is set (atoms in seed molecule)
- At Level 2, skip `molecule.renderSimplified()` for molecules where `molecule.intentionId` is set (prevents double-rendering: atoms render individually, not also as a blob)

---

## Key Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Inspector fix approach | Change inspector to use `progress * total` | Minimal, low-risk, no changes to entity logic |
| Level 2 visibility approach | Render assembling atoms as individual atoms at Level 2 | Consistent with user mental model; assembly ≠ complete molecule |
| Seed molecule identification | Add `molecule.intentionId` field | Set when molecule becomes a seed; cleared when intention is fulfilled/deleted. Viewer checks this at render time. |

---

## Open Questions

*(None — resolved during brainstorm)*

---

## Acceptance Criteria

1. Inspector "Gathered" shows `14 / 14` (not `0 / 14`) when 14 atoms have been claimed/assembled
2. Inspector "Gathered", "Progress %", and canvas atom count all agree
3. At Level 2, atoms being assembled by a molecule intent are visible as individual atoms (same rendering as Level 1)
4. Switching between Level 1 and Level 2 does not make the intention zone appear empty mid-assembly
5. No regression: polymer/cell intents unaffected; completed molecules still render as blobs at Level 2
6. Save/load round-trip preserves `molecule.intentionId` (mid-assembly state survives serialization)
