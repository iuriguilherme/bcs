---
status: pending
priority: p2
issue_id: "004"
tags: [code-review, architecture, coupling, environment, atom]
---

# P2: `applyAtomicForces` coupled to intent system via `claimedByIntentId`

## Problem Statement

`Environment.applyAtomicForces` now reads `atom.claimedByIntentId` to make physics decisions. This breaches the architectural boundary: the physics layer (Environment) should not know about the behavioral layer's (Intention) internal state. If a second feature also needs physics isolation (e.g. a cell-controlled atom), this pattern will be copy-pasted, accumulating intent-system-specific conditions in the physics loop.

## Findings

**File:** `src/core/environment.js`, lines 609-613

```javascript
const atom1Claimed = !!atom1.claimedByIntentId;
const atom2Claimed = !!atom2.claimedByIntentId;
const atom2Free = !atom2.claimedByIntentId && !atom2.moleculeId;
const atom1Free = !atom1.claimedByIntentId && !atom1.moleculeId;
if ((atom1Claimed && atom2Free) || (atom2Claimed && atom1Free)) continue;
```

`claimedByIntentId` is an intent-subsystem property. The physics loop now has two responsibilities: (1) Newtonian inter-particle forces, and (2) intent-system isolation policy.

The concern is extensibility: if a prokaryote-controlled atom also needs physics isolation, a new `claimedByCellId` check appears here. Two checks become three. The physics loop becomes a registry of behavioral subsystem overrides.

## Proposed Solutions

### Option A: Add `isPhysicsIsolated` getter to Atom (Recommended)

```javascript
// In src/entities/atom.js:
get isPhysicsIsolated() {
    return !!this.claimedByIntentId;
    // Future: return !!this.claimedByIntentId || !!this.controlledByCellId;
}
```

Then in `applyAtomicForces`:
```javascript
const atom1Isolated = atom1.isPhysicsIsolated;
const atom2Isolated = atom2.isPhysicsIsolated;
const atom1FullyFree = !atom1Isolated && !atom1.moleculeId;
const atom2FullyFree = !atom2Isolated && !atom2.moleculeId;
if ((atom1Isolated && atom2FullyFree) || (atom2Isolated && atom1FullyFree)) continue;
```

`applyAtomicForces` no longer knows *why* an atom is isolated — only that it is. Adding a second isolation reason requires changing only `Atom.isPhysicsIsolated`.

**Pros:** Correct encapsulation, extensible without touching physics loop.
**Cons:** Adds a getter to Atom.
**Effort:** Small. **Risk:** Very low.

### Option B: Accept the current coupling with documentation

Add a comment documenting the coupling and noting the pattern to follow if a second isolation mechanism is added. No code change.

**Pros:** No code change.
**Cons:** Technical debt solidified.
**Effort:** Trivial.

## Recommended Action

Option A — the getter is a 2-line addition in `atom.js` that correctly encapsulates the isolation decision.

## Technical Details

- **Files:** `src/entities/atom.js` (add getter), `src/core/environment.js` (use getter)
- **Related:** Also document the overlap pass-through consequence inline (claimed+free atoms can overlap without collision response — intentional, bounded by intent attraction force)

## Acceptance Criteria

- [ ] `applyAtomicForces` reads `atom.isPhysicsIsolated`, not `atom.claimedByIntentId`
- [ ] `Atom.isPhysicsIsolated` getter defined in `atom.js`
- [ ] Comment in `applyAtomicForces` notes that skip includes overlap repulsion
- [ ] Playwright test `test_spawner.spec.js` still passes

## Work Log

- 2026-02-25: Identified by architecture-strategist agent during code review of commit 5d85d71
