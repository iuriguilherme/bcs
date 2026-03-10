---
status: complete
priority: p2
issue_id: "038"
tags: [code-review, thermodynamics, security, serialization]
dependencies: []
---

# `environment.deserialize()` — `data.width` and `data.height` have no bounds validation (can hang browser tab)

## Problem Statement

The thermodynamics plan adds validation for `data.temperature` in `environment.deserialize()`. But the same deserialize method assigns `this.width = data.width` and `this.height = data.height` with no validation whatsoever. A crafted save file can set these to `Infinity`, `-1`, or `NaN`, causing the spatial grid calculations to produce `Infinity` loop bounds, hanging the browser tab. Since the plan already touches this code path to add temperature validation, this is the right moment to fix the adjacent vulnerability.

## Findings

- `environment.deserialize()` (lines ~969-974): `this.width = data.width; this.height = data.height;` — no validation
- Spatial grid at `environment.js:475-478` uses: `Math.floor((x - radius) / this.gridSize)` — if `width = Infinity`, grid calculations produce Infinity/NaN
- `_findAllConnectedGroups()` uses BFS loops that could run indefinitely if atom positions are affected
- `Catalogue.import()` + `environment.deserialize()` is an attacker-controlled import chain
- Phase 10 of the plan already adds temperature validation — width/height should be validated in the same pass

## Proposed Solutions

### Option 1: Add validation for width and height in Phase 10 (Recommended)

Add to `environment.deserialize()` alongside the temperature validation:

```javascript
// Validate width/height (same pattern as temperature guard in Phase 10)
const rawWidth = data.width;
const rawHeight = data.height;
this.width = (Number.isFinite(rawWidth) && rawWidth > 0 && rawWidth <= 10000) ? rawWidth : 2000;
this.height = (Number.isFinite(rawHeight) && rawHeight > 0 && rawHeight <= 10000) ? rawHeight : 2000;
```

**Pros:** Consistent with temperature validation pattern; minimal code; safe defaults
**Cons:** May mask bugs if valid save files have unusual dimensions
**Effort:** 10 minutes
**Risk:** Low

---

### Option 2: Validate all numeric fields in deserialize

A broader audit of all `this.field = data.field` assignments in `environment.deserialize()`.

**Pros:** Comprehensive security
**Cons:** Scope creep for this feature; should be a separate security-focused task
**Effort:** 2 hours
**Risk:** Low

## Recommended Action

Option 1 — as a targeted addition to Phase 10's deserialization work. Add the width/height guards adjacent to the temperature guard. This is a 2-line fix that prevents browser tab hang from crafted imports.

## Technical Details

**Affected files:**
- `src/core/environment.js` — `deserialize()` (lines ~969-974)
- `docs/plans/2026-03-01-feat-thermodynamics-temperature-bond-stability-plan.md` — Phase 10 expand scope

## Acceptance Criteria

- [ ] `data.width` validated: `Number.isFinite(v) && v > 0 && v <= 10000`, defaults to 2000
- [ ] `data.height` validated: same pattern, defaults to 2000
- [ ] Validation added in Phase 10 alongside temperature validation
- [ ] No browser tab hang from crafted Infinity/NaN width/height in save files

## Work Log

### 2026-03-01 - Identified by Security Sentinel

**By:** Security Sentinel review agent

---

### 2026-03-01 - Resolved

**By:** Claude Code

**Actions:**
- Added width/height validation to Phase 10 serialization security section
- Pattern: `Number.isFinite(v) && v > 0 && v <= 10000`, defaults to 2000
- Placed adjacent to temperature validation in the same code block

## Resources

- **Plan:** `docs/plans/2026-03-01-feat-thermodynamics-temperature-bond-stability-plan.md` Phase 10
- **Source:** `src/core/environment.js:969-974` — `deserialize()`
- **Related:** Todo 037 (localTemperature validation — same pattern)
