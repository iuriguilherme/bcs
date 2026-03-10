---
status: complete
priority: p3
issue_id: "054"
tags: [code-review, quality, performance]
dependencies: []
---

# _formationCache lazy-initialized inside hot method, not in constructor

## Problem Statement

`Environment.tryFormBonds()` lazy-initializes the formation cache inline:

```javascript
const formationCache = this._formationCache || (this._formationCache = new Map());
```

Meanwhile, all other `_thermal*` fields are initialized in the constructor:
```javascript
this._thermalBreakTick = 0;
this._bondsToBreak = [];
this.thermodynamics = null;
```

And reset in `clear()`:
```javascript
this._thermalBreakTick = 0;
this._bondsToBreak = [];
// _formationCache NOT reset here
```

Two consequences:
1. **Object shape inconsistency** — V8 creates a new hidden class for `Environment` the first time `tryFormBonds()` runs (hidden class transition). With a single `Environment` instance this is a one-time micro-cost, but it breaks the established pattern.
2. **Not reset on `clear()`** — If `temperature` changes across a `clear()` + reinit cycle, stale cache entries could briefly return wrong formation factors (though they're cleared at the start of each `tryFormBonds()` call via `formationCache.clear()`, so in practice this is safe).

## Findings

- **Source: Performance Oracle + Simplicity Reviewer agents**
- `src/core/environment.js` line 599: lazy-init inside hot method
- `src/core/environment.js` lines 35-38: constructor initializes other `_thermal*` fields
- `src/core/environment.js` lines 983-984: `clear()` resets `_thermalBreakTick` and `_bondsToBreak` but not `_formationCache`

## Proposed Solutions

### Option A: Add to constructor and clear() (Recommended)
In constructor, add:
```javascript
this._formationCache = new Map();
```
In `clear()`, add:
```javascript
this._formationCache.clear();
```
Then in `tryFormBonds()`, remove the lazy-init and just call `this._formationCache.clear()`:
```javascript
this._formationCache.clear();
```

- **Effort:** Trivial (3-line change)
- **Pros:** Consistent object shape; consistent lifecycle; matches `_bondsToBreak` pattern

### Option B: Leave as-is (consistent with pre-existing lazy-init patterns elsewhere)
- The Map is allocated exactly once; the hidden class transition is one-time; `formationCache.clear()` runs every tick ensuring fresh data
- **Cons:** Pattern inconsistency with other `_thermal*` fields

## Acceptance Criteria

- [ ] `_formationCache` initialized in `Environment` constructor
- [ ] `_formationCache` reset in `clear()`
- [ ] All 20 tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from code review (Performance Oracle agent) | Object shape inconsistency with other _thermal* fields |
