---
status: complete
priority: p2
issue_id: "045"
tags: [code-review, quality, duplication]
dependencies: []
---

# Magic number 0.85 overvalence threshold duplicated in intention.js

## Problem Statement

The expression `getBondEnergy(atom.symbol, other.symbol, 1) / MAX_BOND_ENERGY > 0.85` appears in two places in intention.js (lines 758-759 and 807-808). The threshold `0.85` is undocumented and duplicated. If the threshold changes, two places must be updated.

## Findings

- **Source: Pattern Recognition + Simplicity + Performance agents**
- `src/entities/intention.js` line 759: seed branch
- `src/entities/intention.js` line 808: no-seed branch

## Proposed Solutions

### Option A: Extract a helper function (Recommended)
- **Effort:** Small

```javascript
// At top of intention.js or module level
function _shouldAllowOvervalence(sym1, sym2) {
    return getBondEnergy(sym1, sym2, 1) / MAX_BOND_ENERGY > 0.85;
}
```

### Option B: Named constant for the threshold
- **Effort:** Trivial
- `const OVERVALENCE_STABILITY_THRESHOLD = 0.85;`

## Acceptance Criteria

- [ ] 0.85 threshold appears only once (DRY)
- [ ] All 20 tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from code review | 3 agents flagged the duplication |
