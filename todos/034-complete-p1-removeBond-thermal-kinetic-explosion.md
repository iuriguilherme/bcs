---
status: complete
priority: p1
issue_id: "034"
tags: [code-review, thermodynamics, physics, architecture]
dependencies: []
---

# `environment.removeBond()` applies kinetic energy — thermal bond breaks cause velocity explosion

## Problem Statement

The plan's Phase 4 instructs using `this.removeBond(bond.id)` as "the canonical API" for thermal bond breaking. But `environment.removeBond()` internally calls `bond.break(true)` — which fires a velocity impulse on both atoms. For thermal bond breaking, every broken bond will launch both atoms apart at high velocity. At high temperatures with many bonds breaking, this creates a kinetic energy explosion: atoms fly off screen and the simulation destabilizes. The plan contradicts itself by saying "use canonical API" but the canonical API has side effects incompatible with thermal breaking.

## Findings

- **`environment.removeBond()` implementation** (environment.js:88-94):
  ```javascript
  removeBond(bondId) {
      const bond = this.bonds.get(bondId);
      if (bond) {
          bond.break();          // ← calls bond.break(true) — adds velocity impulse
          this.bonds.delete(bondId);
      }
  }
  ```
- **`bond.break(addEnergy = true)`** (bond.js:98-113): When `addEnergy = true`, pushes atoms apart with velocity `(3 + order * 2)` world-units/tick along the bond axis. For a CO triple bond: `(3 + 3*2) = 9` velocity units per atom.
- At 600K with 50 bonds breaking simultaneously on the 6th tick: 100 atoms receive velocity impulses in a single frame, overwhelming the physics system.
- **The plan explicitly flags this** as a "deep-review fix" but then recommends the wrong solution: `removeBond()` calls `break(true)`, not `break(false)`.
- **The correct precedent** is in `molecule.js:491` `_restructureBonds()`: `bond.break(false)` followed by `environment.bonds.delete(bond.id)` — suppresses kinetic energy for structural (non-thermal) breaking.

## Proposed Solutions

### Option 1: Use `bond.break(false)` + `bonds.delete()` in `tryBreakThermalBonds()` (Recommended)

Match the reshaping pattern in `molecule.js:491`:

```javascript
// In tryBreakThermalBonds() — Phase 4
for (const bond of this._bondsToBreak) {
    bond.break(false);        // suppress kinetic energy — thermal equilibrium handles it
    this.bonds.delete(bond.id);
}
```

**Pros:**
- Matches existing `_restructureBonds()` pattern for silent bond removal
- Prevents velocity explosion at high temperature
- Physically accurate: thermal breaking is not accompanied by a directed velocity impulse

**Cons:**
- Bypasses `removeBond()` — but `removeBond()` is semantically wrong for thermal breaking
- Need to ensure `bond.break(false)` correctly removes bond from `atom.bonds` arrays

**Effort:** 15 minutes

**Risk:** Low

---

### Option 2: Add an `addEnergy` parameter to `removeBond()`

```javascript
removeBond(bondId, addEnergy = true) {
    const bond = this.bonds.get(bondId);
    if (bond) {
        bond.break(addEnergy);
        this.bonds.delete(bondId);
    }
}
```

Call as `this.removeBond(bond.id, false)` from `tryBreakThermalBonds()`.

**Pros:** Keeps canonical API intact, adds a parameter for silent removal
**Cons:** Changes signature of existing method; existing callers must not be affected; adds complexity
**Effort:** 30 minutes
**Risk:** Low-Medium

## Recommended Action

Option 1 — use `bond.break(false)` + `bonds.delete()`. This is the same pattern as `_restructureBonds()` in `molecule.js`. The plan's Phase 4 code should be corrected to:

```javascript
for (const bond of this._bondsToBreak) {
    bond.break(false);        // silent — no kinetic impulse
    this.bonds.delete(bond.id);
}
```

Update the plan note from "use canonical API (deep-review: not bond.break + delete)" to "use bond.break(false) + bonds.delete() — suppress kinetic energy for thermal breaking (same as _restructureBonds pattern in molecule.js)."

## Technical Details

**Affected files:**
- `src/core/environment.js` — `tryBreakThermalBonds()` (Phase 4)
- `docs/plans/2026-03-01-feat-thermodynamics-temperature-bond-stability-plan.md` — Phase 4 code example

**Bond.break() signature** (bond.js:98):
```javascript
break(addEnergy = true) {
    if (addEnergy) {
        // Push atoms apart with velocity impulse
        const velocity = (3 + this.order * 2);
        // ... vector math to apply velocity to both atoms
    }
    this.atom1.removeBond(this);
    this.atom2.removeBond(this);
}
```

## Acceptance Criteria

- [ ] Phase 4 in plan uses `bond.break(false)` + `bonds.delete()`, not `removeBond(bond.id)`
- [ ] The note explains WHY: thermal breaking should not apply kinetic impulse
- [ ] References `molecule.js _restructureBonds()` as the precedent
- [ ] At high temperature (600K), atoms do not fly off screen when bonds break

## Work Log

### 2026-03-01 - Identified by Architecture Strategist

**By:** Architecture Strategist review agent

**Actions:**
- Read `environment.removeBond()` at lines 88-94
- Confirmed it calls `bond.break(true)` internally
- Found precedent in `molecule.js:491` using `bond.break(false)`
- Confirmed that the "canonical API" recommendation in the deep-review was incorrect

## Resources

- **Plan:** `docs/plans/2026-03-01-feat-thermodynamics-temperature-bond-stability-plan.md` Phase 4
- **Source:** `src/core/environment.js:88-94` — `removeBond()`
- **Source:** `src/entities/bond.js:98-113` — `break(addEnergy = true)`
- **Precedent:** `src/entities/molecule.js:491` — `_restructureBonds()` uses `bond.break(false)`

---

### 2026-03-01 - Resolved (alongside Todo 032)

**By:** Claude Code

**Actions:**
- Phase 4 `tryBreakThermalBonds()` now uses `bond.break(false) + this.bonds.delete(bond.id)` instead of `this.removeBond(bond.id)`
- Added explicit comment explaining why: "suppress kinetic energy — thermal equilibrium, not explosion"
- Added note referencing `molecule.js:491 _restructureBonds()` as the precedent
- Updated State Lifecycle section to document `bond.break(false)` pattern and dirty `atom.bonds` until next `syncBonds()`
