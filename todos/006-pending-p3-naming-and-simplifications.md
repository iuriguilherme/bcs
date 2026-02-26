---
status: pending
priority: p3
issue_id: "006"
tags: [code-review, cleanup, naming, simplification]
---

# P3: Minor naming, simplification, and comment cleanups from code review

## Problem Statement

Several small cleanup items identified during code review of commit 5d85d71. None are correctness issues; all improve readability or remove minor redundancy.

## Findings

### 6a — Naming inconsistency in `applyAtomicForces` (`environment.js:609-613`)

The four intermediate variables use inconsistent naming:
- `atom1Claimed` / `atom2Claimed` — positive assertion of claim
- `atom2Free` / `atom1Free` — compound negative (no claim AND no molecule)

`atom1Claimed` and `atom1Free` are NOT antonyms. The names imply symmetry that doesn't exist. Rename for clarity:

```javascript
// Instead of: atom1Claimed, atom2Claimed, atom1Free, atom2Free
// Use: atom1IsClaimed, atom2IsClaimed, atom1IsFullyFree, atom2IsFullyFree
// (or: inline without intermediate variables entirely)
```

### 6b — Redundant `Math.max(0, ...)` on `normalized` (`intention.js:629`)

```javascript
const normalized = Math.max(0, 1 - dist / this.radius); // outer Max(0,...) is redundant
const forceMag = Math.max(
    this.attractionForce * 2.5 * normalized * atom.mass,
    this.attractionForce * 2.0 * atom.mass               // floor handles negative normalized
);
```

When `dist > radius`, `normalized` would be negative without the outer `Math.max(0, ...)`. But the inner `Math.max` selects the floor anyway since `2.5 * negative * mass < 2.0 * mass`. The outer guard is redundant. Remove it:

```javascript
const normalized = 1 - dist / this.radius;
```

### 6c — `outward * -1` sign convention (`intention.js:650`)

```javascript
const outward = seedAtom.velocity.dot(dir) * -1; // positive = moving away
```

`dir` points from seed toward intent center, so `dot(dir)` positive = moving toward center. The `* -1` inverts to make positive = moving away. This is correct but a trap for readers. Cleaner:

```javascript
const awayComponent = -seedAtom.velocity.dot(dir); // positive when moving away from center
if (awayComponent > 0) {
    seedAtom.velocity = seedAtom.velocity.add(dir.mul(awayComponent * 0.5));
}
```

### 6d — Bug-history comment in `extractAtom` (`molecule.js:808-811`)

4-line comment block explaining why the old single-bond approach was wrong belongs in git history / AGENTS.md, not inline. Only the spread-copy note is needed inline:

```javascript
// Keep only:
const bondsToBreak = [...bestAtom.bonds]; // copy — bonds array mutates during break
for (const bond of bondsToBreak) {
    bond.break(false);
}
```

### 6e — Magic numbers across `intention.js` (9 force multipliers unnamed)

Nine force multipliers scattered across `_rule5_attractClaimed`, `_attractComponents`, and `_rule2_repelIrrelevantMolecules` are unnamed and have no discoverable relationship to each other. The 15.0 anchor multiplier especially lacks rationale for why 3.0 failed. Consider adding a constants block or grouped comment for the Rule 5 set at minimum:

```javascript
// Rule 5 force constants (tuned for 300-atom density, 4 intentions):
// CLAIMED_PEAK   = 2.5  (distance-scaled, inner 80% of radius)
// CLAIMED_FLOOR  = 2.0  (minimum, outer 20%+beyond; prevents escaped atoms freezing)
// SEED_ANCHOR    = 15.0 (was 3.0; increased to resist tar-ball repulsion ~8.0/atom)
// SEED_DAMP_FRAC = 0.5  (fraction of outward velocity cancelled per tick)
```

### 6f — Dead `includes` check in `syncBonds` (`environment.js:149-154`)

After `atom.bonds = []` clears the array, the `if (!bond.atom1.bonds.includes(bond))` guard is always true. The includes() scan adds O(bonds_per_atom) per bond per tick for zero effect:

```javascript
// Remove the includes guards — array was just cleared above:
for (const bond of this.bonds.values()) {
    if (bond.atom1 && bond.atom2) {
        bond.atom1.bonds.push(bond);
        bond.atom2.bonds.push(bond);
    }
}
```

## Proposed Solutions

Fix each item independently — all are safe, isolated changes.

## Recommended Action

Handle 6a-6f in a single cleanup commit. Each is a 1-5 line change with zero behavioral risk.

## Acceptance Criteria

- [ ] `normalized` has no outer `Math.max(0, ...)`
- [ ] `outward` renamed to `awayComponent` with clear sign convention
- [ ] Bug-history comment removed from `extractAtom`
- [ ] `syncBonds` includes guards removed
- [ ] Naming in `applyAtomicForces` clarified (or variables inlined)
- [ ] Rule 5 force constants documented with rationale comment

## Work Log

- 2026-02-25: Identified by simplicity-reviewer and pattern-recognition-specialist agents during code review of commit 5d85d71
