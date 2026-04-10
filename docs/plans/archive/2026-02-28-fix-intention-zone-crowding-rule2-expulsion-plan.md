---
title: "fix: Intention Zone Crowding — Extend Rule 2 Expulsion & Raise Repulsion Floor"
type: fix
status: completed
date: 2026-02-28
origin: docs/brainstorms/2026-02-27-intention-zone-crowding-brainstorm.md
---

# fix: Intention Zone Crowding — Extend Rule 2 Expulsion & Raise Repulsion Floor

## Overview

When a molecule intention assembles a seed, wrong-composition atoms and small
wrong-composition molecules drift into the zone and physically crowd the seed
formation site. They are stuck in **limbo**: bonding is blocked (`tryFormBonds`
sets `prob=0` for any atom inside an intention zone), yet the current repulsion
rules don't clear them.

The fix has two complementary parts (see brainstorm: `docs/brainstorms/2026-02-27-intention-zone-crowding-brainstorm.md`):

1. **Rule 2 composition check** — extend `_rule2_repelIrrelevantMolecules` to
   catch small unstable wrong-composition molecules that currently slip through
2. **Raise repulsion constants** — increase `repulsionForce` and the floor
   multiplier so wrong particles near the zone boundary are actually expelled

## Problem Statement

### The Rule 2 gap

Current `shouldRepel` logic in `intention.js:496`:

```javascript
const shouldRepel = mol.isStable() || mol.atoms.length > totalNeeded;
```

A small unstable wrong-composition molecule like **CHO** inside a **C₂H₄**
intention zone fails both tests:

- `mol.isStable()` → `false` (CHO has unsatisfied valences)
- `mol.atoms.length (3) > totalNeeded (6)` → `false` (it's smaller than the target)

Result: CHO is left alone by Rule 2 indefinitely. It can't bond (blocked by
`tryFormBonds`). It can't grow larger (also blocked). It just occupies space at
the seed site. Multiply by 10-30 wrong molecules and the seed never forms.

### The slow expulsion floor

`repulsionForce` is `8.0` with a floor multiplier of `0.3` → minimum push of
`2.4` per atom per tick. For heavier atoms near the zone boundary, `2.4` is too
weak to overcome damping, so wrong particles creep back in after being pushed.

## Proposed Solution

### Part A — Extend `_rule2_repelIrrelevantMolecules`

Before the existing `shouldRepel` check, add two new conditions:

**Condition 1 — Wrong-element check:**
If the molecule contains any atom whose element symbol is NOT in `targetComp`
(the intention's target element set), repel it immediately.

Example: CHO inside a C₂H₄ zone → `O` is not in `{C, H}` → repel.

This is safe because a molecule with wrong elements can never become the target
molecule through chemistry alone.

**Condition 2 — Surplus check:**
If the molecule contains only correct-composition elements but the intention has
already claimed its full quota of those elements, repel it.

Example: CH₂ inside a C₂H₄ zone where the intent already has 2 C and 4 H
claimed → CH₂ is surplus → repel.

This prevents late-assembly zone saturation (correct-element molecules
accumulating after claiming is complete).

**Safe-keep rule (unchanged):**
A molecule is kept for Rule 4 only if it contains EXCLUSIVELY elements the
intention still needs AND the intention hasn't yet claimed its full quota of
those elements.

### Part B — Raise repulsion constants

| Constant | Planned | Actual (implementation) |
|---|---|---|
| `this.repulsionForce` | `12.0` | `200.0` |
| Floor multiplier (Rule 1 + Rule 2) | `0.5` | `0.5` |

Planned was `8.0 → 12.0`. During implementation, physics analysis showed the simulation's
inter-particle attraction force is `20` per pair and boundary bounce force is `100`.
`repulsionForce = 12` was insufficient to overcome inter-particle attraction (`20 > 12`),
resulting in atoms remaining clustered inside the zone despite expulsion forces being applied.
`repulsionForce = 200.0` (comparable to the boundary bounce force `100`) provides terminal
expulsion velocity ~17 world-units/tick, exiting a 300-unit zone in ~2 seconds at 10×
speed — reliable expulsion before the next spawn cycle even with multiple atoms present.

Computed floor: `200.0 × 0.5 = 100` — ensures atoms at zone boundary always receive
at least 100 force units outward, overcoming any inward inter-particle attraction.

## Technical Considerations

### Architecture impacts

- Only `src/entities/intention.js` is modified
- The change to `this.repulsionForce` and the floor multiplier affects all
  intention types (molecule, polymer, cell) proportionally, which is acceptable
  — the brainstorm confirmed that higher-level intentions' behavior is out of scope
  but the force increase does no harm there
- `_rule2_repelIrrelevantMolecules` is only called from the molecule-intent
  7-rule pipeline; polymer/cell intents use `_attractComponents` with their own
  repulsion logic (not in scope for Part A)

### Accessing claimed-atom counts in Rule 2

The `state` object passed through the 7-rule pipeline contains `state.claimed`
(array of atoms where `atom.claimedByIntentId === this.id`). To compute
remaining-needed counts per element:

```javascript
// Compute once at the top of _rule2_repelIrrelevantMolecules, before the mol loop
const claimedByElement = {};
for (const atom of state.claimed) {
    claimedByElement[atom.symbol] = (claimedByElement[atom.symbol] || 0) + 1;
}
const remainingNeeded = {};
for (const [el, count] of Object.entries(targetComp)) {
    remainingNeeded[el] = Math.max(0, count - (claimedByElement[el] || 0));
}
```

Then for each molecule in the loop:

```javascript
const targetElements = new Set(Object.keys(targetComp));

// Condition 1: wrong-element check
const hasWrongElement = mol.atoms.some(a => !targetElements.has(a.symbol));

// Condition 2: surplus check (only if composition matches)
const isSurplus = !hasWrongElement &&
    mol.atoms.every(a => remainingNeeded[a.symbol] === 0);

const shouldRepel = mol.isStable()
    || mol.atoms.length > totalNeeded
    || hasWrongElement
    || isSurplus;
```

### Performance

`state.claimed` is already built each tick by `_buildState()`. The element
counting loop above is O(claimed_count) and runs once per Rule 2 invocation
(not per molecule). The per-molecule `some`/`every` is O(mol.atoms.length).
For typical intent zones (3-15 molecules in range), this is negligible.

### Institutional learning: don't repel same-composition unstable molecules

Docs note (AGENTS.md Bug #11): "unstable molecules may still become the target
— leave them alone." This applies to **same-composition** molecules (e.g., CH₂
inside a C₂H₄ zone). The new composition check correctly leaves these alone —
it only repels molecules that contain elements NOT in the target.

## System-Wide Impact

- **Interaction graph**: Rule 2 runs on tick N; expelled molecules gain outward
  velocity; they exit the zone by tick N+k; `tryFormBonds` resumes normal
  probability for them once outside
- **No state lifecycle risks**: no persistent state is written; force
  application is ephemeral (velocity only)
- **API surface parity**: `_rule1_repelIrrelevantAtoms` already handles
  wrong-element free atoms; this closes the same gap for molecules

## Acceptance Criteria

- [x] A CHO molecule inside a C₂H₄ intention zone is expelled within 200 ticks
  of entering, measured by `mol` center-of-mass crossing `intention.radius`
- [x] A CH₂ molecule inside a C₂H₄ zone where 2C + 4H are already claimed
  is expelled within 200 ticks
- [x] A CH₂ molecule inside a C₂H₄ zone where claiming is NOT complete is
  NOT repelled by Rule 2 (it remains available for Rule 4) — verified by code
  inspection of the `isSurplus` guard (`!hasWrongElement && mol.atoms.every(...)`)
  and confirmed via T01/T02 still completing (if valid monomers were blocked, these
  would never complete)
- [x] An existing T01/T02 passing test still passes after the change
- [x] `index.html` is rebuilt and passes the same tests as `dev.html`

## Implementation Steps

### Step 1 — Modify `src/entities/intention.js`

**1a. Raise constants in constructor (approx. lines 23–24):**

```javascript
// Before:
this.attractionForce = 3.0;
this.repulsionForce = 8.0;

// After:
this.attractionForce = 3.0;
this.repulsionForce = 12.0;
```

**1b. Update floor multiplier in `_rule1_repelIrrelevantAtoms` (approx. line 474):**

```javascript
// Before:
this.repulsionForce * 0.3
// After:
this.repulsionForce * 0.5
```

**1c. Rewrite `shouldRepel` block in `_rule2_repelIrrelevantMolecules`
(approx. lines 482–517):**

First confirm `targetComp` is available via the `state` destructuring at the top
of the method (the same pattern as Rule 1 at line 456:
`const { nearbyAtoms, targetComp, seedAtomIds } = state;`). If Rule 2 doesn't
already destructure `targetComp`, add it to its destructuring statement.

Add the `remainingNeeded` computation before the molecule loop:

```javascript
// Precompute remaining element needs (for surplus check)
const targetElements = new Set(Object.keys(targetComp));
const claimedByElement = {};
for (const atom of state.claimed) {
    claimedByElement[atom.symbol] = (claimedByElement[atom.symbol] || 0) + 1;
}
const remainingNeeded = {};
for (const [el, count] of Object.entries(targetComp)) {
    remainingNeeded[el] = Math.max(0, count - (claimedByElement[el] || 0));
}
```

Replace the `shouldRepel` line:

```javascript
// Before:
const shouldRepel = mol.isStable() || mol.atoms.length > totalNeeded;

// After:
const hasWrongElement = mol.atoms.some(a => !targetElements.has(a.symbol));
const isSurplus = !hasWrongElement &&
    mol.atoms.every(a => remainingNeeded[a.symbol] === 0);
const shouldRepel = mol.isStable()
    || mol.atoms.length > totalNeeded
    || hasWrongElement
    || isSurplus;
```

**1d. Update floor multiplier in `_rule2_repelIrrelevantMolecules` (approx. line 506):**

```javascript
// Before:
this.repulsionForce * 0.3
// After:
this.repulsionForce * 0.5
```

**Note:** The same `0.3` literal also appears in `_attractComponents` at approximately
lines 939, 990, 1030, 1066 (polymer/cell path). Do NOT change those — polymer/cell
repulsion is out of scope for this fix and has different force balance requirements.

### Step 2 — Rebuild bundle

```bash
deno run --allow-read --allow-write --allow-run build.ts
```

### Step 3 — Add Playwright regression test

Create `tests/scenarios/t08-intention-wrong-composition-expulsion.spec.js`:

**Setup (via `page.evaluate`, analogous to setting `atomSpawner.zone`):**
```javascript
// Inside page.evaluate:
env.clear();
const ethyleneBp = cat.molecules.get('monomer:ethylene:C2H4');
const intent = new Intention('molecule', ethyleneBp, 1000, 1000);
env.addIntention(intent);
intent.initializeExclusions(env);

// Spawner delivers only O atoms — wrong element for C2H4 intent
spawner.active = true;
spawner.atomPool = ['O'];
spawner.tickInterval = 4;
spawner.zone = { x: 900, y: 900, width: 200, height: 200 }; // inside intent radius
```

**Verification (via `page.evaluate` reads after ticking):**
- After 300 ticks: count O atoms (free + in molecules) with
  `dist(atom, {x:1000,y:1000}) < intent.radius`. Assert count < 3 (allows for
  atoms spawned within the last few ticks that haven't been pushed out yet).
- After 500 ticks: assert count === 0 (no O atoms inside zone at steady state).

**Regression check:**
- Run existing T01 and T02 after the change to ensure they still pass within
  their normal tick budgets (no completion-time regression from force changes).

### Step 4 — Run full test suite

```bash
npm test
```

Verify: all existing tests pass (T01, T02, ...), plus new T08.

## Dependencies & Risks

- **Risk**: Raising `repulsionForce` to 12.0 may over-repel correct-element
  molecules at zone boundary. Mitigation: the composition check ensures
  correct-element molecules are only repelled when surplus. Monitor T01/T02
  completion times for regression.
- **Risk**: The `isSurplus` check fires when `state.claimed` is fully populated
  but the seed is still being built (atoms claimed but not yet bonded).
  This is acceptable — once all atoms are claimed, no additional molecules are
  needed in the zone.

## Sources & References

- **Origin brainstorm:** [docs/brainstorms/2026-02-27-intention-zone-crowding-brainstorm.md](docs/brainstorms/2026-02-27-intention-zone-crowding-brainstorm.md)
  — Key decisions carried forward: (1) Rule 2 composition check, (2) sufficiency
  check, (3) repulsionForce 8→12, floor 0.3→0.5
- Rule 2 current logic: `src/entities/intention.js:496`
- Rule 1 floor multiplier: `src/entities/intention.js:474`
- Rule 2 floor multiplier: `src/entities/intention.js:506`
- Constructor constants: `src/entities/intention.js:23–24`
- Claimed atom tracking: `src/entities/atom.js:35` (`claimedByIntentId`)
- State building: `src/entities/intention.js:326–364` (`_buildState`)
- Institutional learning: `docs/solutions/logic-errors/molecule-intent-stuck-reshaping-IntentionSystem-20260225.md`
