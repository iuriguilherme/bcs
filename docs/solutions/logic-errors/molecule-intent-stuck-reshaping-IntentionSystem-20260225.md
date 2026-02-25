---
module: Intention System
date: 2026-02-25
problem_type: logic_error
component: service_object
symptoms:
  - "Overlapping molecule intents lock at ~100% progress after one completes"
  - "Seed molecule shows geomVerified=true but hasValidValence=false with C≡C(3) + unlinked H atoms"
  - "Seeds stuck with isReshaping=true and reshapingTimer=200 after thousands of ticks"
root_cause: logic_error
resolution_type: code_fix
severity: high
status: RESOLVED
tags: [intention, reshaping, seed-molecule, state-machine, molecule-assembly, overlapping-intents, tar-ball, physics]
---

# Overlapping Molecule Intents: Root Cause Analysis and Resolution

> ✅ **STATUS: RESOLVED** — All three overlapping C2H4 intents now complete reliably with the AtomSpawner running. Playwright test `test_spawner.spec.js` confirms `success: true` in ~3000-5000 ticks.

## Problem

When two or more `Intention` objects of type `'molecule'` overlap (sharing the same pool of free atoms), completed intents leave the remaining intents permanently stuck in an invalid reshaping state. The stuck seeds show `geometryVerified=true` but `hasValidValence=false`, meaning they can never pass `_rule7_checkCompletion` and complete.

## Environment

- Module: Intention System (`src/entities/intention.js`, `src/entities/molecule.js`)
- Tech: Vanilla JavaScript, BioChemSim
- Affected Component: `Intention._rule7_checkCompletion`, `Molecule._restructureBonds`, `Intention._rule6_bondClaimed`
- Date: 2026-02-25

## Symptoms

- Multiple C2H4 molecule intents placed close together; the first one completes successfully but others freeze
- Inspector shows seed bonds = `[C-C(order:3)]` with H atoms having no bonds at all
- `geometryVerified: true`, `hasValidValence: false`, `isReshaping: false` — permanently stuck
- Alternatively: `isReshaping: true`, `reshapingTimer: 200` after 5000+ ticks (timer never decrements)
- Console: no `"Molecule [name] sealed"` log for the stuck intents

## What Was Tried (All Failed in Real Gameplay)

All of the following code changes were committed to the codebase. They each addressed real logic errors that were confirmed present in the source. However, none of them fixed the observable in-game behaviour.

---

### Fix 1 — Block bonding to reshaping seeds (`intention.js:_rule6_bondClaimed`)

```javascript
if (seedMol) {
    if (seedMol.isReshaping) return;  // Added guard
    const bondingRadius = ...
```

**Rationale:** Adding atoms to a seed mid-reshape makes `atomToTemplateIndex` stale. `_restructureBonds` then leaves new atoms without bonds → `hasValidValence=false` forever.

**Why it didn't fix the problem:** The controlled Playwright test (manually pre-placed atoms) passed, but real gameplay still exhibited the stuck behaviour. The test setup did not accurately simulate the spawner-driven, continuous atom arrival conditions of actual gameplay.

---

### Fix 2 — Abort `_restructureBonds` on stale mapping (`molecule.js:_restructureBonds`)

```javascript
if (this.atomToTemplateIndex.size !== this.atoms.length) {
    this.cancelReshaping();
    return;
}
```

**Rationale:** Safety net to prevent broken bond state from being committed.

**Why it didn't fix the problem:** `staleMapResets` counter stayed at 0 during all tests — this path was never triggered, meaning the stale-map scenario described was either not the actual code path being hit, or the fix was intercepted by Fix 1 before it could matter.

---

### Fix 3 — Recovery from stuck `geometryVerified=true` state (`intention.js:_rule7_checkCompletion`)

```javascript
} else if (seedMol.geometryVerified && !seedMol.isReshaping) {
    seedMol.geometryVerified = false;
    seedMol.targetTemplate = null;
    seedMol.targetPositions = null;
    seedMol.atomToTemplateIndex = null;
}
```

**Rationale:** Detect the stuck state and reset geometry flags to allow a reshaping retry.

**Why it didn't fix the problem:** `geometryStuckResets` counter stayed at 0. The recovery branch was never reached. The actual failure mode was upstream of this point.

---

### Fix 4 — Cancel pre-seed reshaping (`intention.js:_rule7_checkCompletion`)

```javascript
if (seedMol.isReshaping && seedMol.atoms.length < totalNeeded) {
    seedMol.cancelReshaping();
}
```

**Rationale:** `tryFormBonds` bonds two C atoms into a regular C2 molecule before any intention claims them. That molecule's `update()` → `isStable()` calls `startReshaping(Dicarbon)`. When the intention later adopts the C2 as its seed, `reshapingTimer` is frozen at 200 because `updateReshaping()` only runs when `atoms.length >= totalNeeded`.

**Playwright test result:** A controlled test with pre-placed atoms passed — `stuckCount: 0`, both intents completed, `moleculesInEnv: 2`. Three-intent test also passed.

**Why it didn't fix the problem in practice:** The Playwright tests used a synthetic setup (atoms manually placed at specific coordinates with exact counts before ticks began). This does not reproduce the conditions of real gameplay, where atoms are continuously spawned by the `AtomSpawner` over time, arrive at different rates, and two intents are simultaneously competing for a shared, dynamically-changing atom pool. The tests confirmed the specific failure mode described by Fix 4 was real and did exist in the code, but the real-world failure likely involves additional or different code paths not exercised by the controlled test.

---

## What Is Known

### The Playwright test limitation

The tests that showed "pass" used this pattern:

```javascript
env.clear();
// Manually place exact counts of atoms at fixed positions
for (let i = 0; i < 4; i++) env.addAtom(new Atom('C', 340 + i*25, 280));
for (let i = 0; i < 8; i++) env.addAtom(new Atom('H', 330 + i*20, 315));
// Run ticks
for (let i = 0; i < 5000; i++) env.update(1/60);
```

This is not equivalent to real gameplay, which involves:
- The `AtomSpawner` drip-feeding atoms over time
- Atoms arriving from random positions within the spawn zone
- Both intents competing simultaneously from tick 1
- No pre-guarantee that exactly the right number of atoms are present

### Browser cache gotcha

When using Playwright to test fixes, the browser caches `.js` files loaded via `<script src="...">` tags even across page navigations. A URL query param on the HTML page does not bust the cache for script imports. Use `page.route('**/*.js', ...)` to intercept all JS and add `Cache-Control: no-store` headers. Always verify fixes are live with:

```javascript
Intention.prototype._rule6_bondClaimed.toString().includes('isReshaping) return')
```

### Confirmed real logic errors (all 4 fixes address genuine bugs)

The four code paths fixed above are real logic errors and the code changes are correct. However, fixing them was not sufficient to resolve the user-visible symptom. The real root causes were in the physics/attraction system, not in the reshaping state machine.

---

## Root Cause Analysis (Resolved — Session 2026-02-25 continuation)

The real causes, discovered by running the AtomSpawner-driven simulation with per-tick diagnostics, were **four interacting physics bugs** that created a cascade of failures:

### Root Cause A: Tar-ball mega-molecule formation

Inside intent zones, free unclaimed atoms bonded spontaneously via `tryFormBonds` (probability `1.5 × 0.3 = 0.45` per tick). With C+H atoms relevant to both elements, they rapidly formed large unstable molecules (C123H94, 200+ atoms). The old `_rule2_repelIrrelevantMolecules` only repelled **stable** molecules; the tar-ball was unstable so it was never repelled.

**Fix** (`environment.js:tryFormBonds`): Set `prob = 0` when either atom is inside a molecule intent zone. Free atoms in intent zones wait to be claimed (Rule 3) and bonded (Rule 6) — no spontaneous bonding.

**Fix** (`intention.js:_rule2_repelIrrelevantMolecules`): Also repel large unstable molecules (`mol.atoms.length > totalNeeded`), applying force **per atom** (not via `mol.applyForce`) so large molecules (224 atoms, total_mass=900) actually get meaningful per-atom acceleration.

### Root Cause B: `extractAtom` only broke one bond

`Molecule.extractAtom(symbol)` called `bestAtom.bonds[0].break()` — only the first bond. For multi-bonded atoms, `updateMolecules` reconnected the atom to the remaining bonds on the same tick, making extraction a no-op.

**Fix** (`molecule.js:extractAtom`): Copy `bestAtom.bonds` array before breaking, then break **all** bonds: `for (const bond of [...bestAtom.bonds]) bond.break(false)`.

### Root Cause C: Seed drift — anchor force insufficient

The anchor force `attractionForce * 3.0 * mass` was overwhelmed by tar-ball repulsion. Seeds drifted 100-200 units from intent center. With seed drifting, claimed atoms chased the moving target and never converged.

**Fix** (`intention.js:_rule5_attractClaimed` seed anchor): Increased multiplier from `3.0` to `15.0`. Added velocity correction: each tick, cancel the outward velocity component (`v += dir * max(0, -v·dir) * 0.5`).

### Root Cause D: Claimed atoms escape intent radius and get zero attraction force

The attraction formula `(1 - dist/radius)` goes to zero at the radius boundary and stays zero beyond it. Claimed atoms spawned with high velocity escaped the 300-unit radius, then received **no pull-back force**. After 2000 ticks with zero attraction, they froze at 500+ units from the seed.

**Fix** (`intention.js:_rule5_attractClaimed` claimed atoms): Added minimum force floor:
```javascript
const normalized = Math.max(0, 1 - dist / this.radius);
const forceMag = Math.max(
    this.attractionForce * 2.5 * normalized * atom.mass,
    this.attractionForce * 2.0 * atom.mass  // floor: always pull claimed atoms back
);
```

### Root Cause E: Atomic gas repulsion displaces claimed atoms

With 150-200 unclaimed free atoms bouncing in the intent zone (Fix A blocked their bonding, so they accumulated), atom-atom repulsion (`repulsionStrength = 500`) was ~230x stronger than the claimed-atom attraction force (≈2). Every collision sent H atoms (mass=1) flying at 16+ units/tick.

**Fix** (`environment.js:applyAtomicForces`): Skip physics interactions between a claimed atom and an unclaimed free atom. Claimed atoms are guided by intent forces, not the atomic gas:
```javascript
const atom1Claimed = !!atom1.claimedByIntentId;
const atom2Free = !atom2.claimedByIntentId && !atom2.moleculeId;
if ((atom1Claimed && atom2Free) || (atom2Claimed && atom1Free)) continue;
```

---

## Verified Fix

Playwright test `test_spawner.spec.js` with 3 overlapping C2H4 intents + AtomSpawner (C:H = 1:2, tickInterval=10, 300×300 zone) consistently returns `success: true` with `completedAt` between 2900-5000 ticks. Repeated runs (3+) all succeed.

Files changed: `src/entities/intention.js`, `src/entities/molecule.js`, `src/core/environment.js`.

## Related Issues

- See also: `memory/debugging.md` — Bug 1-5 (prior seed drift, stuck reset, and polymer convergence fixes)
