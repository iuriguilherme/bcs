---
title: Prokaryote Stub Polymer Interface Gaps
date: 2026-04-10
last_updated: 2026-04-10
category: logic-errors
module: Prokaryote / Polymer
problem_type: logic_error
component: entities
symptoms:
  - TypeError on daughter cell first update tick (mol.update is not a function)
  - TypeError in Polymer.isStable() (mol.isStable is not a function)
  - Daughter cell position silently reset to (0,0) on spawn
  - removeMolecule() silently fails on daughter polymers
  - Daughter cell re-divides immediately after save/load
  - Daughter cell visited on same tick as birth
root_cause: missing_interface_implementation
resolution_type: code_fix
severity: high
tags: [prokaryote, polymer, clone, stub, interface, serialization, map-mutation, binary-fission]
related_files:
  - src/entities/polymer.js
  - src/entities/prokaryote.js
  - src/core/environment.js
---

# Prokaryote Stub Polymer Interface Gaps

## Problem

`Polymer.clone()` creates lightweight plain-object molecule stubs for daughter cell polymers,
but those stubs did not implement the Molecule interface methods that `Polymer.update()` and
`Polymer.isStable()` call every tick. Additionally, `Prokaryote._updatePhysicalProperties()`
unconditionally recalculated position from `polymer.getCenter()`; since stub polymers return
`(0,0)`, daughter cells' spawn offsets were silently overwritten to the origin on their first
update tick.

## Symptoms

- `TypeError: mol.update is not a function` thrown inside `Polymer.update(dt)` on the
  daughter cell's first simulation tick after binary fission.
- `TypeError: mol.isStable is not a function` thrown inside `Polymer.isStable()` when
  the daughter's membrane polymer stability was checked.
- Daughter cells silently teleported to position `(0, 0)` immediately after spawning, even
  when their intended spawn offset was correctly set by `_divide()`.
- `removeMolecule()` silently failed to remove stub molecules because `m.id` was `undefined`.
- Daughter cell re-divides immediately after save/load (divisionCooldown not persisted).
- Daughter cell visited on same tick as birth when environment iterates live Map.

## What Didn't Work

The original `Polymer.clone()` was modeled on a lightweight data-transfer pattern: return
just enough fields (`formula`, `atoms`, `getCenter`) for serialization/display. That pattern
is safe for pure data consumers but breaks any code path that treats the clone as a fully
functional Molecule participant. The error only surfaced at runtime on the daughter's first
tick — not during cloning — because JavaScript does not enforce interface contracts at object
construction time.

## Solution

**Fix 1 — Complete the stub interface in `Polymer.clone()`:**

```javascript
// Before (broken):
const clonedMolecules = this.molecules.map(mol => ({
    formula: mol.formula || '',
    atoms: [],
    getCenter() { return new Vector2(0, 0); }
    // missing: id, bonds, update(), isStable()
}));

// After (fixed):
const clonedMolecules = this.molecules.map(mol => ({
    id: Utils.generateId(),          // required by removeMolecule()
    formula: mol.formula || '',
    bonds: [],                       // assumed present in downstream bond iteration
    atoms: [],
    getCenter() { return new Vector2(0, 0); },
    update() {},                     // called by Polymer.update() every tick
    isStable() { return true; }     // called by Polymer.isStable()
}));
```

**Fix 2 — Guard position recalculation against stub-only polymers:**

```javascript
// Before (broken): always recalculates from getCenter(), which returns (0,0) for stubs
for (const polymer of this.membrane) {
    const center = polymer.getCenter();
    sumX += center.x; sumY += center.y; count++;
}
this.position = new Vector2(sumX / count, sumY / count);  // silently overwrites spawn offset!

// After (fixed): skip recalculation when no live atoms are present
const hasLiveAtoms = this.membrane.some(p =>
    p.molecules && p.molecules.some(m => m.atoms && m.atoms.length > 0)
);
if (hasLiveAtoms) {
    for (const polymer of this.membrane) {
        const center = polymer.getCenter();
        sumX += center.x; sumY += center.y; count++;
    }
    this.position = new Vector2(sumX / count, sumY / count);
}
// When no live atoms exist, the externally-set spawn position is preserved.
```

**Fix 3 — Serialize transient cooldowns:**

```javascript
// Before: serialize() omitted divisionCooldown → reset to 0 on load → immediate re-division
serialize() {
    return { replicationProgress, replicationStage, ... };
}

// After:
serialize() {
    return { replicationProgress, replicationStage, divisionCooldown: this.divisionCooldown, ... };
}
static deserialize(data, polymers) {
    // ...
    prokaryote.divisionCooldown = data.divisionCooldown || 0;
}
```

**Fix 4 — Snapshot Environment Maps before iterating with mutation:**

```javascript
// Before: daughters added during _divide() would be visited on the same tick
for (const prokaryote of this.prokaryotes.values()) {
    if (prokaryote.isAlive) prokaryote.update(dt, this);
}

// After: snapshot prevents daughters from being visited at birth
const snapshot = Array.from(this.prokaryotes.values());
for (const prokaryote of snapshot) {
    if (prokaryote.isAlive) prokaryote.update(dt, this);
}

// Cleanup loop also needs a snapshot (safe to iterate while deleting):
for (const [id, prokaryote] of Array.from(this.prokaryotes)) {
    if (!prokaryote.isAlive) this.prokaryotes.delete(id);
}
```

## Why This Works

JavaScript plain-object stubs have no prototype enforcement. Any object accepted as a
`Molecule` by a container class must be compatible with every call site that container's
methods make — including hot-path calls inside `update()`. The stub's empty `update()` is
a correct no-op (a daughter's polymer has no live atoms to simulate yet), and `isStable()`
returning `true` matches the expected semantics for a cloned, already-stable polymer.

The position guard works because live-atom presence is the only reliable signal that
`getCenter()` will return a meaningful coordinate. Skipping position recalculation when
all membrane polymers are stub-backed leaves the spawn offset untouched.

The Map snapshot pattern is required because JavaScript Maps iterate over entries in
insertion order, and entries added after iteration starts may be visited in the same loop
pass depending on insertion order.

## Prevention

- **Stub interface completeness**: Any plain-object stub used as a drop-in for `Molecule`
  inside a `Polymer` must implement the full interface:
  `id`, `formula`, `mass`, `fingerprint`, `atoms`, `bonds`, `isMonomer`,
  `getCenter()`, `update()`, `isStable()`.
- **Audit stubs when extending Polymer's hot path**: If `Polymer.update()` or
  `Polymer.isStable()` gains a new `mol.foo()` call, audit all stub creation sites.
- **Never infer position from stubs returning sentinel coordinates**: Guard any method that
  derives world position from `getCenter()` against empty or stub-backed collections before
  overwriting authoritative state.
- **Serialize all rate-limiting fields**: `divisionCooldown` and equivalent gating fields
  must round-trip through `serialize()`/`deserialize()` to prevent re-triggering on load.
- **Snapshot Environment Maps before iterating with mutation**: Loops over
  `this.prokaryotes`, `this.molecules`, `this.atoms`, `this.bonds` that may `add` or
  `delete` entries during iteration must use `Array.from(map.values())` before the loop.

## Related Issues

- Plan: `docs/plans/2026-04-09-001-feat-prokaryote-self-replication-plan.md` (completed)
- Test: `tests/scenarios/t08-prokaryote-replication.spec.js`
