---
status: pending
priority: p3
issue_id: "027"
tags: [code-review, documentation, test]
---

# Fix stale "8→12" comment in T08 spec — actual repulsionForce is 200

## Problem Statement

The T08 test file header comment (lines 7–8) says:

> "Part B of the fix (repulsionForce 8→12, floor 0.3→0.5) means the minimum force is 6.0 units (was 2.4)"

The shipped value is `repulsionForce = 200.0`, not `12.0`. The minimum force is `100`, not `6.0`. This comment was written based on the plan document's original proposed value (`8→12`) before physics analysis during implementation revealed `12` was insufficient and the value was raised to `200`. The plan document was updated to reflect `200` (including a "planned vs actual" table), but the test file comment was not.

## Findings

- **Reporters**: code-simplicity-reviewer and performance-oracle, PR #3
- **File**: `tests/scenarios/t08-intention-wrong-composition-expulsion.spec.js`, lines 7–8
- **Current text**: `"repulsionForce 8→12, floor 0.3→0.5 … minimum force is 6.0 units (was 2.4)"`
- **Correct values**: repulsionForce went 8→200; floor went 0.3→0.5; minimum force is 100 (was 2.4)

## Proposed Solution

Update lines 7–8 of the spec:

```javascript
// Before:
// What this tests:
//   Rule 1 (_rule1_repelIrrelevantAtoms) continuously repels free O atoms from
//   a C2H4 intent zone. Part B of the fix (repulsionForce 8→12, floor 0.3→0.5)
//   means the minimum force is 6.0 units (was 2.4) — reliable expulsion even at boundary.

// After:
// What this tests:
//   Rule 1 (_rule1_repelIrrelevantAtoms) continuously repels free O atoms from
//   a C2H4 intent zone. Part B of the fix (repulsionForce 8→200, floor 0.3→0.5)
//   means the minimum force is 100 units (was 2.4) — reliable expulsion even at boundary.
```

**Effort**: Trivial — 2 word changes

## Acceptance Criteria

- [ ] Lines 7–8 of T08 spec updated to say "8→200" and "100 units"
- [ ] All 14 tests still pass (no functional change)
- [ ] Bundle rebuild NOT required (test file change only)

## Work Log

- 2026-03-01: Identified by code-simplicity-reviewer and performance-oracle during PR #3 review
