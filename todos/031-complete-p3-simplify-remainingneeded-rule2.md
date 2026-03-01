---
status: pending
priority: p3
issue_id: "031"
tags: [code-review, code-quality, simplification]
---

# Simplify claimedByElement/remainingNeeded to single claimedCount map in Rule 2

## Problem Statement

`_rule2_repelIrrelevantMolecules` builds two intermediate objects to compute the surplus check:

```javascript
const claimedByElement = {};
for (const atom of claimed) {
    claimedByElement[atom.symbol] = (claimedByElement[atom.symbol] || 0) + 1;
}
const remainingNeeded = {};
for (const [el, count] of Object.entries(targetComp)) {
    remainingNeeded[el] = Math.max(0, count - (claimedByElement[el] || 0));
}
// Then per-molecule:
const isSurplus = !hasWrongElement &&
    mol.atoms.every(a => remainingNeeded[a.symbol] === 0);
```

The `remainingNeeded === 0` check is equivalent to `claimedByElement[el] >= targetComp[el]`. The intermediate `remainingNeeded` map can be eliminated:

```javascript
const claimedCount = {};
for (const atom of claimed) {
    claimedCount[atom.symbol] = (claimedCount[atom.symbol] || 0) + 1;
}
// Then per-molecule:
const isSurplus = !hasWrongElement &&
    mol.atoms.every(a => (claimedCount[a.symbol] || 0) >= (targetComp[a.symbol] || 0));
```

This saves one loop and one object allocation per Rule 2 invocation.

## Findings

- **Reporter**: code-simplicity-reviewer, PR #3
- **File**: `src/entities/intention.js` — `_rule2_repelIrrelevantMolecules()`, lines ~468–477, 492–494
- **Effort saved**: ~7 lines removed, 1 Object.entries() loop eliminated

## Proposed Solution

Replace the `claimedByElement` + `remainingNeeded` block with a single `claimedCount` accumulator and update the `isSurplus` predicate to compare directly against `targetComp`:

```javascript
// Before (two maps, two loops):
const claimedByElement = {};
for (const atom of claimed) {
    claimedByElement[atom.symbol] = (claimedByElement[atom.symbol] || 0) + 1;
}
const remainingNeeded = {};
for (const [el, count] of Object.entries(targetComp)) {
    remainingNeeded[el] = Math.max(0, count - (claimedByElement[el] || 0));
}
// ...
const isSurplus = !hasWrongElement &&
    mol.atoms.every(a => remainingNeeded[a.symbol] === 0);

// After (one map, one loop):
const claimedCount = {};
for (const atom of claimed) {
    claimedCount[atom.symbol] = (claimedCount[atom.symbol] || 0) + 1;
}
// ...
const isSurplus = !hasWrongElement &&
    mol.atoms.every(a => (claimedCount[a.symbol] || 0) >= (targetComp[a.symbol] || 0));
```

**Edge case**: `targetComp[a.symbol] || 0` handles the case where an element in the molecule doesn't appear in `targetComp` at all (it will be 0, so `claimedCount >= 0` is always true). But this case is already excluded by `hasWrongElement` — only correct-element molecules reach the `isSurplus` check. The logic is safe.

**Effort**: Small — refactor ~7 lines

## Acceptance Criteria

- [ ] `claimedByElement` and `remainingNeeded` variables removed
- [ ] Single `claimedCount` map used with inline `>= targetComp[el]` comparison
- [ ] All 14 Playwright tests pass after change
- [ ] Bundle rebuilt

## Work Log

- 2026-03-01: Identified by code-simplicity-reviewer during PR #3 review of fix/intention-zone-crowding
