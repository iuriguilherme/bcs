---
status: complete
priority: p3
issue_id: "047"
tags: [code-review, performance]
dependencies: []
---

# Formation factor cache opportunity in tryFormBonds hot loop

## Problem Statement

`tryFormBonds()` calls `this.thermodynamics.getFormationFactor(sym1, sym2, temp)` for every candidate atom pair. This calls `getBondEnergy()` which allocates two template-literal strings per call. With ~14 elements, there are at most 196 unique pair combinations, but the function is called thousands of times per tick at scale.

## Findings

- **Source: Performance Oracle agent**
- Not blocking at current scale (sub-500 atoms)
- Becomes measurable at 1000+ atoms: ~5000+ string allocs/tick → GC pressure
- Temperature is constant per tick, so results are cacheable by element pair

## Proposed Solutions

### Option A: Per-tick formation factor cache keyed by element pair
- **Effort:** Small

```javascript
const formationCache = this._formationCache || (this._formationCache = new Map());
formationCache.clear();
// In inner loop:
const pairKey = sym1 < sym2 ? sym1 + sym2 : sym2 + sym1;
let thermalFactor = formationCache.get(pairKey);
if (thermalFactor === undefined) {
    thermalFactor = this.thermodynamics.getFormationFactor(sym1, sym2, this.temperature);
    formationCache.set(pairKey, thermalFactor);
}
```

## Acceptance Criteria

- [ ] Formation factor computed at most once per unique element pair per tick
- [ ] All tests pass
- [ ] No behavior change (pure optimization)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-02 | Created from code review | Performance agent identified scaling concern |
