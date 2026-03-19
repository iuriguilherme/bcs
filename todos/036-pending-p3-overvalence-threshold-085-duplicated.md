---
status: pending
priority: p3
issue_id: "036"
tags: [code-review, thermodynamics, magic-number, intention-system]
---

# `0.85` overvalence stability threshold duplicated twice in `_rule6_bondClaimed`

## Problem Statement

The threshold `0.85` for allowing overvalence bonding appears twice in `_rule6_bondClaimed()` in `src/entities/intention.js`:

Line ~758 (when bonding claimed atom to seed):
```js
const stability = getBondEnergy(atom.symbol, seedAtom.symbol, 1) / MAX_BOND_ENERGY;
const allowOvervalence = stability > 0.85;
```

Line ~807 (when creating initial seed from two claimed atoms):
```js
const stability = getBondEnergy(atom.symbol, other.symbol, 1) / MAX_BOND_ENERGY;
const allowOvervalence = stability > 0.85;
```

If this threshold needs tuning (e.g., to 0.90 for stricter overvalence control), it would need to be updated in two places. This threshold represents a significant domain concept: "bonds stable enough to allow violating normal valence rules."

## Proposed Solution

Define a named constant at the top of `intention.js` or in `periodic-table.js`:
```js
// Bonds with stability above this threshold may exceed normal valence limits.
// CO triple bond stability = 1.0 (257/257), well above this floor.
// C-H stability = 0.385 (99/257), below — H stays monovalent.
const OVERVALENCE_STABILITY_THRESHOLD = 0.85;
```

Then replace both occurrences of `> 0.85` with `> OVERVALENCE_STABILITY_THRESHOLD`.

**Effort**: Trivial | **Risk**: None

## Acceptance Criteria

- [ ] `OVERVALENCE_STABILITY_THRESHOLD` constant defined
- [ ] Both `> 0.85` occurrences in `_rule6_bondClaimed` replaced
- [ ] All tests pass (behavior unchanged)

## Work Log

- 2026-03-18: Identified during PR #5 code review — duplicated threshold in overvalence logic
