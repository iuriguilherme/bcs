---
status: complete
priority: p2
issue_id: "052"
tags: [code-review, correctness, quality]
dependencies: []
---

# Bond.stabilityScore getter can exceed 1.0 for future high-energy bonds

## Problem Statement

`Bond.stabilityScore` is computed as `this.strength / MAX_BOND_ENERGY` with no `Math.min(1, ...)` clamp:

```javascript
get stabilityScore() {
    return this.strength / MAX_BOND_ENERGY;  // no clamp
}
```

Meanwhile `Thermodynamics.getStabilityScore()` clamps correctly:
```javascript
getStabilityScore(symbol1, symbol2, order) {
    return Math.min(1, getBondEnergy(symbol1, symbol2, order) / MAX_BOND_ENERGY);  // clamped
}
```

Currently all bond energies in the table are ≤ 257 (the MAX), so stabilityScore is always ≤ 1.0. But if any future bond type exceeds `MAX_BOND_ENERGY`, `stabilityScore` returns > 1.0, making `pBreak = (1 - stability)` **negative** — mathematically a "super-stable" bond, but `Math.random() < negative_number` is always false. The behavior would silently produce the right result (never breaks) but for the wrong reason.

**Why it matters:** The asymmetry is a latent correctness trap. When `MAX_BOND_ENERGY` is updated to accommodate a new element, `Bond.stabilityScore` would silently diverge without any type error or test failure.

## Findings

- **Source: Performance Oracle + Simplicity Reviewer agents**
- `src/entities/bond.js` line 54: getter without clamp
- `src/systems/thermodynamics.js` line 20: same calculation WITH `Math.min(1, ...)`
- Current element table: max bond energy is C≡O = 257 = MAX_BOND_ENERGY → safe today

## Proposed Solutions

### Option A: Add Math.min clamp to the getter (Recommended)
```javascript
get stabilityScore() {
    return Math.min(1, this.strength / MAX_BOND_ENERGY);
}
```
- **Effort:** Trivial (one char change)
- **Pros:** Consistent with `getStabilityScore()`; future-safe

### Option B: Compute once in constructor as a plain property
```javascript
// In Bond constructor, after calculateStrength():
this.stabilityScore = Math.min(1, this.strength / MAX_BOND_ENERGY);
```
- **Pros:** Eliminates getter overhead; computed only once (strength never changes)
- **Cons:** Slightly more object size

### Option C: Leave as-is with a comment
- **Pros:** No code change
- **Cons:** Latent divergence persists; next element addition may introduce silent bug

## Acceptance Criteria

- [ ] `Bond.stabilityScore` cannot return a value > 1.0 for any bond energy
- [ ] Consistent clamping behavior between `stabilityScore` getter and `Thermodynamics.getStabilityScore()`
- [ ] All 20 tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from code review (Performance Oracle + Simplicity Reviewer agents) | Clamp asymmetry between two stability score paths |
