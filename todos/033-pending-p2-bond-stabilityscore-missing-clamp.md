---
status: pending
priority: p2
issue_id: "033"
tags: [code-review, thermodynamics, defensive-coding, silent-failure]
---

# `bond.stabilityScore` getter lacks clamp — inconsistent with Thermodynamics.getStabilityScore()

## Problem Statement

There are two places in the codebase that compute a stability score for a bond:

1. **`bond.stabilityScore` getter** (`src/entities/bond.js:53`): `return this.strength / MAX_BOND_ENERGY;`
2. **`Thermodynamics.getStabilityScore()`** (`src/systems/thermodynamics.js:20`): `return Math.min(1, getBondEnergy(symbol1, symbol2, order) / MAX_BOND_ENERGY);`

Only the Thermodynamics version clamps to 1.0. The `bond.stabilityScore` getter does not clamp.

`shouldBreakThermal(temperature)` uses `bond.stabilityScore`:
```js
const pBreak = (1 - stability) * Math.min(1, temperature / 298);
```
If `stability > 1.0`, then `(1 - stability) < 0`, making `pBreak < 0`. `Math.random() < negative` is always `false` — the bond would never break thermally (silent failure). If `stability < 0` (impossible with current data), `pBreak` could exceed 1.0.

Currently `MAX_BOND_ENERGY = 257` is the hardcoded maximum in the table, so all bonds have `strength ≤ 257` and the clamping issue cannot occur. But if a new element or bond with energy > 257 is ever added to BOND_ENERGIES, `bond.stabilityScore` would exceed 1.0 silently.

## Findings

- **File**: `src/entities/bond.js:53` — `get stabilityScore()` — no clamp
- **File**: `src/systems/thermodynamics.js:20` — `getStabilityScore()` — has `Math.min(1, ...)`
- **File**: `src/entities/bond.js:64-68` — `shouldBreakThermal()` relies on `stabilityScore ≤ 1`
- **Safe today**: All bond energies ≤ 257 = MAX_BOND_ENERGY. No crash risk currently.

## Proposed Solution

Add clamp to `bond.stabilityScore` getter for defensive correctness:
```js
get stabilityScore() {
    return Math.min(1, this.strength / MAX_BOND_ENERGY);
}
```
This makes both computation paths consistent and protects against future table additions.

**Effort**: Trivial (1 line change) | **Risk**: None

## Acceptance Criteria

- [ ] `bond.stabilityScore` clamps to `[0, 1]` range
- [ ] `shouldBreakThermal()` behavior unchanged for existing bond types
- [ ] All tests pass

## Work Log

- 2026-03-18: Identified during PR #5 code review — inconsistency between two stability score computation paths
