---
status: complete
priority: p2
issue_id: "035"
tags: [code-review, thermodynamics, simplicity, architecture]
dependencies: ["032"]
---

# `shouldBreakThermal()` is dead code — `tryBreakThermalBonds()` never calls it

## Problem Statement

Phase 2 adds `bond.shouldBreakThermal(temperature)` to `bond.js`. Phase 4's `tryBreakThermalBonds()` never calls this method — it reimplements the probability calculation inline with a different formula. The method is defined but never invoked, exactly mirroring the existing `bond.shouldBreak()` which has been dead code since the project began. Adding a second dead method to `bond.js` creates confusion about where the canonical breaking decision lives.

## Findings

- **Phase 2** defines: `shouldBreakThermal(temperature) { return Math.random() < (1 - this.stabilityScore) * Math.min(1, temperature / 298); }`
- **Phase 4** `tryBreakThermalBonds()` instead computes: `Math.min(effectiveDt * A * Math.exp(-(bond.stabilityScore) / Math.max(temp / 298, 0.01)), 1.0)` — a completely different formula (Arrhenius)
- The plan's own Interaction Graph arrows: `tryBreakThermalBonds() → bond.stabilityScore` — NOT `→ bond.shouldBreakThermal()`
- `bond.shouldBreak()` at `bond.js:67` is already dead (confirmed: never called in update loop)
- This finding is contingent on resolving Todo 032 (which fixes the formula inconsistency)

## Proposed Solutions

### Option 1: Have `tryBreakThermalBonds()` call `bond.shouldBreakThermal(temp)` (Recommended after fixing Todo 032)

After fixing the Arrhenius formula in Todo 032, make `tryBreakThermalBonds()` call the bond's own method:

```javascript
// In tryBreakThermalBonds() — simple delegation
for (const bond of this.bonds.values()) {
    if (bond.atom1.isSealed || bond.atom2.isSealed) continue;
    if (bond.shouldBreakThermal(temp)) {
        this._bondsToBreak.push(bond);
    }
}
```

**Pros:**
- `bond.shouldBreakThermal()` becomes the canonical decision site
- Eliminates the need to understand the formula when reading `tryBreakThermalBonds()`
- Removes the dead-code status

**Cons:**
- Requires Todo 032 to be resolved first (formula must match)

**Effort:** 15 minutes (after 032)

**Risk:** Low

---

### Option 2: Delete `shouldBreakThermal()` and keep formula inline in `tryBreakThermalBonds()`

Remove `shouldBreakThermal()` entirely. Keep the logic in `tryBreakThermalBonds()` as an inline expression:

```javascript
const pBreak = (1 - bond.stabilityScore) * Math.min(1, temp / 298);
if (Math.random() < pBreak) { ... }
```

**Pros:** One less method on Bond; no delegation overhead; simpler
**Cons:** Can't test the break probability in isolation without setting up full environment

**Effort:** 5 minutes
**Risk:** Low

## Recommended Action

Resolve Todo 032 first, then decide: if `shouldBreakThermal()` is called from `tryBreakThermalBonds()`, it's alive. If the formula is kept inline, delete the method. Either way, do not leave two formula implementations in the codebase.

## Technical Details

**Affected files:**
- `src/entities/bond.js` — `shouldBreakThermal()` definition (Phase 2)
- `src/core/environment.js` — `tryBreakThermalBonds()` inline formula (Phase 4)

## Acceptance Criteria

- [ ] There is exactly ONE place in the codebase where the thermal break probability formula lives
- [ ] `bond.shouldBreakThermal()` is either called in `tryBreakThermalBonds()` OR deleted (not both)
- [ ] No formula inconsistency between the method and the inline calculation

## Work Log

### 2026-03-01 - Identified by Code Simplicity Reviewer and Pattern Recognition Specialist

**By:** Code review agents (technical_review workflow)

---

### 2026-03-01 - Resolved (automatically by Todo 032)

**By:** Claude Code

**Actions:**
- Todo 032 resolution rewrote Phase 4 to delegate to `bond.shouldBreakThermal(temp)` instead of inlining the Arrhenius formula
- `shouldBreakThermal()` is now the canonical thermal break decision method — no longer dead code
- Single-formula principle satisfied: Phase 2 defines it, Phase 4 calls it, no inline duplicate

## Resources

- **Plan:** `docs/plans/2026-03-01-feat-thermodynamics-temperature-bond-stability-plan.md` Phase 2, Phase 4
- **Resolved by:** Todo 032 (formula fix made shouldBreakThermal the single canonical site)
