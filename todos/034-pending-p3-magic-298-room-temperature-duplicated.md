---
status: pending
priority: p3
issue_id: "034"
tags: [code-review, thermodynamics, magic-number, maintainability]
---

# Magic number `298` K room temperature duplicated in bond.js and thermodynamics.js

## Problem Statement

The room temperature reference 298 Kelvin appears as a raw magic number in two files:

1. `src/entities/bond.js:66`: `const pBreak = (1 - stability) * Math.min(1, temperature / 298);`
2. `src/systems/thermodynamics.js:32`: `return Math.min(1, stability * (temperature / 298));`

If the reference temperature ever needs to change (e.g., to 293K for lab standard or 310K for body temperature), both files would need updating separately.

298K is the standard reference temperature for chemistry calculations (25°C/STP). It should be a named constant.

## Proposed Solution

Add to `src/data/periodic-table.js` (or `src/systems/thermodynamics.js`):
```js
const ROOM_TEMP_K = 298;
window.ROOM_TEMP_K = ROOM_TEMP_K;
```

Then replace both usages:
- `bond.js:66`: `Math.min(1, temperature / ROOM_TEMP_K)`
- `thermodynamics.js:32`: `stability * (temperature / ROOM_TEMP_K)`

**Effort**: Trivial | **Risk**: None

## Acceptance Criteria

- [ ] `ROOM_TEMP_K = 298` constant defined and exported
- [ ] Both usages in bond.js and thermodynamics.js replaced
- [ ] All tests pass

## Work Log

- 2026-03-18: Identified during PR #5 code review — magic number in thermodynamics formulas
